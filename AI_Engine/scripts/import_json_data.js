const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sql, poolConnect, pool } = require('../src/config/db');
const { Pinecone } = require('@pinecone-database/pinecone');

// --- 1. KHỞI TẠO TRỰC TIẾP GEMINI EMBEDDING ---
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// --- HÀM MỚI: TẨY DẤU TIẾNG VIỆT CHO PINECONE ID ---
const toAsciiId = (str) => {
    if (!str) return 'doc';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
        .replace(/đ/g, "d").replace(/Đ/g, "D") // Đổi chữ đ thành d
        .replace(/[^a-zA-Z0-9_-]/g, "-"); // Chỉ giữ lại chữ không dấu, số, gạch nối
};



const cleanLegalContent = (text) => {
    if (!text) return "";

    // 1. Loại bỏ các cụm từ tiếng Anh giao diện phổ biến (Blacklist)
    const uiNoise = [
        /Sign in/gi, /Download/gi, /Related Documents/gi,
        /Feedback/gi, /Search/gi, /View more/gi, /Print/gi
    ];
    let cleaned = text;
    uiNoise.forEach(regex => {
        cleaned = cleaned.replace(regex, "");
    });

    // 2. Loại bỏ các chú thích Footnote (dạng [1], [[1]], [^1])
    cleaned = cleaned.replace(/\[+?\d+\]+/g, "");

    // 3. Xử lý nội dung lặp lại (Deduplication)
    // Chia văn bản thành các đoạn lớn, nếu đoạn sau giống hệt đoạn trước thì bỏ qua
    const paragraphs = cleaned.split('\n\n');
    const uniqueParagraphs = paragraphs.filter((item, index) => paragraphs.indexOf(item) === index);
    cleaned = uniqueParagraphs.join('\n\n');

    return cleaned;
};


