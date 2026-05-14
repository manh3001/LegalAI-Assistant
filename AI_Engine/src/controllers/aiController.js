const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const { sql, pool, poolConnect } = require('../config/db');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const ragService = require('../services/ragService');
const geminiService = require('../services/geminiService');

// hàm này sẽ được gọi trong aiRoutes.js khi có request POST /api/ai/ask
exports.ask = async (req, res) => {
    try {
        const { question, message } = req.body;
        const userQuery = question || message;

        if (!userQuery) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi' });
        }

        console.log(` LegAI nhận câu hỏi: "${userQuery}"`);

        let relatedDocs = [];
        try {
            relatedDocs = await ragService.query(userQuery);
        } catch (err) {
            console.error(' Lỗi RAG (sẽ trả lời bằng kiến thức chung):', err.message);
        }

        // Gọi sang GeminiService 
        const answer = await geminiService.generateAnswerWithGemini(userQuery, relatedDocs);

        return res.json({
            success: true,
            answer,
            sources: relatedDocs.map(doc => ({
                title: doc.title,
                source: doc.sourceUrl || 'Cơ sở dữ liệu nội bộ'
            }))
        });
    } catch (error) {
        console.error(' Lỗi Chat Controller:', error);
        return res.status(500).json({
            success: false,
            message: 'LegAI đang gặp sự cố, vui lòng thử lại sau.',
            error: error.message
        });
    }
};

// ==============================================================================
// CAC HAM PHU TRO XU LY DU LIEU (DAT NGOAI EXPORTS)
// ==============================================================================

