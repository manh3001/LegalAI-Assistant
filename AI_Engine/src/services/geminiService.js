const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const SystemConfig = require('../config/SystemConfig');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { YoutubeTranscript } = require('youtube-transcript');
const sql = require('mssql');
const { pool, poolConnect } = require('../config/db');

// ==============================================================================
// HÀM LOGGING THỐNG KÊ 
// ==============================================================================
async function logUsage(featureName) {
    try {
        await poolConnect;
        const logRequest = pool.request();

        // Sử dụng input parameter để bảo mật
        logRequest.input('feature', sql.NVarChar, featureName);

        const upsertQuery = `
            IF EXISTS (SELECT 1 FROM [LegalBotDB].[dbo].[AIFeatureUsage] 
                       WHERE FeatureName = @feature 
                       AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE))
            BEGIN
                UPDATE [LegalBotDB].[dbo].[AIFeatureUsage]
                SET UsageCount = UsageCount + 1,
                    LastUsed = GETDATE()
                WHERE FeatureName = @feature
                AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
            END
            ELSE
            BEGIN
                INSERT INTO [LegalBotDB].[dbo].[AIFeatureUsage] (FeatureName, UsageCount, LastUsed, CreatedAt)
                VALUES (@feature, 1, GETDATE(), GETDATE())
            END
        `;

        await logRequest.query(upsertQuery);

        if (global.io) {
            global.io.emit('new_activity', { type: featureName });
        }
    } catch (err) {
        console.error(` Lỗi lưu thống kê ${featureName}:`, err.message);
    }
}

function cleanAIJsonString(rawString) {
    if (!rawString) return "[]"; // Mặc định trả về mảng rỗng nếu không có data

    // 1. Xử lý thô: 
    let cleaned = rawString
        .replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();

    // 2. PHẪU THUẬT CHÍNH: Tìm khối JSON thực sự
    // Regex này sẽ tìm từ dấu [ hoặc { đầu tiên đến dấu ] hoặc } cuối cùng
    const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);

    if (jsonMatch) {
        return jsonMatch[0]; // Trả về phần text nằm trong ngoặc
    }

    // Nếu không tìm thấy cấu trúc JSON, trả về giá trị an toàn để tránh crash
    console.warn(" AI không trả về định dạng JSON chuẩn:", cleaned);
    return cleaned.startsWith('[') ? "[]" : "{}";
}