const cleanMarkdown = (text) => {
    if (!text) return "";

    let cleaned = text
        .replace(/<br\s*\/?>/gi, '\n') // Xử lý mọi biến thể của thẻ <br>
        .replace(/\|(\s*-+\s*\|)+/g, '') // Xóa các dòng phân cách bảng | --- | --- |
        .replace(/\|/g, ' ') // Thay dấu gạch đứng bảng bằng khoảng trắng để giữ ngữ nghĩa text
        .replace(/(\*\*|\*|#|__|_|`)/g, '') // Xóa định dạng Markdown
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Giữ lại text trong link, xóa URL
        .replace(/\\/g, '') // Xóa các ký tự escape dư thừa
        .replace(/\n{3,}/g, '\n\n') // Thu gọn các dòng trống thừa
        .trim();

    // Gọi hàm lọc nhiễu đã viết ở trên
    cleaned = cleanLegalContent(cleaned);

    return cleaned;
};
const smartChunk = (content) => {
    if (!content) return [];
    const chunks = [];
    const chunkSize = 1500; const overlap = 200;
    let start = 0; const max = content.length;
    while (start < max) {
        const end = Math.min(start + chunkSize, max);
        if (end <= start) break;
        const text = String(content.slice(start, end)).trim();
        if (text.length > 0) chunks.push({ text });
        if (end === max) break;
        start = end - overlap;
        if (start < 0) start = 0;
        if (start >= end) start = end;
    }
    return chunks;
};

const importData = async () => {
    try {
        console.log("⏳ Bắt đầu kết nối Database...");
        await poolConnect;

        const dataPath = path.join(__dirname, '../data', 'data_200.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const laws = JSON.parse(rawData);

        console.log(`📂 Đã tải ${laws.length} văn bản từ data_200.json.`);
        const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
        const index = pc.index(indexName);

        let count = 0;
        // đếm tổng số văn bản được nạp
        const totalLaws = laws.length;
        let processedCount = 0;
        for (const law of laws) {

            processedCount++;
            console.log(`\n📊 TIẾN ĐỘ: [${processedCount}/${totalLaws}]`);
            if (law.status !== "Còn hiệu lực") continue;

            const docId = law.id;
            console.log(`\n📌 Đang xử lý: ${docId} - ${law.title.substring(0, 50)}...`);

            // 1. Kiểm tra trạng thái hiện tại trong DB
            const check = await pool.request()
                .input('id', sql.NVarChar(100), docId)
                .query('SELECT Id, SyncStatusPinecone FROM LegalDocuments WHERE Id = @id');

            let shouldInsertSQL = true;
            let shouldVectorize = true;

            if (check.recordset.length > 0) {
                const existingDoc = check.recordset[0];

                if (existingDoc.SyncStatusPinecone === 'success') {
                    console.log(`⏩ Đã tồn tại hoàn chỉnh (DB & Pinecone). Bỏ qua.`);
                    continue; // Đã xong hết rồi thì mới bỏ qua
                } else {
                    console.log(`⚠️ Phát hiện data "treo": Đã có DB nhưng chưa có Vector. Đang chuẩn bị bù đắp...`);
                    shouldInsertSQL = false; // Không cần Insert nữa vì đã có dòng trong DB
                    shouldVectorize = true;  // Nhưng bắt buộc phải làm tiếp phần Vector
                }
            }

            const cleanContent = cleanMarkdown(law.content);
            if (cleanContent.length < 100) {
                console.log(`⚠️ Văn bản ${docId} có nội dung quá ngắn sau khi lọc. Bỏ qua.`);
                continue;
            }
            // BƯỚC A: LƯU VÀO SQL SERVER (Chỉ chạy nếu chưa có dòng nào trong DB)
            if (shouldInsertSQL) {
                console.log(`💾 Đang lưu mới vào SQL Server...`);
                await pool.request()
                    .input('id', sql.NVarChar(100), docId)
                    .input('title', sql.NVarChar(500), law.title)
                    .input('docNum', sql.NVarChar(100), law.documentNumber || 'Chưa cập nhật')
                    .input('year', sql.Int, typeof law.issueYear === 'number' ? law.issueYear : 2026)
                    .input('status', sql.NVarChar(50), law.status)
                    .input('category', sql.NVarChar(100), law.category || 'Lĩnh vực khác')
                    .input('content', sql.NVarChar(sql.MAX), cleanContent)
                    .input('url', sql.NVarChar(1000), law.sourceUrl || '')
                    .input('createdAt', sql.DateTime2, new Date(law.createdAt || Date.now()))
                    .query(`
            INSERT INTO dbo.LegalDocuments 
            (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, SourceUrl, CreatedAt, SyncStatusSsms, SyncStatusPinecone)
            VALUES (@id, @title, @docNum, @year, @status, @category, @content, @url, @createdAt, 'success', 'pending')
        `);
            }
            // BƯỚC B: TẠO VECTOR VÀ ĐẨY LÊN PINECONE
            if (shouldVectorize) {
                console.log(` Đang tiến hành Vector hóa và đẩy lên Pinecone...`);
                const chunkData = smartChunk(cleanContent);
                const vectors = [];
                const safeVectorId = toAsciiId(docId);

                for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                    try {
                        const embedResult = await embedModel.embedContent(chunkData[chunkIdx].text);
                        vectors.push({
                            id: `${safeVectorId}_chunk_${chunkIdx}`, // <--- DÙNG ID SẠCH Ở ĐÂY
                            values: Array.from(embedResult.embedding.values).map(Number),
                            metadata: {
                                doc_id: docId, // Vẫn giữ lại docId có dấu trong metadata để sau này truy vấn SQL
                                title: law.title,
                                doc_type: 'law',
                                text: chunkData[chunkIdx].text,
                                chunk_length: chunkData[chunkIdx].text.length,
                                text_preview: chunkData[chunkIdx].text.substring(0, 300),
                                source: law.sourceUrl || ''
                            }
                        });
                        await new Promise(r => setTimeout(r, 2000));
                    } catch (e) {
                        if (e.message && e.message.includes('429')) {
                            console.log(`⏳ Quá tải Gemini, nghỉ 60s...`);
                            await new Promise(r => setTimeout(r, 60000));
                            chunkIdx--; continue;
                        } else {
                            console.error(`❌ Lỗi vector chunk ${chunkIdx}:`, e.message);
                        }
                    }
                }

                // BƯỚC C: CHỐT HẠ
                if (vectors.length > 0) {
                    for (let j = 0; j < vectors.length; j += 50) {
                        await index.upsert(vectors.slice(j, j + 50));
                    }

                    await pool.request().input('id', sql.NVarChar(100), docId)
                        .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

                    console.log(`✅ Hoàn tất lưu DB & Pinecone!`);
                    count++;
                } else {
                    console.log(`⚠️ Đã lưu DB nhưng Pinecone THẤT BẠI do không tạo được vector!`);
                }
            }
        }
        console.log(`\n🎉 XUẤT SẮC! Đã nạp thành công ${count} văn bản hoàn chỉnh vào hệ thống LegAI.`);
        process.exit(0);

    } catch (err) {
        console.error("❌ LỖI NGHIÊM TRỌNG:", err);
        process.exit(1);
    }
};

importData();