const cleanContractText = (text) => {
    if (!text) return "";
    return text
        .replace(/[\r\n\t\u0007\u0002]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
const maskingEngine = (text, context = {}) => {
    if (!text) return { maskedText: text, entityMap: {} };

    let pCount = context.pCount || 1;
    let cCount = context.cCount || 1;
    const entityMap = context.entityMap || new Map();

    // Đưa các họ kép lên đầu danh sách để ưu tiên bắt trước
    // Tạo danh sách họ bao gồm cả dạng Capitalize và dạng IN HOA TOÀN BỘ
    const vnSurnamesRaw = "Âu Dương|Tôn Thất|Trịnh Lê|Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Lâm|Đoàn|Tôn|Trịnh|Đinh";
    const vnSurnames = vnSurnamesRaw.split('|').flatMap(s => [s, s.toUpperCase()]).join('|');
    const normalizeKey = (s) => {
        return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^\p{L}\d\s]/gu, " ").replace(/\s+/g, " ").trim();
    };

    const getEntity = (name, type) => {
        let cleanName = name.trim()
            .replace(/^([Cc]ông ty|[Cc][Tt][Yy]|[Nn]gân hàng|[Bb]ank|[Tt]ập đoàn|[Tt]ổng công ty|[Uu][Bb][Nn][Dd]|[Bb]ộ|[Ss]ở|[Ôô]ng|[Bb]à|[Aa]nh|[Cc]hị|[Đđ]ại diện|[Bb]ên [AB]|Họ tên)[:\s]*/gi, "")
            .replace(/\s+([Tt][Nn][Hh][Hh]|[Cc][Pp]|[Cc]ổ\s+phần|[Tt]rách\s+nhiệm\s+hữu\s+hạn|[Mm]ột\s+thành\s+viên|đại diện|đại|là|tại)$/gi, "")
            .trim();

        // Fix Test 10: Xử lý tên viết HOA toàn bộ
        if (cleanName === cleanName.toUpperCase() && cleanName.length > 3) {
            cleanName = cleanName.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
        }

        const key = type + "::" + normalizeKey(cleanName || name);
        if (entityMap.has(key)) return entityMap.get(key);
        const label = type === "person" ? `PERSON_${pCount++}` : `COMPANY_${cCount++}`;
        entityMap.set(key, label);
        return label;
    };

    class SpanManager {
        constructor() { this.candidates = []; }
        add(start, end, replacement, priority) { this.candidates.push({ start, end, replacement, priority }); }
        resolve(text) {
            this.candidates.sort((a, b) => a.priority - b.priority || (b.end - b.start) - (a.end - a.start));
            const resolved = [];
            for (const c of this.candidates) {
                if (!resolved.some(r => c.start < r.end && c.end > r.start)) resolved.push(c);
            }
            resolved.sort((a, b) => b.start - a.start);
            let result = text;
            for (const r of resolved) { result = result.slice(0, r.start) + r.replacement + result.slice(r.end); }
            return result;
        }
    }

    const span = new SpanManager();
    let match;

    // 1. PREFIX ID/STK (P1) 
    const idRegex = /(cccd|cmnd|mst|mã số thuế|stk|tài khoản|số tk)[\s:]*([\p{L}\d.-]{5,20})/giu;
    while ((match = idRegex.exec(text)) !== null) {
        const idStr = match[2].trim();
        if (idStr.replace(/\D/g, '').length < 5) continue;
        const masked = idStr.slice(0, 3) + "*".repeat(idStr.length - 3);
        span.add(match.index + match[0].indexOf(idStr), match.index + match[0].indexOf(idStr) + idStr.length, masked, 1);
    }

    // 2. EMAIL (P2)
    const emailRegex = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/gu;
    while ((match = emailRegex.exec(text)) !== null) {
        const [u, d] = match[0].split("@");
        span.add(match.index, match.index + match[0].length, u[0] + "***@" + d, 2);
    }

    // 3. PHONE (P3)
    const phoneRegex = /(?:\+?84|0)[\s.-]*\d([\s.-]*\d){8,11}/g;
    while ((match = phoneRegex.exec(text)) !== null) {
        const raw = match[0];
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 13) continue;
        const keep = digits.length > 10 ? 5 : 4;
        let idx = 0;
        span.add(match.index, match.index + raw.length, raw.replace(/\d/g, (d) => (++idx > keep ? '*' : d)), 3);
    }

    // 4. COMPANY - Fix Test 3: Cho phép từ khóa (Cổ phần, TNHH) viết hoa hoặc thường
    const legalLower = "(?:[Tt]rách\\s+nhiệm\\s+hữu\\s+hạn|[Cc]ổ\\s+phần|[Tt]hương\\s+mại|[Dd]ịch\\s+vụ|[Đđ]ầu\\s+tư|[Tt]ập\\s+đoàn|[Mm]ột\\s+thành\\s+viên|[Tt][Nn][Hh][Hh]|[Cc][Pp])";
    const companyRegex = new RegExp(`([Cc]ông ty|[Cc][Tt][Yy]|[Nn]gân hàng|[Bb]ank|[Tt]ập đoàn|[Tt]ổng công ty|[Uu][Bb][Nn][Dd]|[Bb]ộ|[Ss]ở)\\s+((?:${legalLower}\\s*)*)((\\p{Lu}[\\p{L}\\d&.\\-]*)(?:\\s+\\p{Lu}[\\p{L}\\d&.\\-]*){0,6})`, "gu");

    while ((match = companyRegex.exec(text)) !== null) {
        const full = match[0].trim();
        if (/(và|các|cùng|tại|theo)/.test(full)) continue;
        span.add(match.index, match.index + full.length, `[${getEntity(full, "company")}]`, 5);
    }

    // 5. PERSON PREFIX - Fix Test 20: Chấp nhận "Ông/Bà" viết hoa đầu câu
    const personPrefixRegex = /([Ôô]ng|[Bb]à|[Aa]nh|[Cc]hị|[Đđ]ại diện|[Cc]á nhân|[Bb]ên [ab]|[Hh]ọ tên|ÔNG|BÀ|ANH|CHỊ|ĐẠI DIỆN|BÊN [AB])[:\s]+((\p{Lu}[\p{L}\-]*\s*){2,6})/gu;
    while ((match = personPrefixRegex.exec(text)) !== null) {
        const name = match[2].trim();
        if (/^(TNHH|CP|NH|Bank|VND|VNĐ|USD)$/i.test(name)) continue;
        // Dùng indexOf thay vì lastIndexOf để bắt chính xác vị trí đầu tiên của tên sau prefix
        const nameStart = match.index + match[0].indexOf(match[2]);
        span.add(nameStart, nameStart + name.length, `[${getEntity(name, "person")}]`, 4);
    }
    // 6. STANDALONE NAME - Tăng giới hạn {0,5} để bắt trọn Test 9
    const standaloneRegex = new RegExp(`\\b((${vnSurnames})\\s+(\\p{Lu}[\\p{L}\\-]*)(?:\\s+\\p{Lu}[\\p{L}\\-]*){1,5})\\b`, "gu");

    while ((match = standaloneRegex.exec(text)) !== null) {
        const name = match[1];
        const normalized = normalizeKey(name);

        // Chặn bắt nhầm nếu tên nằm trong Company
        let isInsideCompany = false;
        for (const [key, label] of entityMap.entries()) {
            if (key.startsWith("company::") && key.includes(normalized)) {
                isInsideCompany = true; break;
            }
        }
        if (isInsideCompany) continue;

        span.add(match.index, match.index + name.length, `[${getEntity(name, "person")}]`, 6);
    }
    // 7. RAW ID (P7)
    const lines = text.split("\n");
    let offset = 0;
    for (const line of lines) {
        const rawRegex = /\b\d{6,15}\b/g;
        let m;
        while ((m = rawRegex.exec(line)) !== null) {
            const num = m[0];
            const isCurrency = new RegExp(`${num}[\\s]*(đ|vnđ|vnd|usd|%)`, "i").test(line);
            if (isCurrency || /(đồng|giá|tiền|thanh toán|ngày|tháng|năm|mã|số|no\.|id|hđ)/i.test(line)) continue;
            span.add(offset + m.index, offset + m.index + num.length, num.slice(0, 2) + "*".repeat(num.length - 2), 7);
        }
        offset += line.length + 1;
    }

    const maskedText = span.resolve(text);
    const entityObj = {};
    for (const [k, v] of entityMap.entries()) { entityObj[v] = k.split("::")[1]; }
    return { maskedText, entityMap: entityObj };
};
//  test  hàm maskingEngine mà không cần chạy cả server, 
// có thể chạy file masking-sandbox.js trong thư mục tests với node. 
// mai xóa hàm này sau khi đã test xong và ổn định.lúc cần thì bỏ lại
//  vào exports để dùng trong analyzeContract.
//module.exports = { maskingEngine };