// ==============================================================================
// HÀM HELPER: CHUẨN HÓA LINK YOUTUBE (XỬ LÝ SHORTS & YOUTU.BE)
// ==============================================================================
function normalizeYouTubeUrl(rawUrl) {
    if (!rawUrl) return "";
    let videoId = "";

    try {
        if (rawUrl.includes('shorts/')) {
            // Lấy ID từ dạng shorts/ID
            videoId = rawUrl.split('shorts/')[1].split('?')[0];
        } else if (rawUrl.includes('youtu.be/')) {
            // Lấy ID từ dạng youtu.be/ID
            videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
        } else if (rawUrl.includes('watch?v=')) {
            // Lấy ID từ dạng watch?v=ID
            videoId = rawUrl.split('watch?v=')[1].split('&')[0];
        }

        // Nếu tìm thấy ID, ép nó về định dạng chuẩn nhất
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (e) {
        console.warn("Lỗi khi chuẩn hóa URL:", e);
    }

    return rawUrl; // Trả về nguyên gốc nếu không parse được
}

// ==============================================================================
// HÀM CHỌN MODEL HOẠT ĐỘNG TỐI ƯU VỚI CƠ CHẾ TIMEOUT VÀ RETRY
// ==============================================================================
async function getActiveModel(prompt) {
    const apiKey = SystemConfig?.geminiApiKey;
    const preferredModel = SystemConfig?.geminiModel;
    const temp = SystemConfig?.temperature || 0.1; // Khuyên dùng 0.1 cho logic Luật

    if (!apiKey) throw new Error("Chưa có API Key trong hệ thống!");

    const genAI = new GoogleGenerativeAI(apiKey);
    const shortPrompt = typeof prompt === 'string' ? prompt.substring(0, 20000) : prompt;

    const fastQueue = [...new Set([
        preferredModel,
        "models/gemini-2.5-flash",        // Ưu tiên 1: Chạy nhanh, ổn định nhất hiện tại

        "models/gemini-2.0-flash",        // Ưu tiên 2: 

        "models/gemini-flash-latest",     // Ưu tiên 3: luôn trỏ về bản mới nhất

        "models/gemini-2.5-pro",
    ])].filter(Boolean);

    for (const modelName of fastQueue) {
        try {
            console.log(` Đang gọi: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });

            // 1. Tạo một Promise Timeout 
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), 45000)
            );

            // 2. Tạo Promise gọi API 
            const apiPromise = model.generateContent({
                contents: [{ role: "user", parts: [{ text: shortPrompt }] }],
                generationConfig: {
                    temperature: temp,
                    topP: 0.8,
                    responseMimeType: "application/json" // BẮT BUỘC ĐỂ TRÁNH LỖI PARSE
                }
            });

            // 3. Ai xong trước lấy kết quả đó.
            const result = await Promise.race([apiPromise, timeoutPromise]);

            if (result && result.response) {
                const text = result.response.text();
                if (text) {
                    console.log(` ${modelName} phản hồi thành công!`);
                    return text;
                }
            }
        } catch (error) {
            const msg = error.message || "";
            console.warn(`⚠️ ${modelName} thất bại:`, msg.split('\n')[0]);

            // Xử lý riêng lỗi Timeout
            if (msg === "TIMEOUT_EXCEEDED") {
                console.warn(`⏳ ${modelName} quá thời gian phản hồi (45s). Chuyển model...`);
            } else if (msg.includes("429") || msg.includes("503")) {
                await new Promise(r => setTimeout(r, 5000));
            }
            continue;
        }
    }

    throw new Error("Tất cả model đều từ chối hoặc hết hạn mức.");
}

// ==============================================================================
// HÀM PHÂN TÍCH HỢP ĐỒNG 
// ==============================================================================
async function analyzeContract(contractText, isUserPreMasked = false) {
    try {
        const prompt = `
Bạn là AI Pháp lý LegAI, đóng vai Thẩm phán chuyên trách rà soát hợp đồng theo pháp luật Việt Nam.

────────────────────────────
[1. DATA MASKING - ABSOLUTE]
────────────────────────────
is_user_pre_masked = ${isUserPreMasked};
is_system_masked = true;

Các token '***', '[MASKED]', '[HỌ_TÊN]', '[____]' là dữ liệu gốc đã được CHE MỘT PHẦN.

QUY TẮC BẮT BUỘC:
- '***' KHÔNG phải dữ liệu thiếu → là dữ liệu thật đã bị ẩn danh.
- KHÔNG được bỏ qua hoặc xem nhẹ các trường chứa '***'.
- KHÔNG được suy luận sai lệch từ dữ liệu đã bị che.

- KHÔNG được báo lỗi thiếu thông tin nếu dữ liệu bị che bởi hệ thống.
- Chỉ coi là thiếu dữ liệu nếu điều khoản KHÔNG tồn tại trong hợp đồng.

- Các chuỗi số dạng "123***" vẫn là dữ liệu hợp lệ → không được suy luận sai về giá trị.

────────────────────────────
[2. 15 TRỤ CỘT PHÁP LÝ BẮT BUỘC (PILLARS)]
────────────────────────────
Bạn PHẢI phân tích dựa trên 15 trụ cột:
(1) Chủ thể & Thẩm quyền  
(2) Đối tượng hợp đồng  
(3) Giá & Thanh toán  
(4) Thời hạn & Hiệu lực  
(5) Quyền chấm dứt  
(6) Phạt vi phạm  
(7) Bồi thường thiệt hại  
(8) Bất khả kháng  
(9) Giải quyết tranh chấp  
(10) Bảo mật & NDA  
(11) Luật áp dụng  
(12) Chuyển nhượng quyền/nghĩa vụ  
(13) Các trường hợp vô hiệu  
(14) Nghĩa vụ sau chấm dứt  
(15) Cơ chế thực thi  

Chỉ report các trụ cột có vấn đề.

────────────────────────────
[3. ENGINE CHẤM ĐIỂM (ALGORITHMIC - DETERMINISTIC)]
────────────────────────────
Base = 100

- Dangerous: -40đ → Vi phạm điều cấm, có thể vô hiệu hợp đồng
- High Risk: -20đ → Bất lợi lớn, điều khoản bẫy
- Advisory: -10đ → Thiếu rõ ràng nhưng chưa gây vô hiệu

Công thức:
1. Raw = max(0, 100 - Tổng điểm trừ)
2. CAP (chỉ chọn 1 mức thấp nhất):
   - ≥ 2 Dangerous → 20
   - 1 Dangerous → 40
   - ≥ 1 High Risk → 60
   - Khác → 100
3. Final = min(Raw, CAP)

────────────────────────────
[4. INSUFFICIENT DATA RULE & CONTEXTUAL SCORING]
────────────────────────────
- TUYỆT ĐỐI KHÔNG đánh 'Dangerous' hoặc 'High Risk' cho việc THIẾU ĐIỀU KHOẢN, trừ khi điều khoản đó là BẮT BUỘC để hợp đồng có hiệu lực theo luật Việt Nam (VD: Đối tượng hợp đồng).
- Tính linh hoạt: Phải đánh giá sự thiếu sót dựa trên LOẠI HỢP ĐỒNG và MỨC ĐỘ PHỨC TẠP. 
   + Với hợp đồng dân sự đơn giản (thuê nhà, mua bán nhỏ): Thiếu Bất khả kháng, NDA, Chuyển nhượng... là BÌNH THƯỜNG -> Ghi "N/A" và đánh 'Safe' (Không trừ điểm).
   + Với hợp đồng thương mại/doanh nghiệp lớn: Thiếu các trụ cột trên có thể là rủi ro -> Đánh 'Advisory' (-10đ).
- Chỉ trừ điểm nặng nếu hợp đồng có ĐIỀU KHOẢN HIỆN HỮU nhưng được viết theo hướng gài bẫy, bất lợi, hoặc vi phạm pháp luật.
- KHÔNG được coi dữ liệu bị che bằng '***' là thiếu thông tin.
────────────────────────────
[5. REWRITING & ANONYMIZATION RULE]
────────────────────────────

[ẨN DANH]:
- Trong 'summary' và 'issue': KHÔNG dùng tên riêng hoặc tên công ty (kể cả có ***)
- Dùng các thuật ngữ:
  "Bên A", "Bên B", "Pháp nhân", "Cá nhân", "Nhà thầu", "Khách hàng"

Ví dụ:
Sai: "Hợp đồng giữa Phạm Phú ***"
Đúng: "Hợp đồng giữa Cá nhân và Pháp nhân"

[CLAUSE]:
- 'clause' phải giữ NGUYÊN VĂN 100% (bao gồm cả ***)
- KHÔNG áp dụng quy tắc ẩn danh cho clause

[RÚT GỌN]:
- Chỉ dùng '[...]' để rút gọn
- TUYỆT ĐỐI KHÔNG dùng '***' để rút gọn

[VIẾT LẠI]:
- 'solution' phải theo format:
"Lý do: ... | Đề xuất sửa: '...[đoạn văn bản pháp lý]...'"

────────────────────────────
[6. DATA EXTRACTION RULE]
────────────────────────────
- 'total_value' chỉ lấy từ điều khoản thanh toán
- KHÔNG lấy từ:
  + số tài khoản
  + mã định danh
  + chuỗi số đã bị che

────────────────────────────
[OUTPUT JSON FORMAT]
────────────────────────────
{
  "summary": "...",
  "contract_info": { 
      "type": "...", 
      "laws": ["..."], 
      "total_value": "Ví dụ: 100.000.000 VNĐ - Một trăm triệu đồng | hoặc N/A"
  },
  "scoring_details": {
    "deductions": { "dangerous": 0, "high": 0, "advisory": 0 },
    "applied_cap": 0,
    "calculation_note": "Liệt kê các lỗi đã trừ điểm"
  },
  "risk_score": 0,
  "overall_assessment": "Safe | Caution | Dangerous",
  "evaluation_flags": {
    "has_void_risk": false,
    "has_unbalanced_terms": false
  },
  "analysis_report": [
    {
      "pillar": "...",
      "severity": "...",
      "clause": "...",
      "issue": "...",
      "void_type": "partial | entire | none",
      "legal_basis": {
        "law": "...",
        "article": "...",
        "confidence": "high|medium",
        "reference_text": "..."
      },
      "solution": "Lý do: ... | Đề xuất sửa: '...'"
    }
  ],
  "recommendation": "...",
  "confidence_overall": "high|medium|low"
}

────────────────────────────
[CONTRACT]
────────────────────────────
"""${contractText}"""
`;

        const responseText = await getActiveModel(prompt);
        const cleanedText = cleanAIJsonString(responseText);
        const result = JSON.parse(cleanedText);

        await logUsage('CONTRACT_REVIEW');
        return result;

    } catch (error) {
        console.error("Lỗi phân tích hợp đồng:", error.message);

        // BẢN SỬA LỖI: Trả về object chứa đầy đủ các trường của JSON v3.9 để tránh Crash UI
        return {
            summary: "Lỗi kết nối AI hoặc hết hạn mức.",
            contract_info: { type: "Unknown", laws: [] },
            scoring_details: { deductions: { dangerous: 0, high: 0, advisory: 0 }, applied_cap: 0, calculation_note: "System Error" },
            risk_score: 0,
            overall_assessment: "Dangerous",
            evaluation_flags: { has_void_risk: true, has_unbalanced_terms: true },
            analysis_report: [
                {
                    pillar: "Hệ thống (Cơ chế thực thi)",
                    severity: "Dangerous",
                    clause: "Lỗi API",
                    issue: "Hệ thống đang quá tải hoặc kết nối bị gián đoạn.",
                    void_type: "none",
                    legal_basis: { law: "N/A", article: null, confidence: "low", reference_text: "N/A" },
                    solution: "Lý do: Máy chủ AI không phản hồi. | Đề xuất sửa: 'Vui lòng nhấn F5 hoặc tải lại file hợp đồng sau 30 giây.'"
                }
            ],
            recommendation: "Vui lòng chờ 15-30 giây rồi thử lại.",
            confidence_overall: "low"
        };
    }
}
// ==============================================================================
// HÀM TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
async function generateForm(userInput, chatHistory = [], documents = []) {
    try {
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử.";

        // CHUYỂN HÓA DỮ LIỆU LUẬT TỪ PINECONE THÀNH TEXT ĐỂ ĐƯA VÀO PROMPT
        const contextText = documents.length > 0
            ? documents.map((doc, index) => {
                const title = doc.title || "Tài liệu";
                let rawContent = doc.content || doc.noi_dung_tom_tat || "";
                const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent;
                return `[TÀI LIỆU LUẬT ${index + 1} - ${title}]: ${content}`;
            }).join("\n\n")
            : "Không có dữ liệu luật cụ thể, hãy dùng kiến thức chung.";

        const prompt = `
# VAI TRÒ:
Bạn là LegAI - Luật sư cấp cao và Trợ lý thông minh chuyên bóc tách dữ liệu để tự động soạn thảo Hợp Đồng pháp lý tại Việt Nam.

# QUY TẮC SOẠN THẢO NỘI DUNG (BẮT BUỘC TUÂN THỦ):
1. Văn phong: Trang trọng, chặt chẽ, khách quan. Tuyệt đối không dùng từ ngữ giao tiếp đời thường.
2. Thuật ngữ pháp lý: Chủ động sử dụng các thuật ngữ chuyên ngành chuẩn xác (Ví dụ: "Đơn phương chấm dứt", "Bất khả kháng", "Nghĩa vụ liên đới", "Chuyển giao rủi ro", "Chậm thực hiện nghĩa vụ").
3. Tính bảo vệ: Khi người dùng không yêu cầu chi tiết, phải TỰ ĐỘNG soạn thảo các điều khoản theo hướng bảo vệ tối đa quyền lợi hợp pháp cho cả hai bên, lường trước các rủi ro phát sinh.
4. Cách trình bày: Không viết gộp một đoạn dài. Phải bám sát việc chia nhỏ thành từng tiểu mục (1.1, 1.2) mạch lạc.
BẮT BUỘC sử dụng ký tự xuống dòng (\n) sau mỗi tiểu mục (1.1, 1.2...). 
Mỗi tiểu mục phải là một đoạn văn riêng biệt. Tuyệt đối không viết dính liền các tiểu mục vào một khối văn bản dài.

5. CẬP NHẬT LUẬT MỚI NHẤT (DYNAMIC LAW GROUNDING & ANTI-HALLUCINATION):
   - ƯU TIÊN TUYỆT ĐỐI (RAG-FIRST): Mọi căn cứ pháp lý BẮT BUỘC ưu tiên trích xuất từ [TÀI LIỆU LUẬT]. Nếu tài liệu cung cấp tên và năm ban hành luật, phải sử dụng NGUYÊN VẸN. NGHIÊM CẤM dùng trí nhớ gốc để ghi đè dữ liệu RAG.
   - NHẬN THỨC THỜI GIAN (TEMPORAL AWARENESS): Bạn phải luôn nhận thức năm hiện tại là 2026. Khi phải dùng trí nhớ gốc (do RAG trống), BẮT BUỘC tự động suy luận để chọn phiên bản luật có năm ban hành gần 2026 nhất.
    NGHIÊM CẤM dùng luật lỗi thời nếu đã có bản thay thế mới hơn trong cùng hệ thống quy phạm.
   - FALLBACK AN TOÀN: Nếu buộc phải dùng trí nhớ gốc mà không nhớ chính xác 100% số hiệu văn bản 
   (VD: số hiệu, ngày ban hành), TUYỆT ĐỐI KHÔNG ĐƯỢC BỊA ĐẶT. Chỉ cần ghi ngắn gọn "Tên Luật + Năm ban hành" (Ví dụ: "Luật Đất đai 2024").
    Không phụ thuộc vào danh sách cấm tĩnh, phải tự quyết định dựa trên tính thời điểm.
# NGỮ CẢNH TRƯỚC ĐÓ:
${historyText}

# ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
"${userInput}"

# CÁC KHUNG HỢP ĐỒNG THỰC CHIẾN (MASTER TEMPLATES):
Dựa trên yêu cầu của người dùng, BẮT BUỘC chọn 1 trong 4 khung dưới đây và triển khai CHI TIẾT thành văn xuôi pháp lý cho từng tiểu mục (1.1, 1.2...):

[KHUNG 1: HỢP ĐỒNG MUA BÁN HÀNG HÓA]
- Điều 1: Tên hàng hóa, số lượng, chất lượng, giá trị (1.1. Tên, đơn vị, số lượng, đơn giá, thành tiền; 1.2. Tổng giá trị bằng số và chữ).
- Điều 2: Thanh toán (2.1. Ngày thanh toán; 2.2. Hình thức thanh toán).
- Điều 3: Thời gian, địa điểm, phương thức giao hàng (3.1. Thời gian, địa điểm giao; 3.2. Phương tiện và chi phí bốc xếp; 3.3. Chi phí lưu kho bãi nếu không nhận hàng; 3.4. Kiểm nhận phẩm chất tại chỗ và lập biên bản nếu thiếu sót; 3.5. Kiểm tra hàng nguyên kiện và thời hạn báo lỗi trung gian).
- Điều 4: Trách nhiệm của các bên (4.1. Trách nhiệm về khiếm khuyết trước/sau chuyển rủi ro; 4.2. Trách nhiệm thanh toán và nhận hàng).
- Điều 5: Bảo hành và hướng dẫn sử dụng (5.1. Thời gian bảo hành; 5.2. Cung cấp giấy hướng dẫn).
- Điều 6: Ngưng thanh toán (6.1. Do lừa dối; 6.2. Hàng hóa bị tranh chấp; 6.3. Giao sai hợp đồng; 6.4. Bồi thường nếu báo cáo sai sự thật).
- Điều 7: Điều khoản phạt vi phạm (7.1. Phạt % giá trị hợp đồng nếu vi phạm - tối đa 8%; 7.2. Trách nhiệm vật chất dựa trên khung phạt Nhà nước).
- Điều 8: Bất khả kháng và giải quyết tranh chấp (8.1. Định nghĩa bất khả kháng; 8.2. Nghĩa vụ thông báo; 8.3. Đưa ra Tòa án có thẩm quyền nếu không tự giải quyết được).

[KHUNG 2: HỢP ĐỒNG CUNG CẤP DỊCH VỤ]
- Điều 1: Đối tượng hợp đồng (1.1. Chi tiết công việc Bên B thực hiện cho Bên A).
- Điều 2: Thời hạn thực hiện (2.1. Ngày bắt đầu; 2.2. Thời gian dự kiến hoàn thành).
- Điều 3: Quyền và nghĩa vụ của Bên A (3.1. Yêu cầu làm đúng chất lượng, quyền đơn phương chấm dứt nếu vi phạm; 3.2. Cung cấp tài liệu, kế hoạch và thanh toán đúng hạn).
- Điều 4: Quyền và nghĩa vụ của Bên B (4.1. Yêu cầu cung cấp thông tin, thanh toán; 4.2. Không giao người khác làm thay nếu chưa đồng ý, bảo mật thông tin, báo cáo rủi ro).
- Điều 5: Tiền dịch vụ và phương thức thanh toán (5.1. Tổng tiền gồm VAT; 5.2. Hình thức thanh toán).
- Điều 6: Đơn phương chấm dứt (6.1. Quyền chấm dứt nếu không có lợi và số ngày báo trước; 6.2. Chấm dứt do vi phạm nghiêm trọng).
- Điều 7: Giải quyết tranh chấp (7.1. Thỏa thuận kịp thời; 7.2. Khởi kiện tại Tòa án).

[KHUNG 3: HỢP ĐỒNG THỬ VIỆC / LAO ĐỘNG]
- Điều 1: Thời hạn và công việc (1.1. Loại hợp đồng; 1.2. Thời gian thử việc từ ngày... đến ngày...; 1.3. Địa điểm làm việc; 1.4. Chức danh/Nhiệm vụ chuyên môn).
- Điều 2: Chế độ làm việc (2.1. Số giờ làm việc/ngày, ngày nghỉ hàng tuần; 2.2. Dụng cụ làm việc được cấp).
- Điều 3: Lương và Phụ cấp (3.1. Mức lương thử việc - đảm bảo >= 85% lương chính thức; 3.2. Phụ cấp ăn trưa, đi lại; 3.3. Hình thức/ngày trả lương).
- Điều 4: Quyền và Nghĩa vụ NLĐ (4.1. Quyền lợi nhận lương, đánh giá ký HĐ chính thức; 4.2. Nghĩa vụ tuân thủ nội quy, bảo mật kinh doanh).
- Điều 5: Quyền và Nghĩa vụ NSDLĐ (5.1. Quyền điều hành, đánh giá đạt/không đạt; 5.2. Nghĩa vụ trả lương, bảo đảm an toàn LĐ).
- Điều 6: Đơn phương chấm dứt (6.1. Quyền hủy hợp đồng thử việc không cần báo trước, không bồi thường; 6.2. Giải quyết tranh chấp).

[KHUNG 4: HỢP ĐỒNG THUÊ NHÀ Ở]
- Điều 1: Thông tin nhà ở (1.1. Vị trí, địa điểm; 1.2. Hiện trạng chất lượng; 1.3. Diện tích sử dụng riêng/chung; 1.4. Công năng; 1.5. Trang thiết bị kèm theo).
- Điều 2: Giá thuê nhà (2.1. Giá thuê mỗi tháng/năm; 2.2. Tiền điện, nước, dịch vụ bên thuê tự thanh toán).
- Điều 3: Phương thức và thời hạn (3.1. Hình thức thanh toán; 3.2. Thời hạn thanh toán).
- Điều 4: Thời hạn và Bàn giao (4.1. Thời gian thuê; 4.2. Ngày bàn giao).
- Điều 5: Sử dụng nhà (5.1. Mục đích sử dụng; 5.2. Hạn chế sử dụng; 5.3. Tuân thủ nội quy khu nhà).
- Điều 6: Quyền và nghĩa vụ Bên cho thuê (6.1. Yêu cầu thanh toán, bảo quản nhà, bồi thường hư hỏng; 6.2. Giao nhà đúng hạn, bảo trì định kỳ, không đơn phương chấm dứt vô cớ).
- Điều 7: Quyền và nghĩa vụ Bên thuê (6.1. Nhận nhà đúng hiện trạng, yêu cầu sửa chữa lỗi cấu trúc; 6.2. Trả đủ tiền, không tự ý thay đổi cải tạo, bồi thường do lỗi sử dụng).
- Điều 8 & 9: Vi phạm và Phạt (8.1. Trách nhiệm khi vi phạm; 8.2. Mức phạt cụ thể; 8.3. Sự kiện bất khả kháng).
- Điều 10: Chấm dứt hợp đồng (10.1. Đồng ý chấm dứt, chậm thanh toán, hoặc do bất khả kháng; 10.2. Xử lý hậu quả hoàn tiền, trả cọc).

# NHIỆM VỤ BẮT BUỘC:
1. Đọc yêu cầu và TỰ ĐỘNG SUY LUẬN loại hợp đồng phù hợp. Chọn 1 trong 4 khung trên. (Nếu không thuộc 4 loại, tự suy luận khung tương tự).
2. Tự động gán vai trò Bên A và Bên B đúng chuẩn pháp lý.
3. QUY TẮC KIỂM TRA THÔNG TIN THIẾU (MISSING DATA CHECK): 
Bạn phải đối chiếu các trường thông tin cá nhân/tổ chức (tên, cccd, địa chỉ, số điện thoại, người đại diện...). 
Nếu bất kỳ trường nào BỊ TRỐNG, BẮT BUỘC phải liệt kê rõ ràng các thông tin còn thiếu đó vào trường "chat_reply" để yêu cầu người dùng cung cấp thêm.
Ví dụ: "Tôi đã tạo xong khung hợp đồng. Tuy nhiên, để hoàn thiện, bạn vui lòng cung cấp thêm: Địa chỉ công ty A, Số điện thoại và Địa chỉ của Nguyễn Văn A."
TUYỆT ĐỐI không trả lời chung chung (như "Vui lòng kiểm tra lại...") nếu có trường dữ liệu bị trống.


4. TRƯỜNG HỢP BIỂU MẪU TRẮNG: Nếu yêu cầu "mẫu trống/phôi in", để trống toàn bộ thông tin cá nhân (.....) và không hỏi thêm.
5. SIÊU CHỈ THỊ SOẠN THẢO (ANTI-LAZINESS & STRUCTURE LOCK): 
   - BẮT BUỘC giữ nguyên cấu trúc tiểu mục (1.1, 1.2...) của Khung đã chọn.
   - Với MỖI Điều khoản, bạn phải soạn thảo tối thiểu 3-5 tiểu mục con. 
   - Mỗi tiểu mục con phải là văn xuôi pháp lý dài, chặt chẽ (ít nhất 2-3 câu). 
   - Lồng ghép chi tiết các con số, thời hạn, mức phạt cụ thể mà người dùng đã cung cấp vào nội dung văn bản. 
   - TUYỆT ĐỐI KHÔNG viết tóm tắt hoặc chỉ liệt kê tiêu đề.

6. CONTEXT RESET: Nếu đổi loại hợp đồng đột ngột, BẮT BUỘC reset mọi thông tin cá nhân về chuỗi rỗng "".

# YÊU CẦU ĐẦU RA JSON (TUYỆT ĐỐI TUÂN THỦ):
{
  "chat_reply": "Câu trả lời báo cáo kết quả và hỏi thêm thông tin thiếu.",
  "template_type": "Loại hợp đồng (VD: hop_dong_mua_ban, none...)",
  "extracted_data": {
    "ten_hop_dong": "TÊN HỢP ĐỒNG IN HOA",
    "benA_role": "VAI TRÒ BÊN A IN HOA",
    "benB_role": "VAI TRÒ BÊN B IN HOA",
    "can_cu_luat": ["Danh sách các luật liên quan"],
    "benA_name": "", "benA_id": "", "benA_address": "", "benA_phone": "", "benA_rep": "",
    "benB_name": "", "benB_id": "", "benB_address": "", "benB_phone": "", "benB_rep": "",
    "sections": [
  {
    "title": "Tên Điều (Ví dụ: Điều 1: Đối tượng hợp đồng)",
    "content": "1.1. [Soạn thảo nội dung chi tiết khoản 1 tại đây, tối thiểu 3 câu văn pháp lý] \n1.2. [Soạn thảo nội dung chi tiết khoản 2 tại đây, tối thiểu 3 câu văn pháp lý] \n1.3. [Tiếp tục xuống dòng cho các khoản tiếp theo...]"
  }
]
  }
}

# CẢNH BÁO TỐI THƯỢNG:
CHỈ trả về JSON thuần túy. KHÔNG chào hỏi rườm rà bên ngoài. Nếu không tuân thủ cấu trúc JSON này, hệ thống sẽ lỗi.
`;

        const responseText = await getActiveModel(prompt);

        // Làm sạch JSON
        const cleanedText = cleanAIJsonString(responseText);
        const result = JSON.parse(cleanedText);

        // Log usage
        await logUsage('FORM_GENERATOR');

        return result;

    } catch (error) {
        console.error(" Lỗi tạo form:", error.message);
        throw new Error("Không thể bóc tách dữ liệu lúc này.");
    }
}

// ==============================================================================
// HÀM LẬP KẾ HOẠCH (PLANNING) - VER PROMPT ENGINEERED
// ==============================================================================
async function generatePlan(combinedText) {
    try {
        // Lấy ngày hiện tại format DD/MM/YYYY để AI có mốc thời gian suy luận
        const currentDate = new Date();
        const today = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/2026`;

        const prompt = `
Bạn là LegAI — Luật sư AI chuyên sâu kết hợp Chuyên gia Quản trị Dự án Pháp lý.
Nhiệm vụ duy nhất của bạn: PHÂN TÍCH HỒ SƠ và TẠO RA KẾ HOẠCH HÀNH ĐỘNG PHÁP LÝ (LEGAL ACTION PLAN) CHI TIẾT DƯỚI DẠNG JSON.
Hôm nay là ngày: ${today}

Dữ liệu đầu vào:
"""${combinedText}"""

I. NGUYÊN TẮC BẮT BUỘC (KHÔNG TUÂN THỦ = OUTPUT KHÔNG HỢP LỆ)
1. Cấu trúc giai đoạn (PHASES)
- BẮT BUỘC phải có tối thiểu 3 và tối đa 5 giai đoạn
- Tên giai đoạn phải ngắn gọn, mang tính hành động (VD: "Chuẩn bị", "Nộp hồ sơ", "Giải quyết", "Thi hành")
- NGHIÊM CẤM đặt tên kiểu: "Giai đoạn 1", "Phase 2",...

2. Số lượng và độ chi tiết TASKS (ANTI-LAZINESS)
- BẮT BUỘC tạo tối thiểu 12 và tối đa 18 TASKS
- Mỗi TASK phải là hành động vi mô, có thể thực thi ngay
- NGHIÊM CẤM: Gom nhiều hành động vào 1 task. Dùng mô tả chung chung (VD: "Xử lý hồ sơ").
- Ví dụ hợp lệ: "Soạn thảo đơn khởi kiện theo Mẫu số 23-DS", "Đóng tạm ứng án phí tại Chi cục Thi hành án"
- Ví dụ không hợp lệ: "Chuẩn bị hồ sơ khởi kiện"

3. CƠ CHẾ TỰ KIỂM TRA (SELF-VALIDATION)
- TRƯỚC KHI TRẢ KẾT QUẢ, bạn BẮT BUỘC:
  + Đếm tổng số TASK
  + Nếu < 12 → PHẢI tự động bổ sung
  + Nếu > 18 → PHẢI tự động rút gọn (nhưng vẫn giữ vi mô)
- CHỈ ĐƯỢC TRẢ OUTPUT khi số TASK nằm trong [12–18]

4. LOGIC THỜI GIAN (TEMPORAL ENGINE)
- Nếu user cung cấp mốc thời gian (VD: "bắt đầu từ ngày mai") → PHẢI suy luận thành ngày cụ thể.
- Nếu KHÔNG có mốc → MẶC ĐỊNH bắt đầu từ ngày hiện tại (${today}).
- Deadline phải tuân theo: TASK sau KHÔNG ĐƯỢC có deadline trước TASK trước. Các TASK cách nhau hợp lý (1–5 ngày tùy độ phức tạp).
- Định dạng ngày: DD/MM/YYYY

5. PHÂN VAI ĐỘNG (DYNAMIC ASSIGNEE ENGINE)
- PHẢI phân tích hồ sơ để trích xuất các vai trò (Ví dụ: "Giám đốc", "Luật sư", "Kế toán", "Nguyên đơn", "Bị đơn")
- Nếu xác định được: Gán đúng người phù hợp với nhiệm vụ.
- Nếu KHÔNG rõ: Ghi: "Chưa phân công"
- NGHIÊM CẤM: Gán bừa vai trò không tồn tại trong hồ sơ.

6. LEGAL NOTES (PHÂN TÍCH PHÁP LÝ)
- Mỗi TASK BẮT BUỘC có: Căn cứ pháp luật (VD: BLDS 2015, Nghị định 13/2023…) và Rủi ro pháp lý nếu không thực hiện đúng.

II. FORMAT OUTPUT (KHÓA CỨNG)
CHỈ TRẢ VỀ JSON THUẦN. KHÔNG markdown, KHÔNG giải thích, KHÔNG text ngoài JSON.
Cấu trúc:
[
  {
    "id": 1,
    "phase": "Chuẩn bị",
    "title": "Tên hành động vi mô cụ thể",
    "legal_notes": "Căn cứ pháp lý + rủi ro",
    "assignee": "Vai trò hoặc Chưa phân công",
    "deadline": "DD/MM/YYYY",
    "status": "pending"
  }
]

III. THỨ TỰ THỰC HIỆN NỘI BỘ (CHAIN-OF-REASONING – KHÔNG IN RA)
Phân tích hồ sơ -> Trích xuất vai trò -> Xây dựng timeline -> Chia phase -> Sinh task vi mô -> Gán deadline -> Gán assignee -> Thêm legal_notes -> SELF-CHECK số lượng task -> Xuất JSON.
`;

        const responseText = await getActiveModel(prompt);
        const cleanedText = cleanAIJsonString(responseText);
        const planningResult = JSON.parse(cleanedText);

        await logUsage('PLANNING');
        return planningResult;

    } catch (error) {
        console.error("Lỗi lập kế hoạch:", error);
        return [
            {
                "id": 1,
                "phase": "Thông báo",
                "title": "Không thể khởi tạo lộ trình",
                "legal_notes": "Hệ thống AI đang bận hoặc hồ sơ phân tích quá phức tạp. Vui lòng thử lại với yêu cầu ngắn gọn hơn.",
                "assignee": "Hệ thống",
                "deadline": "N/A",
                "status": "pending"
            }
        ];
    }
}
// ==============================================================================
// HÀM PHÂN TÍCH VIDEO (VIDEO ANALYSIS) - V2.0
// ==============================================================================
async function analyzeVideo(videoUrl) {
    try {
        // 1. Lấy transcript 
        const standardUrl = normalizeYouTubeUrl(videoUrl);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(standardUrl);

        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('Không tìm thấy phụ đề cho video này.');
        }

        const transcript = transcriptItems.map(item => item.text).join(' ').trim();
        if (!transcript) {
            throw new Error('Phụ đề video không có nội dung hợp lệ.');
        }

        // Lấy thời gian thực tế tiêm vào Prompt để AI nhận thức năm hiện hành
        const currentYear = new Date().getFullYear();

        // 2.  PROMPT 
        const prompt = `
SYSTEM PROMPT: LEGAL VIDEO AUDIT MASTER (VIETNAM)
Bạn là LegAI - Hệ thống Kiểm toán Pháp lý Video cấp cao tại Việt Nam.

⏳ NHẬN THỨC THỜI GIAN & BỐI CẢNH
- Thời điểm hiện tại: Năm ${currentYear}
- LƯU Ý ĐẶC BIỆT VỀ VIDEO NGẮN (SHORTS/TIKTOK): Đa số transcript là từ video ngắn mang tính chất "kiến thức nhanh". 
- TUYỆT ĐỐI KHÔNG trừ điểm hoặc gắn mác "Lùa gà" chỉ vì video giải thích tóm tắt, dùng từ ngữ dân dã, hoặc không đọc chính xác từng Điều/Khoản luật. 
- Miễn là BẢN CHẤT PHÁP LÝ ĐÚNG và không xúi giục vi phạm, video đó vẫn được đánh giá là "Đáng tin cậy" và xứng đáng đạt Trust Score cao (80-100).

 QUY TRÌNH SUY LUẬN (CHAIN-OF-THOUGHT BẮT BUỘC)
Bạn PHẢI TUÂN THỦ CHÍNH XÁC THỨ TỰ SAU:
1. Trích xuất nội dung: Vấn đề pháp lý cốt lõi video đang truyền tải là gì?
2. Kiểm tra tính hợp lệ: Đánh giá nội dung truyền tải có đúng bản chất pháp luật hiện hành (năm ${currentYear}) không.
3. Phát hiện Red Flags: CHỈ gắn Red Flag nếu video CỐ TÌNH tư vấn sai, hướng dẫn lách luật trái phép, lừa đảo, hoặc áp dụng luật cũ làm sai lệch hoàn toàn bản chất vụ việc.
4. Đánh giá rủi ro và CHẤM ĐIỂM TRUST SCORE (0-100):
   + Truyền tải đúng bản chất pháp lý (dù giải thích vắn tắt): 75 - 100.
   + Có thiếu sót, mập mờ dễ gây hiểu lầm nhẹ: 50 - 70.
   + Sai luật nghiêm trọng, xúi giục lách luật, lừa đảo: ≤ 40.

📦 ĐỊNH DẠNG OUTPUT (KHÓA CỨNG JSON)
Bạn CHỈ ĐƯỢC TRẢ VỀ JSON HỢP LỆ DUY NHẤT theo cấu trúc dưới đây. 
NGHIÊM CẤM bỏ sót bất kỳ key nào. NGHIÊM CẤM bọc JSON trong Markdown (\`\`\`json).

{
  "summary": "### Tổng quan\\nTóm tắt nội dung video.\\n\\n### Đánh giá tín nhiệm\\n[Đáng tin cậy / Có sạn cần lưu ý / Rất rủi ro (Lùa gà)]\\n\\n### Cảnh báo (Red Flags)\\n**1.** [Không có / Ghi chi tiết cảnh báo nếu có]",
  "trustScore": 85,
  "legal_map": [
    {
      "law_name": "Tên luật / Nghị định liên quan đến chủ đề",
      "article": "Điều khoản (nếu rõ, hoặc ghi 'Quy định chung')",
      "status": "Đúng / Sai / Lỗi thời"
    }
  ],
  "action_plan": [
    {
      "step": 1,
      "action": "Khuyến nghị hành động cụ thể cho người xem"
    }
  ]
}

NỘI DUNG PHỤ ĐỀ (TRANSCRIPT) CẦN KIỂM TOÁN:
"""${transcript}"""
`;
        // 3. GỌI HÀM SINH TEXT TỪ GEMINI
        const responseText = await getActiveModel(prompt);

        // 4. BÓC TÁCH JSON
        const cleanedText = cleanAIJsonString(responseText);
        let result = JSON.parse(cleanedText);

        // Đảm bảo tương thích với chuẩn Controller & DB
        result.transcript = transcript;
        result.raw_transcript = transcript;
        result.legalBases = result.legal_map; // Map sang đúng biến mà Controller đang dùng

        await logUsage('VIDEO_ANALYSIS');
        return result;
    } catch (error) {
        console.error(" Lỗi phân tích video:", error.message || error);
        throw new Error(error.message || "Không thể phân tích video lúc này.");
    }
}

// ==============================================================================
//  HÀM CHAT 
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = []) {
    console.log(">>> v2.0");
    try {
        const contextText = documents.length > 0
            ? documents.map((doc, index) => {
                const title = doc.title || doc.van_ban || "Tài liệu chưa rõ tiêu đề";
                const detail = doc.dieu ? `(Điều ${doc.dieu})` : "";


                let rawContent = doc.content || doc.noi_dung_tom_tat || "Không có nội dung chi tiết";
                const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent;

                return `[TÀI LIỆU ${index + 1}]: ${title} ${detail}\nNội dung: ${content}`;
            }).join("\n\n")
            : "Không có dữ liệu văn bản cụ thể. Hãy trả lời dựa trên kiến thức pháp luật chung.";

        // XỬ LÝ LỊCH SỬ CHAT
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Đây là câu hỏi đầu tiên, chưa có lịch sử trò chuyện.";

        const prompt = `
# VAI TRÒ: 
Bạn là LegAI - Hệ thống Trí tuệ Nhân tạo Pháp luật cao cấp tại Việt Nam. 

Bạn được kết nối với hệ thống cơ sở dữ liệu pháp luật hiện hành được cập nhật liên tục của LegAI.

# DỮ LIỆU ĐƯỢC CUNG CẤP:
${contextText}

# LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:
${historyText}

# YÊU CẦU TRẢ LỜI CÂU HỎI MỚI NHẤT: "${userQuestion}"

# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):

- CẤM BỊA ĐẶT SỐ LIỆU: Tuyệt đối KHÔNG tự ý đưa ra một con số cụ thể về số lượng văn bản (Ví dụ: Cấm nói "Tôi có 486 văn bản"). 
- GIẢI THÍCH SAI LỆCH: Nếu người dùng hỏi về các con số hiển thị trên giao diện (ví dụ: số lượng bộ luật), hãy trả lời rằng dữ liệu được đồng bộ và cập nhật liên tục, thông tin hiển thị trên màn hình Tra cứu chính là con số mới nhất.
-  NGUYÊN TẮC ƯU TIÊN: Nếu người dùng vừa chào hỏi, 
vừa đưa ra tình huống pháp lý => BẮT BUỘC PHẢI CHỌN [KỊCH BẢN 3].
Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" để xếp vào ĐÚNG MỘT TRONG BA kịch bản dưới đây:

**[KỊCH BẢN 1]: GIAO TIẾP & HỎI THÔNG TIN VỀ AI**
- Áp dụng khi: Người dùng chào hỏi, cảm ơn, hỏi thăm, HOẶC hỏi về chức năng, khả năng, số lượng văn bản, thông tin của hệ thống LegAI.

- Phản hồi: Trả lời tự nhiên, thân thiện nhưng ngắn gọn và khiêm tốn. Không dài dòng khoe khoang tính năng.
- Cấu trúc: Dùng văn xuôi bình thường. TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 2]: CÂU HỎI NGOÀI CHUYÊN MÔN / VI PHẠM ĐẠO ĐỨC**
- Áp dụng khi: Hỏi về toán học, code lập trình, giải trí... HOẶC nhờ hướng dẫn lách luật, trốn thuế, hành vi vi phạm pháp luật.
- Phản hồi: Lịch sự từ chối bằng 1 đoạn ngắn gọn.
- Cấu trúc: TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 3]: CÂU HỎI TƯ VẤN PHÁP LÝ CỤ THỂ**
- Áp dụng khi: Hỏi về tình huống pháp lý, tra cứu luật, điều kiện, thủ tục...
- Quy tắc:
  1. KHÔNG chào hỏi dư thừa. ĐI THẲNG VÀO PHẦN KẾT LUẬN.
  2. KHÔNG trả về định dạng mảng (Array) hay JSON. Nếu cần liệt kê, hãy dùng Markdown (bullet points).
  3. KHÔNG dùng cụm từ "Dựa trên tài liệu cung cấp". Trả lời tự tin dựa trên dữ liệu.
- Cấu trúc bắt buộc:
   **Kết luận:** (Ngắn gọn 1-2 câu trả lời thẳng vấn đề).
   **Phân tích:** (Giải thích logic pháp lý bằng các đoạn văn/gạch đầu dòng dễ hiểu).
   **Cơ sở pháp lý:** (Trích dẫn chính xác Điều, Khoản, Tên văn bản).
   **Lời khuyên:** (Hướng dẫn hành động cho người dùng).

**[KỊCH BẢN 4]: DỮ LIỆU KHÔNG ĐỦ HOẶC CÂU HỎI QUÁ PHỨC TẠP**
- Nếu dữ liệu [TÀI LIỆU] được cung cấp không liên quan đến câu hỏi, hoặc câu hỏi yêu cầu tư vấn tình huống thực tế cực kỳ lắt léo mà AI không thể chắc chắn 100%.
- **PHẢN HỒI:** Trả về duy nhất chuỗi ký tự: [CONTACT_LAWYER]
- Tuyệt đối không giải thích, không xin lỗi, chỉ trả về đúng mã code đó.


# ĐỊNH DẠNG ĐẦU RA:
- Trả về NỘI DUNG TRỰC TIẾP, TUYỆT ĐỐI KHÔNG bọc trong bất kỳ object JSON nào (Cấm dùng { "answer": "..." }).
- CHỈ sử dụng văn bản thuần túy và Markdown để in đậm/in nghiêng. 
- Sử dụng dấu xuống dòng để chia đoạn rõ ràng.
-  KHÔNG dùng ngoặc nhọn {}.
- CHỈ TRẢ VỀ VĂN BẢN (TEXT).
---
---
*Lưu ý: Nếu câu trả lời thuộc [KỊCH BẢN 3], 
bắt buộc thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ
 mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*`;

        const responseText = await getActiveModel(prompt);
        await logUsage('CHATBOT');
        return responseText;

    } catch (error) {
        console.error(" Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "LegAI đang quá tải. Vui lòng thử lại sau một lát.";
    }
}

// ==============================================================================
// DANH MỤC PHÂN LOẠI & HÀM CLASSIFY 
// ==============================================================================
const VALID_CATEGORIES = [
    "Bộ máy hành chính", "Tài chính nhà nước", "Văn hóa - Xã hội", "Tài nguyên - Môi trường",
    "Bất động sản", "Xây dựng - Đô thị", "Thương mại", "Thể thao - Y tế", "Giáo dục",
    "Thuế - Phí - Lệ phí", "Giao thông - Vận tải", "Lao động - Tiền lương", "Công nghệ thông tin",
    "Đầu tư", "Doanh nghiệp", "Xuất nhập khẩu", "Sở hữu trí tuệ", "Tiền tệ - Ngân hàng",
    "Bảo hiểm", "Thủ tục Tố tụng", "Hình sự", "Dân sự", "Chứng khoán", "Lĩnh vực khác"
];

async function classifyCategoryWithAI(title) {
    const prompt = `
    Bạn là một chuyên gia pháp luật Việt Nam cấp cao. 
    Nhiệm vụ: Phân loại văn bản dựa trên tiêu đề vào MỘT TRONG các nhóm sau: [${VALID_CATEGORIES.join(", ")}].
    
    Quy tắc:
    1. Chỉ trả về đúng tên nhóm trong danh sách trên.
    2. Nếu tiêu đề mang tính chất chung chung về xử phạt hoặc tổ chức bộ máy, chọn "Bộ máy hành chính".
    3. Nếu không chắc chắn, chọn "Lĩnh vực khác".
    
    Tiêu đề văn bản: "${title}"
    Kết quả:`;

    try {


        const rawResponse = await generateAnswerWithGemini(prompt);

        // Xử lý chuỗi trả về (trim và xóa các ký tự thừa nếu AI lỡ trả về dấu nháy)
        const category = rawResponse.trim().replace(/[".*]/g, "");

        // Kiểm tra xem AI trả lời có nằm trong danh sách không
        const finalCategory = VALID_CATEGORIES.includes(category) ? category : "Lĩnh vực khác";

        return finalCategory;
    } catch (error) {
        console.error("Lỗi AI phân loại nội tuyến:", error.message);
        return "Lĩnh vực khác"; // Fallback an toàn
    }
}
module.exports = {
    getActiveModel,
    generateAnswerWithGemini,
    analyzeContract,
    generateForm,
    generatePlan,
    analyzeVideo,
    classifyCategoryWithAI
};