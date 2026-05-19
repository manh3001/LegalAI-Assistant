const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sql, poolConnect, pool } = require('../src/config/db');
const { Pinecone } = require('@pinecone-database/pinecone');

// --- 1. KHỞI TẠO TRỰC TIẾP GEMINI EMBEDDING (ĐỒNG BỘ BẢN 001 - 768 DIMENSIONS) ---
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// --- HÀM TẨY DẤU TIẾNG VIỆT CHO PINECONE ID ---
const toAsciiId = (str) => {
    if (!str) return 'doc';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9_-]/g, "-");
};

const cleanLegalContent = (text) => {
    if (!text) return "";
    const uiNoise = [
        /Sign in/gi, /Download/gi, /Related Documents/gi,
        /Feedback/gi, /Search/gi, /View more/gi, /Print/gi
    ];
    let cleaned = text;
    uiNoise.forEach(regex => { cleaned = cleaned.replace(regex, ""); });
    cleaned = cleaned.replace(/\[+?\d+\]+/g, "");
    const paragraphs = cleaned.split('\n\n');
    const uniqueParagraphs = paragraphs.filter((item, index) => paragraphs.indexOf(item) === index);
    return uniqueParagraphs.join('\n\n');
};

const cleanMarkdown = (text) => {
    if (!text) return "";
    let cleaned = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\|(\s*-+\s*\|)+/g, '')
        .replace(/\|/g, ' ')
        .replace(/(\*\*|\*|#|__|_|`)/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\\/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return cleanLegalContent(cleaned);
};

// --- HÀM MỚI: SEMANTIC CHUNKING (BĂM THEO ĐIỀU/KHOẢN) ---
const smartChunk = (content) => {
    if (!content) return [];
    const chunks = [];

    // Tách khối mỗi khi gặp chữ "Điều [số]" nằm ở đầu dòng
    const regex = /(?=\n\s*Điều\s+\d+[a-zA-ZđĐ]*[\.:\s])/g;
    const parts = content.split(regex);

    parts.forEach(part => {
        const text = part.trim();
        if (text.length > 0) {
            // Trích xuất xem đoạn text này thuộc Điều mấy
            const dieuMatch = text.match(/^(Điều\s+\d+[a-zA-ZđĐ]*)/i);
            const dieu = dieuMatch ? dieuMatch[1] : "Không rõ";

            // CƠ CHẾ BẢO VỆ: Nếu 1 Điều quá dài (> 2500 ký tự) thì băm nhỏ theo độ dài để tránh lỗi API
            if (text.length > 2500) {
                const subChunks = text.match(/[\s\S]{1,1500}(?!\S)/g) || [text];
                subChunks.forEach(sub => chunks.push({ text: sub.trim(), dieu: dieu }));
            } else {
                chunks.push({ text: text, dieu: dieu });
            }
        }
    });

    return chunks;
};

const importData = async () => {
    try {
        console.log("⏳ Bắt đầu kết nối Database...");
        await poolConnect;

        const dataPath = path.join(__dirname, '../data', 'data_test.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const laws = JSON.parse(rawData);

        console.log(`📂 Đã tải ${laws.length} văn bản từ data_test.json.`);

        // TRỎ THẲNG VÀO INDEX MỚI V2
        const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index-v2';
        const index = pc.index(indexName);

        let count = 0;
        const totalLaws = laws.length;
        let processedCount = 0;

        for (const law of laws) {
            processedCount++;
            console.log(`\n📊 TIẾN ĐỘ: [${processedCount}/${totalLaws}]`);
            if (law.status !== "Còn hiệu lực") continue;

            const docId = law.id;
            console.log(`\n📌 Đang xử lý: ${docId} - ${law.title.substring(0, 50)}...`);

            const check = await pool.request()
                .input('id', sql.NVarChar(100), docId)
                .query('SELECT Id, SyncStatusPinecone FROM LegalDocuments WHERE Id = @id');

            let shouldInsertSQL = true;
            let shouldVectorize = true;

            if (check.recordset.length > 0) {
                // ÉP HỆ THỐNG ĐẨY LẠI DATA ĐỂ NẠP LÊN V2 DÙ DB ĐÃ LƯU RỒI
                console.log(`⚠️ Đã có trong DB, đang ép chạy lại để đẩy vector ngữ nghĩa lên Pinecone V2...`);
                shouldInsertSQL = false;
                shouldVectorize = true;
            }

            const cleanContent = cleanMarkdown(law.content);
            if (cleanContent.length < 100) {
                console.log(`⚠️ Văn bản ${docId} có nội dung quá ngắn sau khi lọc. Bỏ qua.`);
                continue;
            }

            // BƯỚC A: LƯU VÀO SQL SERVER
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

            // BƯỚC B: TẠO VECTOR NGỮ NGHĨA VÀ ĐẨY LÊN PINECONE
            if (shouldVectorize) {
                console.log(`🚀 Đang tiến hành Vector hóa và đẩy lên Pinecone V2...`);
                const chunkData = smartChunk(cleanContent);
                const vectors = [];
                const safeVectorId = toAsciiId(docId);

                for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                    try {
                        const embedResult = await embedModel.embedContent({
                            content: {
                                role: "user",
                                parts: [{ text: chunkData[chunkIdx].text }]
                            },
                            taskType: "RETRIEVAL_DOCUMENT"
                        });

                        // CÔNG NGHỆ MRL: Chủ động cắt vector khổng lồ xuống đúng 768 chiều cho khớp Pinecone
                        const vector768 = Array.from(embedResult.embedding.values).slice(0, 768).map(Number);

                        vectors.push({
                            id: `${safeVectorId}_chunk_${chunkIdx}`,
                            values: vector768, // <-- Nạp mảng 768 chiều vào đây
                            metadata: {
                                doc_id: docId,
                                title: law.title,
                                doc_type: 'law',
                                text: chunkData[chunkIdx].text,
                                dieu: chunkData[chunkIdx].dieu,
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

                    console.log(`✅ Hoàn tất đẩy lên Pinecone V2!`);
                    count++;
                } else {
                    console.log(`⚠️ Đã xử lý nhưng tạo Vector THẤT BẠI!`);
                }
            }
        }
        console.log(`\n🎉 XUẤT SẮC! Đã nạp thành công ${count} văn bản với kiến trúc Semantic Chunking vào V2.`);
        process.exit(0);

    } catch (err) {
        console.error("❌ LỖI NGHIÊM TRỌNG:", err);
        process.exit(1);
    }
};

importData();