// ----------------------------------------------------------------------------
// Detect user pre-masked data
// ----------------------------------------------------------------------------
const detectPreMaskedData = (text) => {
    if (!text) return false;

    const maskPatterns = /(\*\*\*|\[MASKED\]|\[\_\_\_\_\]|\[HỌ\_TÊN\]|\[BÊN A\]|\[BÊN B\]|xxx)/gi;

    const matches = text.match(maskPatterns);

    return matches && matches.length >= 2;
};
// ==============================================================================
// 2. API THAM DINH HOP DONG 
// ==============================================================================
exports.analyzeContract = async (req, res) => {
    let filePath = null;

    try {
        // 1. Kiem tra file upload
        if (!req.file) {
            return res.status(400).json({ error: "Vui long upload file hop dong!" });
        }

        filePath = req.file.path;
        const mimeType = req.file.mimetype;
        let contractText = "";

        // 2. Doc noi dung tu file (Giu nguyen logic goc cua ban)
        console.log("Dang doc file: " + req.file.originalname);

        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            contractText = data.text;
        }
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            contractText = result.value;
        }
        else {
            contractText = fs.readFileSync(filePath, 'utf-8');
        }

        if (!contractText || contractText.trim().length < 10) {
            return res.status(400).json({ error: "Khong doc duoc noi dung file." });
        }

        const cleanedText = cleanContractText(contractText);
        const isUserPreMasked = detectPreMaskedData(cleanedText);

        // 1. Gọi hàm masking
        const maskingResult = maskingEngine(cleanedText);

        // 2. Ép kiểu an toàn (Bắt mọi trường hợp)
        // Kiểm tra xem nó là Object (chứa key text/maskedText) hay là String trơn
        const finalMaskedText = typeof maskingResult === 'string'
            ? maskingResult
            : (maskingResult.maskedText || maskingResult.text || maskingResult.value || String(maskingResult));

        // 🔍 SOI DỮ LIỆU Ở ĐÂY:
        console.log("--- [DEBUG] DỮ LIỆU SAU MASKING (GỬI ĐI) ---");
        console.log(finalMaskedText.substring(0, 500) + "...");
        console.log("------------------------------------------");

        console.log("Dang gui noi dung da bao mat cho Gemini phan tich...");

        // 3. NHỚ ĐỔI BIẾN Ở ĐÂY NỮA NHÉ: Truyền finalMaskedText thay vì maskedText
        const analysisResult = await geminiService.analyzeContract(finalMaskedText, isUserPreMasked);

        // 🔍 SOI KẾT QUẢ AI TRẢ VỀ:
        console.log("--- [DEBUG] AI PHẢN HỒI (CHỨA MASKED DATA) ---");
        if (analysisResult.analysis_report && analysisResult.analysis_report.length > 0) {
            console.log("Trích dẫn mẫu:", analysisResult.analysis_report[0].clause);
        }

        console.log("Phan tich hoan tat.");
        res.json(analysisResult);
    } catch (error) {
        console.error("Loi he thong:", error.message);
        res.status(500).json({ error: "Loi he thong khi phan tich: " + error.message });
    } finally {
        // Don dep file tam tren server
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("Da xoa file tam.");
        }
    }
};

