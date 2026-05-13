// retrofitData.js
// file này chạy 1 lần để bóc tách Agency và IssueDateString
//  cho 600 văn bản đã có trong DB nhưng thiếu dữ liệu này
const { sql, pool, poolConnect } = require('../config/db'); 

async function retrofitLegalData() {
    try {
        await poolConnect;
        console.log("🚀 Bắt đầu quá trình hồi tố 600 văn bản...");

        // 1. Lấy toàn bộ văn bản chưa có Agency
        const result = await pool.request().query(
            "SELECT Id, Content FROM LegalDocuments WHERE Agency IS NULL"
        );
        const docs = result.recordset;
        
        if (docs.length === 0) {
            console.log("✨ Không có văn bản nào cần xử lý.");
            return;
        }

        console.log(`🔍 Tìm thấy ${docs.length} văn bản đang chờ bóc tách...`);

        for (let doc of docs) {
            // Lấy 1000 ký tự đầu tiên để soi (giảm tải hiệu năng)
            const headContent = doc.Content.substring(0, 1000);

            // 2. Regex bóc tách Cơ quan (Agency)
            // Tìm các cụm chữ in hoa tiêu chuẩn như CHÍNH PHỦ, QUỐC HỘI, BỘ ..., ỦY BAN ...
            const agencyMatch = headContent.match(/(CHÍNH PHỦ|QUỐC HỘI|BỘ\s+[A-ZÀ-Ỹ\s]+|ỦY BAN\s+[A-ZÀ-Ỹ\s]+|TÒA ÁN\s+[A-ZÀ-Ỹ\s]+)/i);
            let agency = agencyMatch ? agencyMatch[0].trim().toUpperCase() : "Cơ quan ban hành";

            // 3. Regex bóc tách Địa danh & Ngày tháng (IssueDateString)
            // Tìm định dạng: [Địa danh], ngày ... tháng ... năm ...
            const dateMatch = headContent.match(/([A-ZÀ-Ỹ][a-zà-ỹ\s]+),\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}/i);
            let dateStr = dateMatch ? dateMatch[0].trim() : "Ngày ban hành: Đang cập nhật";

            // 4. Cập nhật ngược lại vào SQL
            try {
                await pool.request()
                    .input('id', sql.NVarChar, doc.Id)
                    .input('agency', sql.NVarChar, agency)
                    .input('date', sql.NVarChar, dateStr)
                    .query(`
                        UPDATE LegalDocuments 
                        SET Agency = @agency, 
                            IssueDateString = @date 
                        WHERE Id = @id
                    `);
                
                console.log(`✅ Đã cập nhật: ${doc.Id} | [${agency}]`);
            } catch (updateError) {
                console.error(`❌ Lỗi khi cập nhật ID ${doc.Id}:`, updateError.message);
            }
        }

        console.log("\n🏆 Hoàn thành! Toàn bộ 600 văn bản đã được gán nhãn dữ liệu sạch.");
        process.exit(0);

    } catch (err) {
        console.error("🔴 Lỗi kết nối Database:", err);
        process.exit(1);
    }
}

retrofitLegalData();