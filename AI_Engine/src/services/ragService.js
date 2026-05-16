// File: src/services/ragService.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');

const PINECONE_INDEX_NAME = "legai-index";
let genAI;
let pc;
let index;
let embedModel;

// 1. Khởi tạo kết nối hệ thống
const initCloudServices = () => {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // BẮT BUỘC: Đồng bộ với model đã upload (768dims)
        embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    }
    if (!pc) {
        pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        index = pc.index(PINECONE_INDEX_NAME);
    }
};

// 2. Hàm tìm kiếm tri thức pháp luật từ Cloud
const query = async (queryText, k = 5) => {
    try {
        if (!index) initCloudServices();

        console.log(`🔍 Đang truy vấn Cloud cho: "${queryText}"`);

        // Biến câu hỏi thành Vector (3072 chiều)
        const result = await embedModel.embedContent(queryText);
        const queryVector = Array.from(result.embedding.values);

        // Tìm trên Pinecone
        const searchResults = await index.query({
            vector: queryVector,
            topK: k,
            includeMetadata: true
        });

        if (searchResults.matches && searchResults.matches.length > 0) {
            console.log(` Đã lấy được ${searchResults.matches.length} tài liệu từ Pinecone.`);

            return searchResults.matches.map(match => ({
                id: match.id,
                title: match.metadata.title || "Tài liệu Pháp luật",
                content: match.metadata.text || "Nội dung không khả dụng",
                sourceUrl: match.metadata.source_url || "#",
                score: match.score
            }));
        }

        return [];
    } catch (error) {
        console.error(" Lỗi Pinecone RAG:", error.message);
        return [];
    }
};

module.exports = { query };