// ==============================================================================
// 3. API TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
// TRONG: src/controllers/aiController.js
exports.generateForm = async (req, res) => {
    try {
        const { text, history } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Thiếu nội dung chat" });
        }

        console.log(" Đang nhận yêu cầu tạo Form từ Frontend:", text);

        //  GỌI PINECONE (RAG) ĐỂ LẤY LUẬT MỚI NHẤT DỰA VÀO CÂU HỎI USER
        let relatedDocs = [];
        try {
            relatedDocs = await ragService.query(text);
            console.log(` Đã tìm thấy ${relatedDocs.length} tài liệu luật liên quan để đắp vào Form.`);
        } catch (err) {
            console.error('Lỗi RAG khi tạo Form:', err.message);
        }
        // Gọi thẳng Service, nhường toàn bộ não bộ (Prompt) cho Service lo
        const aiData = await geminiService.generateForm(text, history, relatedDocs);

        console.log(" AI đã bóc tách xong, chuẩn bị gửi về Frontend!");
        res.json(aiData);

    } catch (error) {
        console.error(" Lỗi API Generate Form:", error);
        res.status(500).json({ error: "Lỗi hệ thống LegAI khi tạo Form" });
    }
};

// ==========================================
// 4. TÍNH NĂNG LẬP KẾ HOẠCH (AI PLANNING)
// ==========================================
exports.generatePlanning = async (req, res) => {
    let filePaths = [];

    try {
        const { prompt: userPrompt } = req.body;
        let combinedText = userPrompt || "";

        // 1. Phân loại và Đọc các file đính kèm (nếu có)
        if (req.files && req.files.length > 0) {
            console.log(` Đang xử lý ${req.files.length} file đính kèm...`);

            for (const file of req.files) {
                const filePath = file.path;
                filePaths.push(filePath);
                const mimeType = file.mimetype;

                let fileText = "";
                if (mimeType === 'application/pdf') {
                    const dataBuffer = fs.readFileSync(filePath);
                    const data = await pdf(dataBuffer);
                    fileText = data.text;
                }
                else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const result = await mammoth.extractRawText({ path: filePath });
                    fileText = result.value;
                }
                else {
                    fileText = fs.readFileSync(filePath, 'utf-8');
                }

                combinedText += `\n\n--- NỘI DUNG TỪ FILE [${file.originalname}] ---\n${fileText}`;
            }
        }

        if (!combinedText || combinedText.trim().length < 5) {
            return res.status(400).json({ error: "Vui lòng nhập nội dung hoặc upload file để lập kế hoạch!" });
        }


        // Truyền finalInstructions vào Service
        const planningResult = await geminiService.generatePlan(combinedText);

        // . LƯU VÀO SQL SERVER 
        try {
            // Lấy userId từ token (đã qua authMiddleware)
            const userId = req.user ? req.user.id : 1; // Fallback về 1 nếu chưa login (để test)

            const request = pool.request();

            //  Đảm bảo Title không bị lỗi nếu AI trả về mảng rỗng
            const safeTitle = (planningResult && planningResult[0])
                ? `Kế hoạch: ${planningResult[0].title}`
                : 'Kế hoạch tư vấn pháp lý';


            // insert query 
            request.input('UserId', sql.Int, userId);
            request.input('RecordType', sql.NVarChar(50), 'PLANNING');
            request.input('Title', sql.NVarChar(500), `Kế hoạch: ${planningResult[0]?.title || 'Tư vấn pháp lý'}`);

            request.input('Folder', sql.NVarChar(200), 'Kế hoạch AI');
            request.input('AnalysisJson', sql.NVarChar(sql.MAX), JSON.stringify(planningResult));
            request.input('AIModel', sql.NVarChar(100), 'gemini-1.5-flash');

            const query = `
                INSERT INTO dbo.ContractHistory (UserId, RecordType, Title, Folder, AnalysisJson, AIModel, CreatedAt)
                VALUES (@UserId, @RecordType, @Title, @Folder, @AnalysisJson, @AIModel, GETDATE())
            `;

            await request.query(query);
            console.log(" Đã lưu kế hoạch vào Hồ sơ pháp lý thành công!");
        } catch (dbErr) {
            console.error(" Lỗi lưu DB :", dbErr);
        }

        console.log(` Lập kế hoạch xong! Đã tạo ${planningResult.length} bước.`);
        res.json({
            success: true,
            data: planningResult,
            message: "Kế hoạch đã được tạo và lưu vào hồ sơ!"
        });
    } catch (error) {
        console.error(" Lỗi lập kế hoạch:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi lập kế hoạch AI. Chi tiết: " + error.message });
    } finally {
        // Dọn dẹp tất cả file tạm
        filePaths.forEach(fp => {
            if (fs.existsSync(fp)) {
                fs.unlinkSync(fp);
            }
        });
        if (filePaths.length > 0) console.log(" Đã dọn dẹp các file tạm.");
    }
};
// ==============================================================================
/// 5.   THẨM ĐỊNH VIDEO (YOUTUBE TRANSCRIPT + LEGAL AUDIT)
// ============================================================================
exports.analyzeVideo = async (req, res) => {
    const { videoUrl } = req.body;
    const userId = req.user ? req.user.id : 1;

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
        return res.status(400).json({
            success: false,
            error: "Vui lòng nhập URL YouTube của video."
        });
    }

    try {
        await poolConnect;

        // =============================
        // 1. CHECK CACHE
        // =============================
        const checkRequest = pool.request();
        checkRequest.input('Url', sql.NVarChar(500), videoUrl);

        const existing = await checkRequest.query(`
            SELECT TOP 1 * FROM VideoHistory WHERE VideoUrl = @Url
        `);

        if (existing.recordset.length > 0) {
            const video = existing.recordset[0];

            console.log("🧠 Cache hit");

            //  UPDATE USAGE (SMART CACHE)
            const updateRequest = pool.request();
            updateRequest.input('Id', sql.Int, video.Id);

            await updateRequest.query(`
                UPDATE VideoHistory
                SET 
                    LastAccessedAt = GETDATE(),
                    AccessCount = ISNULL(AccessCount, 0) + 1
                WHERE Id = @Id
            `);

            return res.json({
                success: true,
                fromCache: true,
                data: JSON.parse(video.AnalysisJson)
            });
        }

        // =============================
        // 2. CALL AI
        // =============================
        console.log(`📡 Phân tích video: ${videoUrl}`);

        const aiData = await geminiService.analyzeVideo(videoUrl);
        const videoTitle = aiData.title || videoUrl;


        // =============================
        // 3. SAVE CACHE (VideoHistory) -  V3.0 AUDIT ENGINE
        // =============================
        const saveRequest = pool.request();

        // Chuẩn bị dữ liệu từ aiData (Kết quả từ Gemini V3)
        const trustScore = aiData.trustScore ?? (aiData.scoring_details?.final_score ?? 0);
        const summary = aiData.summary || "Không có tóm tắt.";
        const legalBases = JSON.stringify(aiData.legal_map || aiData.legalBases || []);

        saveRequest.input('UserId', sql.Int, userId);
        saveRequest.input('Url', sql.NVarChar(500), videoUrl);
        // Ưu tiên Title từ AI (nếu có) hoặc dùng Title từ crawler/videoUrl
        saveRequest.input('Title', sql.NVarChar(500), aiData.title || videoTitle || "Video Analysis");

        saveRequest.input('Transcript', sql.NVarChar(sql.MAX),
            aiData.raw_transcript || aiData.transcript || null);

        saveRequest.input('Summary', sql.NVarChar(sql.MAX), summary);

        saveRequest.input('LegalBases', sql.NVarChar(sql.MAX), legalBases);

        // QUAN TRỌNG: trustScore có thể là -1 (Non-legal), toán tử ?? giúp giữ đúng giá trị này
        saveRequest.input('TrustScore', sql.Int, trustScore);

        // Lưu toàn bộ JSON để Frontend bóc tách: critical_analysis, confidence, scoring_details
        saveRequest.input('AnalysisJson', sql.NVarChar(sql.MAX), JSON.stringify(aiData));

        // Ghi rõ version để làm báo cáo KLTN cho chuyên nghiệp
        saveRequest.input('AIModel', sql.NVarChar(50), 'Gemini-Dynamic-Fallback');

        saveRequest.input('LastAccessedAt', sql.DateTime, new Date());
        saveRequest.input('AccessCount', sql.Int, 1);

        await saveRequest.query(`
    INSERT INTO VideoHistory 
    (UserId, VideoUrl, Title, Transcript, Summary, LegalBases, TrustScore, AnalysisJson, AIModel, LastAccessedAt, AccessCount, CreatedAt)
    VALUES 
    (@UserId, @Url, @Title, @Transcript, @Summary, @LegalBases, @TrustScore, @AnalysisJson, @AIModel, @LastAccessedAt, @AccessCount, GETDATE())
`);

        // =============================
        // 4. CLEANUP TOP N CACHE
        // =============================
        await pool.request().query(`
            DELETE FROM VideoHistory
            WHERE Id NOT IN (
                SELECT TOP (500) Id 
                FROM VideoHistory
                ORDER BY LastAccessedAt DESC
            )
        `);

        // =============================
        // 5. SOCKET REALTIME
        // =============================
        if (global.io) {
            global.io.emit('new_activity', {
                FeatureName: 'VIDEO_ANALYSIS'
            });
        }

        console.log(" Video analyzed & cached");

        return res.json({
            success: true,
            fromCache: false,
            data: { ...aiData, Title: videoTitle }
        });

    } catch (error) {

        const errorMsg = error.message;

        console.error("Video Analysis Error:", errorMsg);

        // =============================
        // 🛡️ HANDLE DUPLICATE KEY
        // =============================
        if (errorMsg.includes("UNIQUE KEY")) {

            console.log("Duplicate detected → fallback cache");

            try {
                const fallback = await pool.request()
                    .input('Url', sql.NVarChar(500), videoUrl)
                    .query(`SELECT TOP 1 * FROM VideoHistory WHERE VideoUrl = @Url`);

                if (fallback.recordset.length > 0) {

                    const video = fallback.recordset[0];

                    // update usage luôn
                    await pool.request()
                        .input('Id', sql.Int, video.Id)
                        .query(`
                            UPDATE VideoHistory
                            SET LastAccessedAt = GETDATE(),
                                AccessCount = ISNULL(AccessCount, 0) + 1
                            WHERE Id = @Id
                        `);

                    return res.json({
                        success: true,
                        fromCache: true,
                        data: JSON.parse(video.AnalysisJson)
                    });
                }
            } catch (e) {
                console.error("Fallback error:", e.message);
            }
        }

        // =============================
        // ERROR YOUTUBE
        // =============================
        if (errorMsg.includes("Impossible to retrieve") ||
            errorMsg.includes("YoutubeTranscript") ||
            errorMsg.includes("No captions")) {

            return res.status(400).json({
                success: false,
                error: "Video không có phụ đề hoặc link không hợp lệ."
            });
        }

        return res.status(500).json({
            success: false,
            error: "AI đang bận, thử lại sau."
        });
    }
};