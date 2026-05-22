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
const ragService = require('./ragService');
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

    // 1. Xử lý thô: Khử sạch các khối mã markdown (json, html, hoặc cặp ```)
    let cleaned = rawString
        .replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();

    // 2. PHẪU THUẬT CHÍNH: Tìm và trích xuất khối JSON thực sự nằm giữa cặp ngoặc [] hoặc {}
    const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);

    if (!jsonMatch) {
        console.warn(" ⚠️ AI không trả về định dạng JSON chuẩn:", cleaned);
        return cleaned.startsWith('[') ? "[]" : "{}";
    }

    let jsonString = jsonMatch[0];

    // 3. BỌC THÉP CHUYÊN SÂU CHỐNG LỖI CONTROL CHARACTER:
    // Chỉ xử lý các ký tự điều khiển \n, \r, \t NẰM TRONG cặp dấu nháy kép của giá trị chuỗi JSON
    let insideString = false;
    let bockThepString = "";

    for (let i = 0; i < jsonString.length; i++) {
        let char = jsonString[i];

        // Phát hiện xem có đang nằm trong chuỗi văn bản nháy kép hay không
        if (char === '"' && jsonString[i - 1] !== '\\') {
            insideString = !insideString;
            bockThepString += char;
            continue;
        }

        if (insideString) {
            // Nếu đang nằm trong chuỗi nháy kép thì mới escape ký tự ngắt dòng vật lý
            if (char === '\n') bockThepString += '\\n';
            else if (char === '\r') bockThepString += '\\r';
            else if (char === '\t') bockThepString += '\\t';
            else bockThepString += char;
        } else {
            // Nếu nằm ngoài chuỗi (khoảng trắng cấu trúc JSON), giữ nguyên
            bockThepString += char;
        }
    }
    jsonString = bockThepString;

    // 4. CỨU VIỆN PHÁT HIỆN LỖI VỊ TRÍ ĐẦU CHUỖI VÀ KÝ TỰ VÔ HÌNH
    jsonString = jsonString
        .replace(/^\{\s*\,/, '{')  // Khử lỗi dạng {, "key": ...}
        .replace(/^\[\s*\,/, '[')  // Khử lỗi dạng [, {"key": ...}
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Khử sạch các ký tự vô hình gây lỗi parse
        .trim();

    return jsonString;
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
// HÀM GIÚP SOẠN THẢO SIÊU CHỈ THỊ CHỐNG ẢO GIÁC CHO CÁC HÀM RIÊNG BIỆT
// ==============================================================================
function buildStrictContextText(documents) {
    if (!documents || documents.length === 0) return "Hoàn toàn không có dữ liệu RAG xác thực.";
    return documents.map((doc, index) => {
        const title = doc.title || "Văn bản pháp luật";
        let rawContent = doc.content || doc.noi_dung_tom_tat || "";
        const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent;
        return `--- VÙNG DỮ LIỆU XÁC THỰC MỤC ${index + 1} ---
VĂN BẢN QUY CHIẾU: ${title}
ĐIỀU KHOẢN: Điều ${doc.dieu || "Chưa rõ"}
NỘI DUNG THỰC TẾ: ${content}
--- KẾT THÚC VÙNG DỮ LIỆU MỤC ${index + 1} ---`;
    }).join("\n\n");
}
// =============================================================================
// SIÊU CHỈ THỊ VÀ QUY TẮC TRUY XUẤT PHÁP LÝ 
// =============================================================================
const SYSTEM_LAW_INSTRUCTION = `
Bạn là Trợ lý Pháp lý AI cao cấp của hệ thống Legal AI . 
Nhiệm vụ của bạn là đưa ra câu trả lời, biểu mẫu, lộ trình hoặc kết quả kiểm toán có độ chính xác tuyệt đối (Deterministic).

# QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ (Áp dụng NGHIÊM NGẶT theo thứ tự sau):

=================================================
[ƯU TIÊN 1: RAG NỘI BỘ LEGAI]
Nếu dữ liệu RAG chứa thông tin liên quan trực tiếp đến câu hỏi hoặc hồ sơ.
THÌ:
- Chỉ trích xuất đúng nội dung có trong ranh giới vùng dữ liệu xác thực được cung cấp.
- Không suy diễn thêm khung phạt hoặc tình tiết tăng nặng ngoài dữ liệu thô.
- NẾU một Điều luật xuất hiện trong dữ liệu nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống. Nghiêm cấm tự ý bổ sung từ kiến thức nền.

=================================================
[ƯU TIÊN 2: GOOGLE SEARCH GROUNDING CÓ GIỚI HẠN]
Nếu dữ liệu RAG nội bộ chưa đủ thông tin hoặc người dùng yêu cầu liệt kê chi tiết điều khoản mục nhỏ mà RAG bị cắt đoạn (chunking) khuyết thiếu:
Bạn ĐƯỢC PHÉP sử dụng công cụ tìm kiếm tích hợp để bổ sung dữ liệu.
CHỈ được lấy dữ liệu từ các nguồn chính thống sau:
- vbpl.vn
- thuvienphapluat.vn
Nếu tìm thấy dữ liệu trên hai nguồn này, bắt buộc phải trích rõ nguồn văn bản gốc.

=================================================
[ƯU TIÊN 3: TRI THỨC NỘI TẠI CÓ KIỂM SOÁT]
Nếu cả RAG nội bộ và Search grounding đều không có kết quả:
- Được phép dùng tri thức nội tại của hệ thống CHỈ để giải thích khái niệm hoặc định hướng tổng quan, dẫn dắt đến các nguyên tắc phổ biến (Luật Dân sự, Luật Doanh nghiệp, Luật SHTT).
- ĐƯỢC PHÉP: Trích dẫn các điều luật cơ bản, nổi tiếng nếu chắc chắn đúng 100%.
- TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý TẠO RA: Số hiệu văn bản giả lập, các Khoản/Điểm bị khuyết, mức phạt bằng tiền cụ thể hoặc số năm tù cụ thể.

[QUY TẮC AN TOÀN KHI SỬ DỤNG DỮ LIỆU INTERNET]
- MỤC ĐÍCH DUY NHẤT: Cập nhật các thông số mới nhất (tỷ lệ %, mức phạt, tên văn bản luật, chỉ thị mới ra đời trong năm 2025-2026).
- CẤM SAO CHÉP THỂ THỨC: TUYỆT ĐỐI KHÔNG được sao chép cấu trúc, văn phong, hay các mẫu biểu trôi nổi trên các trang blog luật sư, trang tin tức hoặc diễn đàn.
- BẢO TOÀN KIẾN TRÚC VĂN BẢN: Dữ liệu tìm kiếm được chỉ dùng làm "Nguyên liệu". Bạn phải tự ráp nguyên liệu đó vào cấu trúc chuẩn của một văn bản pháp lý/hành chính chuyên nghiệp. Trình bày rành mạch, không chèn các đường link báo mạng rác.
- ANTI-BRACKET WARNING: Tuyệt đối KHÔNG sử dụng các dấu ngoặc vuông [] trong nội dung văn bản chữ của các trường để tránh làm hỏng cấu trúc hiển thị.
`;
// =============================================================================
// HÀM ĐIỀU PHỐI TỔNG CHỐNG ẢO GIÁC & NÉ NGHẼN MẠCH 503 (DYNAMIC HYBRID ROUTING)
// =============================================================================
async function getActiveModel(userPrompt, isJson = false, relatedDocs = [], forceSearch = false, useProModel = false) {
    const apiKey = process.env.GEMINI_API_KEY || SystemConfig?.geminiApiKey;
    const preferredModel = SystemConfig?.geminiModel;
    const temp = SystemConfig?.temperature || 0.1;

    if (!apiKey) throw new Error("Chưa có API Key trong hệ thống!");

    const genAI = new GoogleGenerativeAI(apiKey);

    // 1. PHÂN TÍCH NGỮ CẢNH ĐỂ ĐIỀU HƯỚNG BẬT/TẮT GOOGLE SEARCH CHỦ ĐỘNG
    let enableGoogleSearch = false;
    let ragContext = "";

    if (relatedDocs && relatedDocs.length > 0) {
        ragContext = buildStrictContextText(relatedDocs);

        // CHIẾN THUẬT KIỂM TRA BIÊN CHẶT CHẼ TRÁNH LỖI CHUNKING ĐỨT ĐOẠN ĐIỀU/KHOẢN THỜI SỰ
        const lowercasePrompt = userPrompt.toLowerCase();
        const isDetailRequired = lowercasePrompt.includes("chi tiết") ||
            lowercasePrompt.includes("điều") ||
            lowercasePrompt.includes("khoản") ||
            lowercasePrompt.includes("mục nhỏ") ||
            lowercasePrompt.includes("mức phạt") ||
            lowercasePrompt.includes("phạt tiền") ||
            lowercasePrompt.includes("bao nhiêu tiền") ||
            lowercasePrompt.includes("mới nhất") ||
            lowercasePrompt.includes("2025") ||
            lowercasePrompt.includes("2026") ||
            lowercasePrompt.includes("nghị định") ||
            lowercasePrompt.includes("luật số");

        // BỘ LỌC CHẤT LƯỢNG NGỮ CẢNH: Nếu cần số liệu chi tiết sâu nhưng RAG bốc về bị hụt phân đoạn (< 3500 ký tự)
        // Hoặc khi có cờ ép buộc mở mạng (forceSearch = true)
        if (forceSearch || (isDetailRequired && ragContext.length < 3500)) {
            console.log(` ⚠️ [LEG_AI ROUTER]: RAG nội bộ bị giới hạn phân đoạn (${ragContext.length} ký tự). Tự động mở van Google Search Grounding để vá dữ liệu chi tiết.`);
            enableGoogleSearch = true;
        } else {
            console.log(`[LEG_AI ROUTER]: RAG nội bộ đáp ứng tốt (${relatedDocs.length} Chunks, ${ragContext.length} ký tự). KHÓA CHẶT Google Search để tối ưu Rate Limit.`);
            enableGoogleSearch = false;
        }
    } else {
        console.log("[LEG_AI ROUTER]: Kho RAG nội bộ trống! Chuyển trạng thái sang Google Grounding làm khiên dự phòng.");
        enableGoogleSearch = true;
    }

    const compiledPrompt = `
    ${SYSTEM_LAW_INSTRUCTION}
    
    NGỮ CẢNH DỮ LIỆU RAG NỘI BỘ ĐƯỢC CUNG CẤP:
    ---
    ${ragContext || "Không có dữ liệu RAG phù hợp trong kho lưu trữ nội bộ."}
    ---
    
    YÊU CẦU NGHIỆP VỤ CỦA NGƯỜI DÙNG: "${userPrompt}"
    `;

    // 2. PHÂN BỔ HÀNG ĐỢI MODEL THÔNG MINH
    let fastQueue = useProModel
        ? ["models/gemini-2.5-pro", "models/gemini-3.1-pro-preview", preferredModel, "models/gemini-pro-latest", "models/gemini-2.5-flash"]
        : ["models/gemini-2.5-flash", "models/gemini-3.1-flash-lite", preferredModel, "models/gemini-2.0-flash", "models/gemini-2.0-flash-lite"];

    fastQueue = [...new Set(fastQueue)].filter(Boolean);

    for (const modelName of fastQueue) {
        try {
            console.log(`  Đang gọi: ${modelName} | Grounding (Search): ${enableGoogleSearch}`);

            const modelConfig = {
                model: modelName,
                systemInstruction: SYSTEM_LAW_INSTRUCTION
            };

            if (enableGoogleSearch) {
                modelConfig.tools = [{ googleSearch: {} }];
            }

            const model = genAI.getGenerativeModel(modelConfig);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), 45000)
            );

            const generationConfig = { temperature: temp, topP: 0.8 };
            // CHÚ Ý AN TOÀN: Không gửi responseMimeType JSON khi đang bật tools Google Search
            if (isJson && !enableGoogleSearch) {
                generationConfig.responseMimeType = "application/json";
            }

            const apiPromise = model.generateContent({
                contents: [{ role: "user", parts: [{ text: compiledPrompt }] }],
                generationConfig
            });

            const result = await Promise.race([apiPromise, timeoutPromise]);

            if (result && result.response) {
                const text = result.response.text();
                if (text) {
                    console.log(`  ${modelName} phản hồi thành công!`);
                    return text;
                }
            }
        } catch (error) {
            const msg = (error.message || "").toString();
            console.warn(` ⚠️ ${modelName} thất bại:`, msg.split('\n')[0]);

            if (msg === "TIMEOUT_EXCEEDED") continue;

            // MẠNG LƯỚI PHÒNG THỦ CẤP TỐC: Nếu dính lỗi overload 503 hoặc 429 khi bật Search, lập tiếp tục ngắt Search chạy bằng Tri thức nền LLM
            if (enableGoogleSearch && (msg.includes("503") || msg.includes("429") || msg.includes("demand"))) {
                try {
                    console.warn("🔄 : Mạng Google nghẽn (503/429)! Ngắt kết nối Search, ép chạy bằng Tri thức nền LLM...");
                    const fallbackModel = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash", systemInstruction: SYSTEM_LAW_INSTRUCTION, tools: [] });
                    const fallbackResult = await fallbackModel.generateContent({
                        contents: [{ role: "user", parts: [{ text: compiledPrompt }] }],
                        generationConfig: { temperature: temp, responseMimeType: isJson ? "application/json" : undefined }
                    });
                    return fallbackResult.response.text();
                } catch (fbErr) {
                    console.error("🛑 Sập toàn diện hệ thống AI tầng cuối:", fbErr.message);
                    throw fbErr;
                }
            }

            if (msg.includes("400") || msg.toLowerCase().includes("response mime type")) throw error;
            continue;
        }
    }
    throw new Error("Tất cả model đều từ chối hoặc hết hạn mức.");
}
// ==============================================================================
//  1. HÀM CHAT BOT AI
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = []) {
    console.log(">>> V4.1 -  chống ảo giác");
    try {
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử trò chuyện.";

        const prompt = `
# VAI TRÒ: 
Bạn là LegAI - Hệ thống Trí tuệ Nhân tạo Pháp luật cao cấp tại Việt Nam. 

Bạn được kết nối với hệ thống dữ liệu pháp luật của LegAI.

# SIÊU CHỈ THỊ TUYỆT ĐỐI KHÔNG ẢO GIÁC (STRICT RAG BOUNDARY):
1. Bạn CHỈ ĐƯỢC PHÉP sử dụng thông tin văn bản nằm TRONG vùng ranh giới "NỘI DUNG THỰC TẾ TRONG BỘ NHỚ PINECONE" được cung cấp ở bên dưới.
2. NẾU một Điều luật xuất hiện trong dữ liệu nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống. 
3. NGHIÊM CẤM tuyệt đối việc tự ý sử dụng trí nhớ nội tại hoặc kiến thức nền của bạn để tự động bổ sung, điền thêm, hoặc hoàn thiện các Khoản/Điểm/Mức hình phạt bị khuyết từ RAG.
4. Nếu câu hỏi của người dùng hỏi trúng vào phần dữ liệu bị khuyết hoặc không có trong ranh giới xác thực,
"LUÔN ƯU TIÊN TRÍCH DẪN ĐIỀU LUẬT CỤ THỂ. NẾU CÂU TRẢ LỜI CỦA BẠN KHÔNG CÓ TRÍCH DẪN ĐIỀU KHOẠN, HỆ THỐNG SẼ ĐÁNH GIÁ LÀ CHẤT LƯỢNG KÉM."
.

# LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:
${historyText}

# YÊU CẦU TRẢ LỜI CÂU HỎI MỚI NHẤT: "${userQuestion}"

# QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ (Áp dụng NGHIÊM NGẶT theo thứ tự sau):

=================================================
[ƯU TIÊN 1: RAG NỘI BỘ LEGAI]
Nếu dữ liệu RAG chứa thông tin liên quan trực tiếp đến câu hỏi.
THÌ:
- Chỉ trích xuất đúng nội dung có trong ranh giới.
- Không suy diễn thêm khung phạt hoặc tình tiết tăng nặng ngoài dữ liệu.

=================================================
[ƯU TIÊN 2: GOOGLE SEARCH GROUNDING CÓ GIỚI HẠN]
Trường hợp dữ liệu RAG nội bộ bị khuyết hoặc thiếu thông tin chi tiết về số Điều/Khoản người dùng hỏi, và hệ thống đã kích hoạt mở cổng kết nối mạng:
- Hãy sử dụng công cụ Tìm kiếm để càn quét văn bản pháp luật gốc.
- CHỈ được lấy dữ liệu đáng tin cậy từ 2 nguồn: "vbpl.vn" hoặc "thuvienphapluat.vn".
- Nếu tìm thấy, phải trích xuất rõ ràng: Tên văn bản, Số hiệu văn bản, nội dung chi tiết của Điều, Khoản, Điểm đó.
=================================================
[ƯU TIÊN 3: TRI THỨC NỘI TẠI CÓ KIỂM SOÁT]
Nếu: RAG không có VÀ Search grounding không có.
Được phép dùng tri thức nội tại CHỈ ĐỂ dẫn dắt đến các nguyên tắc pháp lý hoặc điều luật phổ biến (ví dụ: Luật Dân sự, Luật SHTT).
ĐƯỢC PHÉP: Trích dẫn các điều luật cơ bản, nổi tiếng nếu chắc chắn đúng 100%.
TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ TẠO:
✗ Số hiệu văn bản
✗ Các Khoản/Điểm bị khuyết
✗ Mức tiền phạt hoặc số năm tù cụ thể

=================================================
[ƯU TIÊN 4: THIẾU THÔNG TIN]
Nói rõ người dùng cần cung cấp thêm hồ sơ thực tế hoặc tình huống cụ thể.

# KIỂM TRA PHÁP LÝ TRƯỚC KHI TRẢ LỜI (SELF-CHECK NỘI BỘ)
Hãy đối chiếu câu trả lời dự định của bạn với phần dữ liệu thô:
- Phần mức phạt, số năm tù này có nằm trong chữ nghĩa của RAG cung cấp không? -> Nếu không có: BẮT BUỘC loại bỏ, không đưa vào câu trả lời như một sự thật.

# QUY TẮC XỬ LÝ NGỮ CẢNH:
- Nếu người dùng dùng các từ thay thế như "luật đó", "ông ấy", "quy định này", hãy nhìn vào LỊCH SỬ TRÒ CHUYỆN để biết họ đang nói về cái gì.
- Tuyệt đối không được hỏi lại "Luật nào?" nếu lịch sử đã có tên luật.

# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):
- CẤM BỊA ĐẶT SỐ LIỆU: Tuyệt đối KHÔNG tự ý đưa ra một con số cụ thể về số lượng văn bản trên hệ thống. 
- NGUYÊN TẮC ƯU TIÊN: Nếu người dùng vừa chào hỏi, vừa đưa ra tình huống pháp lý => BẮT BUỘC PHẢI CHỌN [KỊCH BẢN 3].
Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" để xếp vào ĐÚNG MỘT TRONG BA kịch bản dưới đây:

**[KỊCH BẢN 1]: GIAO TIẾP & HỎI THÔNG TIN VỀ AI**
- Áp dụng khi: Hỏi thăm, chào hỏi, hoặc hỏi về chức năng của LegAI.
- Phản hồi: Trả lời tự nhiên, thân thiện nhưng ngắn gọn và khiêm tốn. Không dài dòng.
- Cấu trúc: Dùng văn xuôi bình thường. TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 2]: CÂU HỎI NGOÀI CHUYÊN MÔN / VI PHẠM ĐẠO ĐỨC**
- Áp dụng khi: Hỏi code, toán học, giải trí, hoặc nhờ hướng dẫn lách luật, trốn thuế...
- Phản hồi: Lịch sự từ chối bằng 1 đoạn ngắn gọn.
- Cấu trúc: TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 3]: CÂU HỎI TƯ VẤN PHÁP LÝ CỤ THỂ**
- Áp dụng khi: Dữ liệu RAG có đầy đủ thông tin để trả lời chắc chắn (tình huống pháp lý, tra cứu luật, điều kiện, thủ tục...).
- Quy tắc:
  1. KHÔNG chào hỏi dư thừa. ĐI THẲNG VÀO PHẦN KẾT LUẬN.
  2. KHÔNG trả về JSON hoặc Array. Dùng Markdown.
  3. KHÔNG dùng cụm "Dựa trên tài liệu". Trả lời tự tin.
- Cấu trúc bắt buộc:
   **Kết luận:** (Ngắn gọn 1-2 câu).
   **Phân tích:** (Giải thích logic bằng các đoạn văn/gạch đầu dòng).
   **Cơ sở pháp lý:** (Trình bày liền mạch. Tuân thủ ngặt nghèo QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ ở trên.
   Trình bày rõ ràng: "Theo Điều X, Khoản Y của văn bản Z, quy định rằng: [Nội dung trích dẫn]".
    Tuyệt đối không được nói chung chung "theo luật hiện hành".
    TUYỆT ĐỐI KHÔNG ghi chú nguồn gốc như "Từ RAG" hay "Từ tri thức nội tại" vào câu trả lời).

   **Lời khuyên:** (Hướng dẫn hành động).

[KỊCH BẢN 4]: KHI DỮ LIỆU RAG KHÔNG ĐỦ/THIẾU CHI TIẾT

Áp dụng khi: Dữ liệu RAG không cung cấp đầy đủ Điều/Khoản hoặc thông tin bị khuyết.

BẮT BUỘC: Sử dụng [ƯU TIÊN 2: GOOGLE SEARCH] để tìm kiếm văn bản pháp luật gốc từ các trang chính thống (vbpl.vn, thuvienphapluat.vn).

Sau khi tìm thấy, phải trích dẫn Tên văn bản, Số hiệu, Điều, Khoản cụ thể.

Nếu sau khi đã tìm kiếm ở cả RAG và Google mà vẫn không có thông tin -> Mới được phép nói là hệ thống chưa cập nhật.

**[KỊCH BẢN 5]: YÊU CẦU CHỦ ĐỘNG GẶP LUẬT SƯ**
- Áp dụng khi: "Tôi muốn gặp luật sư", "Cần tư vấn trực tiếp".
- Phản hồi: Chào và nhả DUY NHẤT mã code: [CONTACT_LAWYER]
# ĐỊNH DẠNG ĐẦU RA (ĐỊNH KHUÂN CHUẨN FRONTEND):
- CHỈ TRẢ VỀ VĂN BẢN THUẦN (TEXT) DƯỚI DẠNG MARKDOWN. TUYỆT ĐỐI KHÔNG bọc trong object JSON.
- CẤM TUYỆT ĐỐI việc in các dòng chữ tiêu đề kỹ thuật như "[KỊCH BẢN 1]", "[KỊCH BẢN 3]", "[KỊCH BẢN 4]" vào nội dung câu trả lời gửi về cho người dùng. Người dùng không được phép nhìn thấy các nhãn phân loại này.
- Đi thẳng vào nội dung câu trả lời (Kết luận, Phân tích... đối với Kịch bản 3, hoặc đoạn văn từ chối đối với Kịch bản 4).
---
*Lưu ý: Nếu câu trả lời thuộc [KỊCH BẢN 3] hoặc [KỊCH BẢN 4], bắt buộc thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*
# KẾT THÚC CẤU TRÚC

`;

        const responseText = await getActiveModel(prompt, false, documents, false, false);

        console.log("--- [DEBUG] DỮ LIỆU THÔ TỪ AI TRƯỚC KHI XỬ LÝ ---");
        console.log(responseText);
        await logUsage('CHATBOT');
        return responseText;

    } catch (error) {
        console.error(" Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "Legal đang quá tải. Vui lòng thử lại sau một lát.";
    }
}


// ==============================================================================
// 2. HÀM PHÂN TÍCH HỢP ĐỒNG 
// ==============================================================================
async function analyzeContract(contractText, documents = [], isUserPreMasked = false) {
    try {

        const corePrompt = `
Bạn là AI Pháp lý LegAI, đóng vai Thẩm phán chuyên trách rà soát hợp đồng theo pháp luật Việt Nam.



────────────────────────────────────────────────────────────
[ SIÊU CHỈ THỊ TUYỆT ĐỐI KHÔNG ẢO GIÁC CHO AI (STRICT RAG BOUNDARY)]
────────────────────────────────────────────────────────────
1. Bạn CHỈ ĐƯỢC PHÉP sử dụng thông tin văn bản nằm TRONG vùng ranh giới "NGỮ CẢNH DỮ LIỆU RAG NỘI BỘ" được cung cấp ở cuối prompt hoặc kết quả tìm kiếm từ Google Search Grounding (nếu hệ thống mở cổng mạng).
2. NẾU một Điều luật xuất hiện trong dữ liệu RAG nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống RAG nội bộ. 
3. NGHIÊM CẤM tuyệt đối việc tự ý sử dụng trí nhớ nội tại hoặc kiến thức nền của bạn để tự động bổ sung, điền thêm, hoặc hoàn thiện các Khoản/Điểm/Mức hình phạt bị khuyết từ RAG.
4. LUÔN ƯU TIÊN TRÍCH DẪN ĐIỀU LUẬT CỤ THỂ (ĐIỀU, KHOẢN, ĐIỂM) TRONG TRƯỜNG 'legal_basis'. NẾU BÁO CÁO PHÂN TÍCH KHÔNG CÓ TRÍCH DẪN CHI TIẾT, HỆ THỐNG SẼ BỊ ĐÁNH GIÁ LÀ LỖI CHẤT LƯỢNG KÉM.

────────────────────────────────────────────────────────────
[ QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ KHI RÀ SOÁT]
────────────────────────────────────────────────────────────
- [ƯU TIÊN 1: RAG NỘI BỘ]: Nếu dữ liệu RAG chứa đầy đủ nội dung chi tiết số Điều/Khoản để đối chiếu với điều khoản rủi ro trong hợp đồng -> Trích xuất trực tiếp.
- [ƯU TIÊN 2: GOOGLE SEARCH GROUNDING CÓ GIỚI HẠN]: Trường hợp dữ liệu RAG nội bộ không cung cấp đầy đủ nội dung chi tiết của Điều/Khoản cần đối chiếu, hoặc thông tin bị khuyết -> Bạn BẮT BUỘC phải sử dụng công cụ Tìm kiếm để càn quét văn bản pháp luật gốc.
   + CHỈ ĐƯỢC PHÉP lấy dữ liệu đáng tin cậy từ 2 nguồn chính thống: "vbpl.vn" hoặc "thuvienphapluat.vn".
   + Sau khi tìm thấy qua Search, phải điền đầy đủ vào cấu trúc JSON: Tên văn bản, Số hiệu văn bản, nội dung chi tiết của Điều, Khoản, Điểm đó vào trường 'legal_basis'.

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
        // ────────────────────────────────────────────────────────────
        // GIAI ĐOẠN 1: GỌI MODEL FLASH CHẠY TẮT SEARCH ĐỂ LẤY KHUNG LỖI THÔ
        // ────────────────────────────────────────────────────────────
        console.log(" [PHASE 1]: Quét thô dữ liệu nặng (Ngắt Search để chống lỗi quá tải hạn mức 429)...");
        const firstResponse = await getActiveModel(corePrompt, true, documents, false, false);
        const cleanedFirstText = cleanAIJsonString(firstResponse);
        let finalResult = JSON.parse(cleanedFirstText);

        // ────────────────────────────────────────────────────────────
        // GIAI ĐOẠN 2: KÍCH HOẠT GOOGLE SEARCH GROUNDING CHO PROMPT SIÊU NHẸ
        // ────────────────────────────────────────────────────────────
        if (finalResult.analysis_report && finalResult.analysis_report.length > 0) {

            // Lọc ra danh sách các điều khoản lỗi viết gọn để chuẩn bị bọc gói search
            const targetRisks = finalResult.analysis_report.map((r, i) =>
                `[Rủi ro ${i + 1} - Trụ cột: ${r.pillar}]: "${r.clause}". Hiện trạng rủi ro: ${r.issue}`
            ).join("\n");

            console.log(" [LEG_AI ROUTER]: Hợp đồng dính rủi ro rà soát. Khởi động van Google Search Grounding với Prompt siêu nhẹ...");

            const searchPrompt = `
Bạn là trợ lý tra cứu luật chuyên nghiệp thuộc hệ thống LegAI HUB. 
Tôi có danh sách các điều khoản hợp đồng đang dính rủi ro pháp lý tại Việt Nam sau đây:
${targetRisks}

NHIỆM VỤ CỦA BẠN:
1. Bật tính năng kết nối mạng Google Search, truy cập trực tiếp vào các trang mạng chính thống chính xác cao như "vbpl.vn" hoặc "thuvienphapluat.vn".
2. Tra cứu chính xác số hiệu luật, số Điều, Khoản, Điểm và trích xuất nguyên văn dòng nội dung (reference_text) để làm căn cứ pháp lý xử lý các rủi ro trên (Đặc biệt chú ý Luật Thương mại 2005, Bộ luật Dân sự 2015, Luật Hàng không dân dụng và các luật áp dụng trong hợp đồng).
3. Đóng gói kết quả tìm kiếm trùng khớp theo mảng JSON thứ tự chính xác. Không được chứa chữ "N/A" hay "Tri thức nội tại" tại các trường số Điều/Khoản.

[OUTPUT FORMAT] - Trả về duy nhất mảng JSON cấu trúc sau, không kèm giải thích hay bọc markdown bừa bãi:
[
  {
    "law": "Tên văn bản luật tìm thấy kèm số hiệu văn bản chính xác",
    "article": "Điều ... Khoản ... Điểm ...",
    "confidence": "high",
    "reference_text": "Trích dẫn nguyên văn dòng chữ luật gốc làm bằng chứng đối chiếu"
  }
]
`;

            try {
                // Phóng prompt siêu nhẹ đi cào mạng bằng model Pro. Khắc chế 100% gậy 429!
                const searchResponse = await getActiveModel(searchPrompt, true, [], false, true); // forceProModel = true
                const cleanedSearchText = cleanAIJsonString(searchResponse);
                const webLegalBasisArray = JSON.parse(cleanedSearchText);

                // Vá dữ liệu bọc thép trực tiếp vào mảng báo cáo rủi ro ban đầu
                if (Array.isArray(webLegalBasisArray)) {
                    finalResult.analysis_report.forEach((report, idx) => {
                        if (webLegalBasisArray[idx]) {
                            console.log(`🎯 [VÁ DỮ LIỆU SUCCESS]: Đang ép dữ liệu luật mạng vào Trụ cột [${report.pillar}]`);
                            report.legal_basis = webLegalBasisArray[idx];
                        }
                    });
                }
            } catch (searchErr) {
                console.error("⚠️ [GROUNDING FAILOVER]: Cổng Search trực tuyến tạm thời nghẽn hạn mức minute, giữ cấu trúc tri thức nội tại cứu hộ.", searchErr.message);
            }
        }

        await logUsage('CONTRACT_REVIEW');

        // 🎯 LỖI SỬA ĂN TIỀN: Trả về đúng biến finalResult chứa trọn vẹn dữ liệu đã vá!
        return finalResult;

    } catch (error) {
        console.error("Lỗi phân tích hợp đồng:", error.message);

        // Trả về object chứa đầy đủ các trường fallback của JSON khi sập nguồn toàn cục
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
                    clause: "Lỗi API hệ thống",
                    issue: "Hệ thống đang quá tải hoặc kết nối cổng API bị gián đoạn.",
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
// 3. HÀM TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
async function generateForm(userInput, chatHistory = [], documents = []) {
    try {
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử.";

        const prompt = `
# VAI TRÒ:
Bạn là LegAI - Luật sư cấp cao và Trợ lý thông minh chuyên bóc tách dữ liệu để tự động soạn thảo Hợp Đồng pháp lý tại Việt Nam.

# QUY TẮC SOẠN THẢO NỘI DUNG (BẮT BUỘC TUÂN THỦ):
1. Văn phong: Trang trọng, chặt chẽ, khách quan. Tuyệt đối không dùng từ ngữ giao tiếp đời thường.
2. Thuật ngữ pháp lý: Chủ động sử dụng các thuật ngữ chuyên ngành chuẩn xác (Ví dụ: "Đơn phương chấm dứt", "Bất khả kháng", "Nghĩa vụ liên đới", "Chuyển giao rủi ro", "Chậm thực hiện nghĩa vụ").
3. Tính bảo vệ: Khi người dùng không yêu cầu chi tiết, phải TỰ ĐỘNG soạn thảo các điều khoản theo hướng bảo vệ tối đa quyền lợi hợp pháp cho cả hai bên, lường trước các rủi ro phát sinh.
4. Cách trình bày: Không viết gộp một đoạn dài. Phải bám sát việc chia nhỏ thành từng tiểu mục (1.1, 1.2) mạch lạc.
BẮT BUỘC sử dụng ký tự xuống dòng (\n) sau mỗi tiểu mục (1.1, 1.2...). 
ĐẶC BIỆT: Nếu trong một tiểu mục có liệt kê các điểm nhỏ (a, b, c...), BẮT BUỘC phải xuống dòng (\n) TRƯỚC MỖI ĐIỂM (a), (b), (c)... Tuyệt đối không được viết dính liền các điểm này thành một khối văn bản ngang.

5. CẬP NHẬT LUẬT MỚI NHẤT (THUẬT TOÁN HỢP NHẤT THỜI GIAN & CHỌN LỌC CĂN CỨ):
   - BẠN LÀ TRỌNG TÀI KIỂM CHỨNG: Bạn phải luôn nhận thức năm hiện tại là 2026. Nhiệm vụ của bạn là đối chiếu giữa [TÀI LIỆU LUẬT] (Dữ liệu RAG) và [TRI THỨC NỘI TẠI] của bạn.
   - QUY TẮC GHI ĐÈ LUẬT CŨ (OVERWRITE RULE): NẾU tài liệu RAG cung cấp các luật ĐÃ CŨ (Ví dụ: Luật Đất đai 2013, Luật Nhà ở 2014, Luật Thương mại 2005...) NHƯNG trong tri thức của bạn ĐÃ CÓ bản luật sửa đổi mới hơn đang có hiệu lực (Ví dụ: Luật Đất đai 2024, Luật Nhà ở 2023...), BẮT BUỘC dùng luật mới nhất của bạn để làm căn cứ. Tự động "đá" bỏ luật cũ từ RAG.
   - QUY TẮC GIỮ RAG: NẾU luật trong RAG đã là phiên bản mới nhất, hãy sử dụng NGUYÊN VẸN dữ liệu từ RAG.
   - FALLBACK AN TOÀN: Khi dùng trí nhớ gốc thay thế RAG mà không nhớ chính xác 100% số hiệu văn bản, TUYỆT ĐỐI KHÔNG ĐƯỢC BỊA ĐẶT. Chỉ cần ghi ngắn gọn "Tên Luật + Năm ban hành" (Ví dụ: "Luật Đất đai 2024").

6. QUY TẮC ĐIỀN THÔNG TIN VÀ XỬ LÝ KHOẢNG TRỐNG (ANTI-LAZINESS RULE - SỐNG CÒN):
   - TUYỆT ĐỐI KHÔNG đưa các ký hiệu chú thích, số hiệu mục lục dạng dấu ngoặc vuông như [1], [2], [3]... từ văn bản luật gốc vào nội dung hợp đồng.
   - TUYỆT ĐỐI KHÔNG dùng dấu ngoặc vuông để bọc các khoảng trống cần điền (Ví dụ: CẤM VIẾT "[Địa chỉ cụ thể]", "[Số tiền]", "[Tên công ty]").
   - Mọi chỗ thiếu thông tin cần người dùng điền tay BẮT BUỘC phải dùng chuỗi dấu chấm: "...................."
   - Bạn BẮT BUỘC phải phân tích kỹ câu hỏi của người dùng để trích xuất: Ngày, tháng, năm ký kết, địa điểm ký kết, thông tin chi tiết của Bên A, Bên B và điền vào đúng các Key tương ứng trong đối tượng JSON "extracted_data" ở bên dưới.
   - Nếu người dùng ĐÃ CUNG CẤP dữ liệu đầu vào, NGHIÊM CẤM việc bỏ trống hoặc dùng dấu chấm "......" tại các Key phẳng của "extracted_data". 
   - Trường hợp người dùng yêu cầu làm "mẫu trống/phôi in trắng", bạn mới được phép để trống thông tin cá nhân thành chuỗi rỗng "" hoặc dấu chấm "....................".
# NGỮ CẢNH TRƯỚC ĐÓ:
${historyText}

# ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
"${userInput}"

# CHỈ THỊ TỰ ĐIỀU TIẾT ĐỘ CHI TIẾT THEO QUY MÔ (DYNAMIC LENGTH CONTROLLER):
Trước khi lựa chọn khung, bạn phải tự động đọc yêu cầu của người dùng để phân tích quy mô hợp đồng nhằm kiểm soát số lượng điều khoản:
- MỨC CƠ BẢN / PHỔ THÔNG (Thuê nhà, thử việc, lao động, mua bán thông thường): BẮT BUỘC phải triển khai CHI TIẾT và đạt ĐỘ DÀI TỐI THIỂU TỪ 10 ĐIỀU TRỞ LÊN. Không được cắt xén các điều khoản phòng thủ cơ bản (Phạt vi phạm, bất khả kháng, chấm dứt hợp đồng).
- MỨC PHỨC TẠP / GIÁ TRỊ HOẶC CÔNG NGHỆ CAO (Phát triển phần mềm, tích hợp AI Engine, gia công hệ thống lõi): BẮT BUỘC phải triển khai CHI TIẾT KỊCH TRẦN từ 14 đến 15 ĐIỀU CHUYÊN SÂU. Lồng ghép chặt chẽ các điều khoản đặc thù cao cấp: Định nghĩa thuật ngữ, Tiến độ nghiệm thu chạy thử, Tiêu chuẩn kỹ thuật chống ảo giác, Quyền sở hữu trí tuệ, NDA song phương, và Data Masking tuân thủ PII.

# CÁC KHUNG HỢP ĐỒNG THỰC CHIẾN (MASTER TEMPLATES):
Dựa trên yêu cầu của người dùng, BẮT BUỘC chọn 1 trong các khung dưới đây và triển khai CHI TIẾT thành văn xuôi pháp lý cho từng tiểu mục (1.1, 1.2...):

[KHUNG 1: HỢP ĐỒNG MUA BÁN HÀNG HÓA]
- Quy mô áp dụng: Giao dịch mua bán hàng hóa thương mại phổ thông.
- Số lượng: Bắt buộc từ 10 Điều khoản trở lên (Tự động bóc tách và mở rộng thêm các điều khoản chung từ tri thức luật của bạn để bổ sung vào khung 8 điều cũ dưới đây).
- Cấu trúc cốt lõi:
  + Điều 1: Tên hàng hóa, số lượng, chất lượng, giá trị (1.1. Tên, đơn vị, số lượng, đơn giá, thành tiền; 1.2. Tổng giá trị bằng số và chữ).
  + Điều 2: Thanh toán (2.1. Ngày thanh toán; 2.2. Hình thức thanh toán).
  + Điều 3: Thời gian, địa điểm, phương thức giao hàng (3.1. Thời gian, địa điểm giao; 3.2. Phương tiện và chi phí bốc xếp; 3.3. Chi phí lưu kho bãi nếu không nhận hàng; 3.4. Kiểm nhận phẩm chất tại chỗ và lập biên bản nếu thiếu sót; 3.5. Kiểm tra hàng nguyên kiện và thời hạn báo lỗi trung gian).
  + Điều 4: Trách nhiệm của các bên (4.1. Trách nhiệm về khiếm khuyết trước/sau chuyển rủi ro; 4.2. Trách nhiệm thanh toán và nhận hàng).
  + Điều 5: Bảo hành và hướng dẫn sử dụng (5.1. Thời gian bảo hành; 5.2. Cung cấp giấy hướng dẫn).
  + Điều 6: Ngưng thanh toán (6.1. Do lừa dối; 6.2. Hàng hóa bị tranh chấp; 6.3. Giao sai hợp đồng; 6.4. Bồi thường nếu báo cáo sai sự thật).
  + Điều 7: Điều khoản phạt vi phạm (7.1. Phạt % giá trị hợp đồng nếu vi phạm - tối đa 8%; 7.2. Trách nhiệm vật chất dựa trên khung phạt Nhà nước).
  + Điều 8: Bất khả kháng và nghĩa vụ thông báo giữa các bên.
  + Điều 9: Đơn phương chấm dứt và xử lý hậu quả chấm dứt hợp đồng.
  + Điều 10: Luật áp dụng và cơ quan giải quyết tranh chấp.

[KHUNG 2: HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHỔ THÔNG VÀ PHÁT TRIỂN PHẦN MỀM CHUYÊN SÂU]
- Quy mô áp dụng: Tự động phân tách dựa trên yêu cầu người dùng:
  * Nếu là dịch vụ phổ thông (Sự kiện, vận chuyển, tư vấn cơ bản): Triển khai tối thiểu 10 điều khoản đầy đủ.
  * Nếu là dịch vụ công nghệ, gia công phần mềm, tích hợp AI Engine: ÉP BUỘC mở rộng quy mô kịch trần thành 15 điều khoản chi tiết như phôi mẫu hành chính chuyên sâu dưới đây.
- Chi tiết cấu trúc 15 Điều khi mở rộng quy mô công nghệ:
  + Điều 1: Định nghĩa thuật ngữ công nghệ (AI Engine, RAG Pinecone, API, Tỷ lệ ảo giác Hallucination).
  + Điều 2: Đối tượng hợp đồng và phạm vi công việc chi tiết.
  + Điều 3: Tiền dịch vụ, giá trị trọn gói gồm VAT và phương thức thanh toán từng đợt.
  + Điều 4: Thời hạn thực hiện, tiến độ dự án và quy trình bàn giao, chạy thử nghiệm hệ thống.
  + Điều 5: Tiêu chuẩn kỹ thuật, tham số cấu hình kiểm soát tỷ lệ ảo giác dưới 1% và mức độ chính xác của mô hình.
  + Điều 6: Quyền và nghĩa vụ của Bên A (Quyền kiểm tra, giám sát chất lượng và tiến độ).
  + Điều 7: Quyền và nghĩa vụ của Bên B (Cam kết chất lượng nhân sự kỹ thuật, cấm giao cho bên thứ ba làm thay).
  + Điều 8: Quyền sở hữu trí tuệ, bản quyền mã nguồn (Source Code) và quyền khai thác phần mềm của Bên A.
  + Điều 9: Cam kết bảo mật thông tin song phương (NDA) toàn diện, thời hạn bảo mật sau chấm dứt hợp đồng.
  + Điều 10: Cơ chế xử lý dữ liệu nhạy cảm (Data Masking) và tuân thủ bảo vệ thông tin cá nhân (PII).
  + Điều 11: Điều khoản phạt vi phạm hợp đồng (Khống chế trần tối đa không quá 8% theo đúng Điều 301 Luật Thương mại).
  + Điều 12: Trách nhiệm bồi thường thiệt hại thực tế phát sinh khi xảy ra sự cố do lỗi hệ thống.
  + Điều 13: Sự kiện bất khả kháng (Thiên tai, dịch bệnh, chiến tranh, hoặc sự cố sập cáp quang biển diện rộng có xác nhận của nhà mạng viễn thông).
  + Điều 14: Đơn phương chấm dứt hợp đồng (Điều kiện kích hoạt và nghĩa vụ thông báo bằng văn bản trước ít nhất 30 ngày).
  + Điều 15: Luật áp dụng (Pháp luật Việt Nam) và Cơ quan giải quyết tranh chấp (Trung tâm Trọng tài Quốc tế Việt Nam - VIAC chi nhánh Đà Nẵng).

[KHUNG 3: HỢP ĐỒNG THỬ VIỆC / LAO ĐỘNG]
- Quy mô áp dụng: Đạt chuẩn quan hệ lao động (Bắt buộc mở rộng từ 10 Điều khoản trở lên để phủ hết quyền lợi bảo hiểm, an toàn lao động, kỷ luật và trách nhiệm vật chất).
- Cấu trúc cốt lõi:
  + Điều 1: Thời hạn và công việc (Loại hợp đồng, địa điểm, chức danh chuyên môn).
  + Điều 2: Chế độ làm việc (Số giờ làm việc, thời giờ nghỉ ngơi, dụng cụ bảo hộ).
  + Điều 3: Lương, phụ cấp và các chế độ đãi ngộ (Đảm bảo thử việc >= 85% lương chính thức).
  + Điều 4: Hình thức và thời hạn trả lương.
  + Điều 5: Quyền và Nghĩa vụ của Người lao động.
  + Điều 6: Quyền và Nghĩa vụ của Người sử dụng lao động.
  + Điều 7: Chế độ Bảo hiểm xã hội, bảo hiểm y tế và an toàn lao động.
  + Điều 8: Đơn phương chấm dứt hợp đồng lao động (Thời hạn báo trước theo luật định).
  + Điều 9: Trách nhiệm vật chất và xử lý kỷ luật lao động.
  + Điều 10: Điều khoản thi hành và phương thức giải quyết tranh chấp lao động.

[KHUNG 4: HỢP ĐỒNG THUÊ NHÀ Ở]
- Quy mô áp dụng: Đạt chuẩn đời sống thực tế (Bắt buộc tối thiểu từ 10 đến 13 Điều khoản).
- Cấu trúc cốt lõi:
  + Điều 1: Thông tin nhà ở và hiện trạng cấu trúc (Vị trí, diện tích, trang thiết bị kèm theo).
  + Điều 2: Giá thuê nhà, chi phí dịch vụ (Điện, nước, internet, quản lý) và nguyên tắc điều chỉnh giá.
  + Điều 3: Tiền đặt cọc, mục đích đặt cọc và điều kiện hoàn trả/khấu trừ tiền cọc.
  + Điều 4: Phương thức, thời hạn và quy trình thanh toán tiền thuê.
  + Điều 5: Thời hạn thuê và quy trình bàn giao nhà thực tế.
  + Điều 6: Mục đích sử dụng nhà ở và cam kết tuân thủ quy định an ninh, phòng cháy chữa cháy.
  + Điều 7: Quyền và nghĩa vụ Bên cho thuê (Bảo trì cấu trúc lớn, giao nhà đúng hạn).
  + Điều 8: Quyền và nghĩa vụ Bên thuê (Sử dụng đúng mục đích, bồi thường nếu làm hư hỏng).
  + Điều 9: Quyền cải tạo, sửa chữa nội thất và lắp đặt thiết bị bổ sung.
  + Điều 10: Biện pháp xử lý khi một bên vi phạm nghĩa vụ hợp đồng (Chậm thanh toán tiền nhà).
  + Điều 11: Sự kiện bất khả kháng giải phóng nghĩa vụ.
  + Điều 12: Chấm dứt hợp đồng trước hạn (Điều kiện kích hoạt và nghĩa vụ báo trước ít nhất 30 ngày).
  + Điều 13: Quy trình bàn giao lại nhà và xử lý tài sản còn lại khi thanh lý hợp đồng.
  
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
  - Đối với các nội dung chữ nghĩa pháp lý trong mảng 'sections',
   tại những vị trí chứa thông tin đặc thù do người dùng cung cấp 
   (Ví dụ: Số phần trăm phạt vi phạm, số ngày hoàn thành, thời hạn bàn giao, hoặc số tiền cụ thể...),
    bạn BẮT BUỘC phải viết thông tin đó kèm theo các dấu chấm  phía sau để tạo phôi trực quan.
    KHÔNG ĐƯỢC tự ý để trống ngày tháng năm hay phần trăm vi phạm ở các tiểu mục con.
- FORMAT BẮT BUỘC: Hãy chèn chuỗi dấu chấm sát bên dữ liệu. Ví dụ: Nếu phạt 15%, viết là "....15%.....". Nếu thời hạn là 30 ngày, viết là ".....30 ngày.....".
 Nếu giá trị là 50.000.000 VNĐ, viết là "....50.000.000 VNĐ.....".
   - Quy tắc này giúp người dùng phân biệt rõ ràng vị trí được điền tự động trên nền phôi văn bản mà không làm thay đổi màu mực đen trang trọng của hợp đồng hành chính.
   - Với MỖI Điều khoản, bạn phải soạn thảo tối thiểu 3-5 tiểu mục con. 
   - Mỗi tiểu mục con phải là văn xuôi pháp lý dài, chặt chẽ (ít nhất 2-3 câu). 
   - Lồng ghép chi tiết các con số, thời hạn, mức phạt cụ thể mà người dùng đã cung cấp vào nội dung văn bản. 
   - TUYỆT ĐỐI KHÔNG viết tóm tắt hoặc chỉ liệt kê tiêu đề.
    -- TỰ ĐIỀU TIẾT CHI TIẾT (DYNAMIC LENGTH CONTROL): Bạn phải tự phân tích quy mô của yêu cầu. 
    Nếu yêu cầu là dịch vụ công nghệ, phần mềm, hoặc giá trị lớn, bạn phải kích hoạt tư duy pháp lý sâu, 
    soạn thảo văn bản dài kịch trần, chặt chẽ đủ 14-15 điều khoản, 
    không được viết tóm tắt. Nếu yêu cầu là thuê nhà, mua bán nhỏ, hãy giữ văn bản cô đọng từ 7-10 điều để phù hợp với thực tế đời sống.

6. CONTEXT RESET: Nếu đổi loại hợp đồng đột ngột, BẮT BUỘC reset mọi thông tin cá nhân về chuỗi rỗng "".

# YÊU CẦU ĐẦU RA JSON (TUYỆT ĐỐI TUÂN THỦ):
{
  "chat_reply": "Câu trả lời báo cáo kết quả soạn thảo ngắn gọn cho người dùng.",
  "template_type": "Loại hợp đồng (Ví dụ: hop_dong_mua_ban, hop_dong_dich_vu, hop_dong_lao_dong, hop_dong_thue_nha)",
  "extracted_data": {
    "ten_hop_dong": "TÊN HỢP ĐỒNG IN HOA (Ví dụ: HỢP ĐỒNG CUNG CẤP DỊCH VỤ CÔNG NGHỆ)",
    "benA_role": "VAI TRÒ PHÁP LÝ BÊN A IN HOA (Ví dụ: BÊN THUÊ DỊCH VỤ / BÊN CHO THUÊ)",
    "benB_role": "VAI TRÒ PHÁP LÝ BÊN B IN HOA (Ví dụ: BÊN CUNG CẤP DỊCH VỤ / BÊN THUÊ LẠI)",
    
    "can_cu_luat": [
      "QUY TẮC FLEXIBLE CĂN CỨ ĐÍCH DANH (BẮT BUỘC): Bạn phải tự động tra cứu, tùy cơ ứng biến theo loại hợp đồng để đưa ra chuỗi văn bản trích dẫn chính xác số Điều, số Khoản và tên văn bản luật điều tiết trực tiếp giao dịch này. Không ghi tên luật trơ trọi.",
      "Ví dụ 1 (Dịch vụ/Thương mại): 'Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005 và các văn bản hướng dẫn thi hành;'",
      "Ví dụ 2 (Dân sự/Thuê nhà): 'Căn cứ các quy định về Hợp đồng thuê tài sản tại Mục 5 Chương XVI Bộ luật Dân sự số 91/2015/QH13;'",
      "Ví dụ 3 (Lao động): 'Căn cứ Điều 20 và Điều 24 Bộ luật Lao động số 45/2019/QH14 về xác lập quan hệ lao động và hợp đồng thử việc;'"
    ],
    
    "ngay_ky": "Chỉ điền số ngày ký kết lấy từ yêu cầu người dùng (Ví dụ: 22). Tuyệt đối không để trống nếu đã có thông tin",
    "thang_ky": "Chỉ điền số tháng ký kết lấy từ yêu cầu người dùng (Ví dụ: 05). Tuyệt đối không để trống nếu đã có thông tin",
    "nam_ky": "Chỉ điền số năm ký kết lấy từ yêu cầu người dùng (Ví dụ: 2026). Tuyệt đối không để trống nếu đã có thông tin",
    "dia_diem_ky": "Ghi rõ địa chỉ nơi ký kết hợp đồng (Ví dụ: Văn phòng Công ty... hoặc Đà Nẵng)",

    "benA_name": "Tên đầy đủ của tổ chức doanh nghiệp hoặc cá nhân Bên A",
    "benA_mst": "Mã số thuế của doanh nghiệp Bên A (Nếu là công ty, bắt buộc điền vào đây, còn CCCD ghi 'N/A')",
    "benA_cccd": "Số Căn cước công dân của Bên A (Nếu là cá nhân, bắt buộc điền vào đây, còn MST ghi 'N/A')",
    "benA_address": "Địa chỉ trụ sở chính hoặc địa chỉ thường trú của Bên A",
    "benA_phone": "Số điện thoại liên hệ của Bên A",
    "benA_rep": "Họ tên và chức vụ người đại diện pháp luật của Bên A (Ví dụ: Ông Phạm Phú Hoàng Duy - Chức vụ: Giám đốc điều hành)",

    "benB_name": "Tên đầy đủ của tổ chức doanh nghiệp hoặc cá nhân Bên B",
    "benB_mst": "Mã số thuế của doanh nghiệp Bên B (Nếu là công ty, bắt buộc điền vào đây, còn CCCD ghi 'N/A')",
    "benB_cccd": "Số Căn cước công dân của Bên B (Nếu là cá nhân, bắt buộc điền vào đây, còn MST ghi 'N/A')",
    "benB_address": "Địa chỉ trụ sở chính hoặc địa chỉ thường trú của Bên B",
    "benB_phone": "Số điện thoại liên hệ của Bên B",
    "benB_rep": "Họ tên và chức vụ người đại diện pháp luật của Bên B (Ví dụ: Ông Nguyễn Văn B - Chức vụ: Giám đốc kỹ thuật)",

    "sections": [
      {
        "title": "Tên Điều (Ví dụ: Điều 11: Điều khoản phạt vi phạm hợp đồng)",
        "content": "11.1. Nội dung chi tiết khoản 1 của điều này viết bằng văn xuôi dài chặt chẽ... \\\n11.2. Nội dung chi tiết khoản 2 của điều này viết bằng văn xuôi dài chặt chẽ..."
      }
    ]
  }
}
# CẢNH BÁO TỐI THƯỢNG:
CHỈ trả về JSON thuần túy. KHÔNG chào hỏi rườm rà bên ngoài. Nếu không tuân thủ cấu trúc JSON này, hệ thống sẽ lỗi.\`;
`;

        const responseText = await getActiveModel(prompt, true, documents, false, false);

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
async function generatePlan(combinedText, documents = []) {
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
1. CẤU TRÚC GIAI ĐOẠN LINH HOẠT (DYNAMIC PHASES)
- BẮT BUỘC phải có TỐI THIỂU 3 giai đoạn lớn để đảm bảo lộ trình mạch lạc, không làm quá sơ sài khiến người dùng không hiểu cấu trúc tổng thể.
- Số lượng giai đoạn có thể linh hoạt tăng thêm theo độ phức tạp của hồ sơ nhưng KHÔNG vượt quá 6 giai đoạn để tối ưu hiển thị giao diện.
- Tên giai đoạn phải ngắn gọn, mang tính hành động (VD: "Chuẩn bị", "Nộp hồ sơ", "Giải quyết", "Thi hành"). NGHIÊM CẤM đặt tên kiểu: "Giai đoạn 1", "Phase 2",...

2. SỐ LƯỢNG VÀ ĐỘ CHI TIẾT TASKS (FLEXIBLE BOUNDARY ENGINE)
- Số lượng nhiệm vụ (TASKS) phải được sinh ra một cách LINH HOẠT và PHÙ HỢP với độ phức tạp của hồ sơ đầu vào hoặc theo yêu cầu cụ thể của người dùng.
- QUY TẮC GIỚI HẠN AN TOÀN (SAFE BOUNDARY): 
  + TỐI THIỂU phải đạt 12 TASKS vi mô để tránh trường hợp kế hoạch quá sơ sài, chung chung, mất đi tính thực thi.
  + TỐI ĐA nghiêm ngặt là 30 TASKS để kiểm soát tài nguyên hệ thống, tránh việc sinh ra quá nhiều nhiệm vụ tràn lan (nhuy 50-100 tasks) gây xáo trộn, loãng thông tin và quá tải giao diện.
- Mỗi TASK phải là hành động vi mô, cụ thể, có thể thực thi ngay và phân vai rõ ràng. NGHIÊM CẤM gom nhiều hành động lớn vào 1 task hoặc dùng mô tả chung chung (VD: "Xử lý hồ sơ").

3. CƠ CHẾ TỰ KIỂM TRA BIÊN ĐỘ (DYNAMIC SELF-VALIDATION)
- TRƯỚC KHI XUẤT OUTPUT JSON, bạn BẮT BUỘC phải chạy thuật toán đếm tổng số TASK đã sinh ra:
  + Nếu tổng số TASK < 12 ➔ BẮT BUỘC phải tự động phân rã các hành động lớn thành các bước vi mô nhỏ hơn để đạt tối thiểu 12 tasks.
  + Nếu tổng số TASK > 30 ➔ BẮT BUỘC phải tự động gộp các hành động nhỏ có cùng bản chất hoặc lược bỏ các bước dư thừa để ép tổng số lượng task nằm gọn gàng trong biên độ an toàn [12–30].
- CHỈ ĐƯỢC TRẢ OUTPUT khi số lượng TASK thỏa mãn điều kiện linh hoạt: 12 <= Số Task <= 30.
4. LOGIC THỜI GIAN (TEMPORAL ENGINE)
- Nếu user cung cấp mốc thời gian (VD: "bắt đầu từ ngày mai") → PHẢI suy luận thành ngày cụ thể.
- Nếu KHÔNG có mốc → MẶC ĐỊNH bắt đầu từ ngày hiện tại (${today}).
- Deadline phải tuân theo: TASK sau KHÔNG ĐƯỢC có deadline trước TASK trước. Các TASK cách nhau hợp lý (1–5 ngày tùy độ phức tạp).
- Định dạng ngày: DD/MM/YYYY

5. PHÂN VAI ĐỘNG VÀ QUY TẮC CHỐNG MƠ HỒ TRONG KẾ HOẠCH (CRITICAL CHỈ THỊ MỚI)
- PHẢI phân tích hồ sơ đầu vào để tự động trích xuất các vai trò, cá nhân thực tế liên quan (Ví dụ: Dự án CNTT ➔ "Phòng Kỹ thuật", "Phòng Pháp chế", "Dev thuật toán"; Vụ án Tòa án ➔ "Thẩm phán", "Luật sư", "Nguyên đơn", "Bị đơn"; Giao dịch Doanh nghiệp ➔ "Hội đồng quản trị", "Kế toán trưởng", "Giám đốc").
- BẮT BUỘC phải biết ứng biến linh hoạt theo từng tính chất kế hoạch riêng biệt, tuyệt đối KHÔNG rập khuôn máy móc kế hoạch nào cũng gán cho bộ phận "Phỹ thuật" hay "Pháp chế".
- NÊU RÕ HÀNH ĐỘNG THỰC THI CHI TIẾT: Tại mỗi Task, nội dung hành động của cá nhân/bộ phận được gán phải cụ thể đến mức thao tác được ngay (Ví dụ kỹ thuật ➔ "Viết mã Regex lọc chuỗi nhạy cảm trước khi gọi API"; Ví dụ pháp lý ➔ "Soạn thảo hồ sơ đánh giá tác động theo Mẫu số 04 tại Phụ lục Nghị định 13").
- Nếu xác định được: Gán đúng người phù hợp với nhiệm vụ vào trường "assignee".
- Nếu KHÔNG rõ: Ghi: "Chưa phân công"
- NGHIÊM CẤM: Gán bừa các vai trò ảo hoặc không liên quan trực tiếp đến ngữ cảnh của kế hoạch.

6. LEGAL NOTES (PHÂN TÍCH PHÁP LÝ)
- Mỗi TASK BẮT BUỘC có: Căn cứ pháp luật (VD: BLDS 2015, Nghị định 13/2023…) và Rủi ro pháp lý nếu không thực hiện đúng.

- BẠN LÀ TRỌNG TÀI KIỂM CHỨNG DÒNG THỜI GIAN THỰC TẾ NĂM 2026: 
Hãy đối chiếu thông tin pháp lý giữa [TÀI LIỆU QUY CHIẾU PHÁP LÝ BỔ TRỢ] (RAG) và [TRI THỨC NỘI TẠI] của bạn.
- QUY TẮC GHI ĐÈ LUẬT CŨ (OVERWRITE RULE): NẾU tài liệu RAG cung cấp các luật ĐÃ CŨ và
 lỗi thời tính đến năm 2026 (Ví dụ: Luật Đất đai 2013, Luật Nhà ở 2014, Luật Thương mại 2005...) 
 NHƯNG trong tri thức nội tại của bạn ĐÃ CÓ bản luật sửa đổi mới hơn đang có hiệu lực 
 (Ví dụ: Luật Đất đai 2024, Luật Nhà ở 2023...), BẮT BUỘC sử dụng tên bộ luật mới nhất trong 
 tri thức của bạn để làm căn cứ pháp lý trong các "legal_notes". Tự động bỏ qua văn bản cũ của RAG.
- QUY TẮC GIỮ RAG: Nếu văn bản trong RAG đã là phiên bản mới nhất, tuân thủ nguyên vẹn dữ liệu RAG.
- FALLBACK AN TOÀN: Khi thay thế luật cũ, nếu không nhớ chính xác 100% số hiệu điều khoản cụ thể, TUYỆT ĐỐI KHÔNG BỊA ĐẶT, chỉ ghi ngắn gọn "Tên Luật + Năm ban hành" (Ví dụ: "Luật Đất đai 2024").
- ANTI-BRACKET WARNING: Tuyệt đối KHÔNG sử dụng các dấu ngoặc vuông [] trong nội dung văn bản chữ của các trường "title" hay "legal_notes" để tránh làm hỏng cấu trúc hiển thị (Ví dụ: Không viết "[Luật Lao động 2019]", hãy viết trực tiếp "Luật Lao động 2019").

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
Phân tích hồ sơ -> Đối chiếu RAG và Tri thức nội tại cập nhật luật 2026 -> Trích xuất vai trò -> Xây dựng timeline -> Đếm dữ liệu để tự động co giãn số Phase (>=3) và số Task (12-30) -> Sinh task vi mô -> Gán deadline -> Gán assignee -> Thêm legal_notes sạch ngoặc vuông -> SELF-CHECK biên độ -> Xuất JSON.


`;

        const responseText = await getActiveModel(prompt, true, documents, false, false);
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
// HÀM BỔ TRỢ: XỬ LÝ ĐIỂM SỐ & ĐỒNG BỘ DỮ LIỆU (POST-PROCESSING)

// ==============================================================================

function adaptAndScoreV7(aiParsedResult) {
    // 1. Chặn đứng nếu là video giải trí
    if (aiParsedResult.context_type === 'NON_LEGAL') {
        return {
            ...aiParsedResult,
            trustScore: -1,
            scoring_details: {
                detected_issues: { dangerous: 0, high: 0, advisory: 0 },
                raw_score: 100,
                applied_cap: 100,
                final_score: -1,
                calculation_note: "Video không chứa nội dung pháp lý để kiểm toán."
            }
        };
    }

    // 2. Đếm lỗi từ critical_analysis
    let dangerous = 0;
    let high = 0;
    let advisory = 0;

    if (aiParsedResult.critical_analysis && Array.isArray(aiParsedResult.critical_analysis)) {
        aiParsedResult.critical_analysis.forEach(issue => {
            const severity = (issue.severity || '').toUpperCase();
            if (severity === 'DANGEROUS') dangerous++;
            if (severity === 'HIGH_RISK') high++;
            if (severity === 'ADVISORY') advisory++;
        });
    }

    // 3. Thuật toán tính điểm (Base = 100)
    const baseScore = 100;
    const penalty = (dangerous * 40) + (high * 20) + (advisory * 10);
    const rawScore = Math.max(0, baseScore - penalty);

    // 4. Thuật toán áp Trần điểm (CAP)
    let appliedCap = 100;
    if (dangerous >= 2) appliedCap = 20;
    else if (dangerous === 1) appliedCap = 40;
    else if (high >= 1) appliedCap = 60;

    const finalTrustScore = Math.min(rawScore, appliedCap);

    // 5. Tự động sinh ghi chú (Calculation Note)
    let noteParts = [];
    if (dangerous > 0) noteParts.push(`${dangerous} rủi ro nghiêm trọng (DANGEROUS)`);
    if (high > 0) noteParts.push(`${high} sai lệch cốt lõi (HIGH_RISK)`);
    if (advisory > 0) noteParts.push(`${advisory} điểm cần lưu ý (ADVISORY)`);

    const calculationNote = noteParts.length > 0
        ? `Hệ thống ghi nhận ${noteParts.join(', ')}. Điểm số được điều chỉnh dựa trên mức độ vi phạm thực tế.`
        : "Nội dung video tuân thủ tốt, không phát hiện sai lệch pháp lý đáng kể.";

    // 6. Trả về Object chuẩn hóa cho Frontend
    return {
        ...aiParsedResult,
        trustScore: finalTrustScore,
        legalBases: aiParsedResult.legal_map || [],
        scoring_details: {
            detected_issues: { dangerous, high, advisory },
            raw_score: rawScore,
            applied_cap: appliedCap,
            final_score: finalTrustScore,
            calculation_note: calculationNote
        }
    };
}

// ==============================================================================
// HÀM PHÂN TÍCH VIDEO (VIDEO ANALYSIS) - V7.0 FINAL
// ==============================================================================

async function analyzeVideo(videoUrl) {
    let transcript = '';

    try {
        // 1. CHUẨN HÓA URL & FETCH TRANSCRIPT
        const standardUrl = normalizeYouTubeUrl(videoUrl);
        if (!standardUrl) throw new Error('URL video không hợp lệ.');

        let transcriptItems = await YoutubeTranscript.fetchTranscript(standardUrl);
        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('Không tìm thấy phụ đề cho video này.');
        }

        transcript = transcriptItems.map(item => item.text).join(' ').trim();
        const currentYear = new Date().getFullYear();

        // Khai báo các biến phục vụ RAG và Prompt
        let ragContext = '';
        let ragStatus = 'EMPTY'; // Mặc định là EMPTY
        let relatedDocs = [];
        let legalClaims = ''; // Dự phòng nếu sếp chưa có hàm trích xuất AI #1

        // 2. RAG GROUNDING (TRUY XUẤT LUẬT THỰC TẾ)
        try {
            const keywordPrompt = `Bạn là một chuyên gia trích xuất dữ liệu hệ thống (Data Extractor). Hãy đọc đoạn văn bản sau và trích xuất ra từ 3-5 từ khóa hoặc cụm từ pháp lý cốt lõi bằng tiếng Việt để làm chuỗi tìm kiếm dữ liệu (Search Query).
    
    QUY TẮC ÉP BUỘC (SỐNG CÒN):
    1. CHỈ trả về các từ khóa/cụm từ cách nhau bằng dấu phẩy (Ví dụ: quy chế thi, đề thi mẫu, bộ giáo dục và đào tạo).
    2. TUYỆT ĐỐI KHÔNG có lời mở đầu, không có số thứ tự (1, 2, 3), không giải thích trong ngoặc, không dùng dấu gạch đầu dòng, không bọc dấu markdown.
    3. Chủ động sửa các lỗi chính tả nghe từ tai tiếng sang từ ngữ pháp lý chuẩn (Ví dụ: 'sở giục đo tạ' -> 'Sở Giáo dục và Đào tạo', 'quy chế thi vào tháng 11' -> 'Quy chế thi tốt nghiệp THPT').
    
    Đoạn văn bản cần trích xuất: "${transcript.substring(0, 1000)}"`;
            const refinedKeywords = await getActiveModel(keywordPrompt, false);
            console.log(" Từ khóa đã lọc cho RAG:", refinedKeywords.trim());

            relatedDocs = await ragService.query(refinedKeywords.trim());

            if (relatedDocs && relatedDocs.length > 0) {
                ragStatus = 'SUCCESS'; // Đánh dấu RAG thành công
                console.log(`🟢 [NGUỒN DATA]: DÙNG PINECONE (Lấy được ${relatedDocs.length} tài liệu luật để audit video).`)
            } else {
                ragStatus = 'EMPTY'; // Truy vấn OK nhưng không có kết quả
                console.log(`🟡 [NGUỒN DATA]: PINECONE TRỐNG -> Đã cấp quyền dùng Google Search Grounding để fact-check pháp lý video.`);
            }
        }

        catch (rErr) {
            ragStatus = 'FAILED'; // Đánh dấu lỗi hệ thống
            console.warn(" Lỗi của RAG:", rErr.message);
        }

        // 3.  PROMPT V7.0 
        const prompt = `
[CRITICAL SYSTEM RULES - HIGHEST PRIORITY]

Bạn là AI Pháp lý LegAI, hoạt động như Hệ thống Kiểm toán Pháp lý Nội dung số theo pháp luật Việt Nam.

MỤC TIÊU:
- Kiểm toán độ tin cậy pháp lý của nội dung video.
- Đánh giá dựa trên dữ liệu xác minh và nguyên tắc pháp lý.
- Xuất dữ liệu tóm tắt luật chi tiết, dễ hiểu, hướng đến đối tượng người dùng không am hiểu sâu về luật (người mù luật).

━━━━━━━━━━━━━━━━━━━━━━━━━━
[0. FLEXIBLE FALLBACK EXECUTION MODE]
━━━━━━━━━━━━━━━━━━━━━━━━━━

Năm hiện tại: ${currentYear}
RAG_STATUS: ${ragStatus}

GROUNDING_MODE:
- VERIFIED
- PARTIAL
- DEGRADED

QUY TẮC PHÒNG THỦ & TRÍ THỨC NỀN 2026:
1. Nếu RAG_STATUS thuộc ["FAILED", "TIMEOUT", "EMPTY"], kích hoạt chế độ GROUNDING_MODE = "DEGRADED".
2. Khi chạy ở chế độ "DEGRADED" hoặc khi RAG không chứa văn bản luật cụ thể: NGHIÊM CẤM bịa đặt số hiệu văn bản giả. Tuy nhiên, BẮT BUỘC phải sử dụng [TRI THỨC NỘI TẠI CẬP NHẬT ĐẾN NĂM 2026] để trích xuất và tóm tắt các quy định pháp luật hiện hành hoặc các Đề án chỉ đạo cốt lõi của Nhà nước liên quan đến chủ đề (Ví dụ về Tiền điện tử/Tiền ảo: Phải liên kết được với Quyết định 1255/QĐ-TTg của Thủ tướng Chính phủ về đề án hoàn thiện khung pháp lý tài sản ảo; các Chỉ thị của Ngân hàng Nhà nước và Luật Thuế hiện hành).
3. Tuyệt đối không để trống hoặc ghi "Chưa xác minh cụ thể" ở phần tóm tắt luật hiện hành nếu tri thức nền của bạn có thể cung cấp tổng quan quy định pháp lý tương ứng.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[1. SYSTEM PRIORITY & INSTRUCTION ISOLATION]
━━━━━━━━━━━━━━━━━━━━━━━━━━
THỨ TỰ ƯU TIÊN CHỈ DẪN:
1. SYSTEM RULES
2. OUTPUT RULES
3. JSON SCHEMA
4. LEGAL_DIGEST
5. LEGAL_REFERENCE_DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━
[2. CONTEXT GATE & NOISE BLOCKING - NÂNG CẤP CHỐNG BẪY DRAMA / CẮT GHÉP]
━━━━━━━━━━━━━━━━━━━━━━━━━━
context_type CHỈ được là: "LEGAL" | "PARTIAL_LEGAL" | "NON_LEGAL"

QUY TẮC NHẬN DIỆN Ý ĐỒ VIDEO (TONE & INTENT AUDIT):
1. BẮT BẪY CHÂM BIẾM / CẮT GHÉP CHÍNH TRỊ (ANTI-PROPAGANDA & DRAMA):
- Bạn phải đặc biệt cảnh giác với các transcript chứa các câu phát ngôn nhại lại, câu nói cắt ghép của các nhân vật lịch sử, chính trị, hoặc các câu nói trending mang tính kích động tranh cãi giữa "Nhà nước" và "Người dân" (Ví dụ các câu kiểu: "Chúng tôi nhận lỗi trước dân...", "Nếu dân sai dân chịu trách nhiệm trước pháp luật...", "Tôi năm nay 90 tuổi rồi chưa gặp...").
- Tuyệt đối KHÔNG ĐƯỢC chỉ nhìn vào câu chữ bề mặt để khen ngợi là "đúng đắn theo Hiến pháp". Bạn phải phân tích xem ngữ cảnh video có phải là đang: Châm biếm, đả kích chính quyền, định hướng dư luận tiêu cực, hoặc dùng ngôn từ thù hằn, bậy bạ hay không.

2. HÀNH ĐỘNG HẠ ĐIỂM SÀN (STRICT TRUST SCORE PENALTY):
- Nếu transcript có chứa các phát ngôn bậy bạ, câu nói nhại mang tính đả kích chế độ, hoặc cắt ghép lời nói của cán bộ/công dân nhằm mục đích tạo drama bôi nhọ:
  + BẮT BUỘC phải chuyển trạng thái severity thành "DANGEROUS" hoặc "HIGH_RISK".
  + Đánh tụt điểm Trust Score xuống dưới 40% (Cảnh báo đỏ).
  + Tại phần "conclusion" (Kết luận), phải ghi rõ: "Nội dung mang tính chất cắt ghép, lấy ngữ cảnh châm biếm, bóp méo phát ngôn hoặc kích động dư luận, có dấu hiệu vi phạm quy định về thuần phong mỹ tục hoặc an ninh mạng, không có giá trị phổ biến pháp luật chuẩn mực."

3. CẬP NHẬT CƠ SỞ ĐỐI CHIẾU THỰC TẾ:
- Đối với các phát ngôn thù hằn, bậy bạ, cắt ghép trên không gian mạng, bạn BẮT BUỘC phải lôi các quy định sau của Nhà nước ra để đối chiếu ở mục "law_fact":
  + Luật An ninh mạng 2018 (Điều 8 về các hành vi bị nghiêm cấm trên không gian mạng, bao gồm thông tin sai sự thật, xuyên tạc, xúc phạm uy tín của cơ quan, tổ chức, cá nhân).
  + Nghị định 15/2020/NĐ-CP (Điều 101 về vi phạm quy định về trách nhiệm sử dụng dịch vụ mạng xã hội; hành vi cung cấp, chia sẻ thông tin giả mạo, thông tin sai sự thật, xuyên tạc, vu khống, xúc phạm uy tín của cơ quan, tổ chức, danh dự, nhân phẩm của cá nhân).

  ━━━━━━━━━━━━━━━━━━━━━━━━━━
[3. PASSIVE RAG GROUNDING]
━━━━━━━━━━━━━━━━━━━━━━━━━━
<LEGAL_REFERENCE_DATA>
${relatedDocs && relatedDocs.length > 0 ? buildStrictContextText(relatedDocs) : 'Không có dữ liệu RAG hỗ trợ.'}
</LEGAL_REFERENCE_DATA>

━━━━━━━━━━━━━━━━━━━━━━━━━━
[4. SEVERITY CLASSIFICATION]
━━━━━━━━━━━━━━━━━━━━━━━━━━
severity CHỈ được là: "DANGEROUS" | "HIGH_RISK" | "ADVISORY"
LƯU Ý: Backend Node.js sẽ tự tính điểm. KHÔNG được tự tính trustScore hoặc đưa công thức điểm số vào output text.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[5. CONFIDENCE ENGINE]
━━━━━━━━━━━━━━━━━━━━━━━━━━
confidence.level CHỈ được là: "HIGH" | "MEDIUM" | "LOW"

━━━━━━━━━━━━━━━━━━━━━━━━━━
[6. OUTPUT JSON STRICT SCHEMA - CẢI TIẾN CHUẨN USER-FRIENDLY]
━━━━━━━━━━━━━━━━━━━━━━━━━━
QUY TẮC OUTPUT BẮT BUỘC:
- CHỈ trả về JSON thuần. KHÔNG markdown, KHÔNG \`\`\`.

JSON SCHEMA:
{
  "summary": "string",
  "grounding": {
    "rag_used": true,
    "grounding_mode": "VERIFIED | PARTIAL | DEGRADED",
    "retrieval_status": "SUCCESS | EMPTY | FAILED | TIMEOUT"
  },
  "context_type": "LEGAL | PARTIAL_LEGAL | NON_LEGAL",
  "confidence": {
    "level": "HIGH | MEDIUM | LOW",
    "reason": "string"
  },
  "legal_summary_card": {
    "title_vong_luat": "Tên văn bản/Luật/Nghị định điều tiết chung chủ đề này tính đến năm 2026",
    "brief_content": "Tóm tắt ngắn gọn quy định của pháp luật Việt Nam hiện hành về vấn đề này bằng ngôn ngữ bình dân, dễ hiểu (Ví dụ: Việt Nam chưa công nhận tiền số là tiền tệ, đang nghiên cứu khung thuế...)"
  },
  "critical_analysis_cards": [
    {
      "id": 1,
      "severity": "DANGEROUS | HIGH_RISK | ADVISORY",
      "video_claim": "Lời thoại/Nhận định cụ thể trích từ video cần rà soát",
      "law_fact": "Sự thật pháp lý: Số hiệu Điều, Khoản chi tiết và nội dung luật quy định đối chiếu thực tế tính đến năm 2026",
      "conclusion": "Kết luận ngắn gọn cho người xem biết thông tin này Đúng, Sai, hoặc chỉ là Tin đồn/Dự thảo chưa có hiệu lực thi hành"
    }
  ],
  "action_plan": [
    {
      "step": 1,
      "action": "Hành động khuyến nghị cụ thể cho người xem video"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━
[7. CONSISTENCY & HALLUCINATION CONTROL]
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Đảm bảo các trường video_claim, law_fact, conclusion ánh xạ khớp nhau tạo thành bộ thẻ so sánh trực quan cho người dùng.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[8. FINAL OUTPUT REMINDER]
━━━━━━━━━━━━━━━━━━━━━━━━━━
Kiểm tra tính hợp lệ của JSON trước khi xuất.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[9. LEGAL DIGEST INPUT]
━━━━━━━━━━━━━━━━━━━━━━━━━━
LEGAL_DIGEST:
"""${legalClaims || transcript}"""
`;

        // 4. GỌI AI & PARSE KẾT QUẢ THÔ
        let responseText = await getActiveModel(prompt, true, relatedDocs, false, false);
        let rawResult = JSON.parse(cleanAIJsonString(responseText));

        // 5. POST-PROCESSING (Gọi hàm xử lý dữ liệu và tính điểm)
        let result = adaptAndScoreV7(rawResult);

        // 6. MAPPING DỮ LIỆU BỔ SUNG
        result.transcript = transcript;
        result.raw_transcript = transcript;

        // 7. GHI LOG
        await logUsage(result.trustScore === -1 ? 'VIDEO_ANALYSIS_NON_LEGAL' : 'VIDEO_ANALYSIS').catch(console.error);

        return result;

    } catch (error) {
        console.error(" Lỗi Video Analysis:", error.message);
        throw new Error(error.message || "Không thể phân tích video.");
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
        // Thay vì gọi model trực tiếp, hãy dùng hàm getActiveModel có sẵn
        const rawResponse = await getActiveModel(prompt, false, false, false);
        const category = rawResponse.trim().replace(/[".*]/g, "");
        return VALID_CATEGORIES.includes(category) ? category : "Lĩnh vực khác";
    } catch (error) {
        return "Lĩnh vực khác";
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