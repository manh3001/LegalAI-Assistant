const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pinecone } = require('@pinecone-database/pinecone');

async function checkSystem() {
    try {
        console.log("=== HỆ THỐNG KIỂM TRA LONG MẠCH PINECONE PRO ===");
        console.log(`📡 Đang đọc tệp .env...`);
        console.log(`   Target Index Name từ .env: [${process.env.PINECONE_INDEX_NAME}]`);

        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        
        // 1. Kiểm tra cấu hình thực tế của Index trên Cloud
        console.log(`\n🕵️ Đang truy vấn cấu hình thực tế trên Pinecone Cloud...`);
        const indexDescription = await pc.describeIndex(process.env.PINECONE_INDEX_NAME);
        
        console.log(`📊 [KẾT QUẢ CLOUD]:`);
        console.log(`   - Tên Index hoạt động: ${indexDescription.name}`);
        console.log(`   - Chiều rộng thực tế (Dimension): ${indexDescription.dimension} 🌟 (XEM SỐ NÀY CHÍNH XÁC CHẤM ĐIỂM)`);
        console.log(`   - Trạng thái cụm máy chủ: ${indexDescription.status.state}`);

    } catch (error) {
        console.error("❌ Lỗi khi check Pinecone:", error.message);
    }
}

checkSystem();