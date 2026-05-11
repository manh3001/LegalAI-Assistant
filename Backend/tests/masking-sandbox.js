const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../AI_Engine/.env') });

// Phải có ngoặc nhọn { maskingEngine } ở đây
const { maskingEngine } = require('../../AI_Engine/src/controllers/aiController');
class MaskingTestRunner {
    constructor() {
        this.testCases = [
            {
                name: "1. Ambiguity - Họ trùng từ vựng nâng cao",
                input: "Lý do xử lý hồ sơ liên quan đến Dương tính và Lâm nghiệp địa phương."
                // Kỳ vọng: Không mask 'Lý', 'Hồ', 'Dương', 'Lâm'
            },
            {
                name: "2. Nested Entities - Person trong Company",
                input: "Công ty TNHH Nguyễn Văn A Group do ông Nguyễn Văn A làm đại diện."
                // Kỳ vọng: [COMPANY_1] do [PERSON_1] làm đại diện
            },
            {
                name: "3. Nested Entities - Company trong Person context",
                input: "Ông Trần Văn B làm việc tại Công ty Cổ phần Trần Văn B Holdings."
                // Kỳ vọng: [PERSON_1] làm việc tại [COMPANY_1]
            },
            {
                name: "4. Complex Phone - Dính chữ",
                input: "Hotline:0905.999.888gặpA hoặc 0912-345-678liền."
                // Kỳ vọng: Mask cả 2 SĐT
            },
            {
                name: "5. Complex Phone - Xuống dòng",
                input: "Liên hệ: 0905\n999\n888 hoặc +84 912 345 678."
                // Kỳ vọng: Mask cả 2 SĐT
            },
            {
                name: "6. False Positive - Số tiền vs Raw ID",
                input: "Thanh toán 1234567890 VNĐ vào ngày 12/12/2024."
                // Kỳ vọng: Không mask (vì là tiền + ngày)
            },
            {
                name: "7. Raw ID thật vs số tiền",
                input: "Mã giao dịch: 123456789012345, số tiền: 2000000000đ."
                // Kỳ vọng: Mask mã giao dịch, không mask tiền
            },
            {
                name: "8. Complex Name - Họ kép",
                input: "Ông Âu Dương Minh Hoàng ký hợp đồng."
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "9. Complex Name - 5 từ",
                input: "Bà Nguyễn Thị Thanh Hương Lan đại diện bên B."
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "10. ALL CAPS Name",
                input: "ÔNG TRẦN VĂN C ký hợp đồng."
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "11. Boundary - Đầu câu",
                input: "Nguyễn Văn D là người đại diện pháp luật."
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "12. Boundary - Cuối câu",
                input: "Người chịu trách nhiệm là Lê Văn E"
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "13. Boundary - Trong ngoặc",
                input: "Đại diện (Nguyễn Văn F) ký tên."
                // Kỳ vọng: [PERSON_1]
            },
            {
                name: "14. Email + SĐT dính nhau",
                input: "Email:abc@gmail.com0905999888"
                // Kỳ vọng: Mask cả email và SĐT
            },
            {
                name: "15. Company viết tắt + tên riêng",
                input: "CTY TNHH MTV Lê Hoàng Phúc."
                // Kỳ vọng: [COMPANY_1]
            },
            {
                name: "16. Ambiguity nâng cao - từ ghép",
                input: "Đặng biệt lưu ý rằng hồ sơ lâm nghiệp chưa hoàn tất."
                // Kỳ vọng: Không mask 'Đặng', 'Hồ', 'Lâm'
            },
            {
                name: "17. Raw ID sát dấu câu",
                input: "Số CCCD:123456789012, cấp ngày 01/01/2020."
                // Kỳ vọng: Mask CCCD
            },
            {
                name: "18. Phone + ký tự đặc biệt",
                input: "Liên hệ: [0905-999-888]; hoặc {+84.912.345.678}"
                // Kỳ vọng: Mask cả 2 SĐT
            },
            {
                name: "19. Company chứa số và ký tự",
                input: "Công ty TNHH ABC123 Việt Nam."
                // Kỳ vọng: [COMPANY_1]
            },
            {
                name: "20. Mixed tất cả - combo địa ngục",
                input: "Ông Nguyễn Văn A (CCCD:123456789012) làm việc tại Công ty TNHH Nguyễn Văn A Group, email: nguyenvana@gmail.com, SĐT:0905 999 888, số tiền 1000000000đ."
                // Kỳ vọng: Mask PERSON, CCCD, COMPANY, EMAIL, SĐT; không mask tiền
            }
        ];
    }

    run() {
        console.log("====================================================");
        console.log("🛡️  LEGAI MASKING ENGINE - STRESS TEST VER20");
        console.log("====================================================\n");

        this.testCases.forEach((c, index) => {
            console.log(`[TEST ${index + 1}]: ${c.name}`);
            const { maskedText, entityMap } = maskingEngine(c.input);

            console.log(`- Input:  ${c.input}`);
            console.log(`- Output: ${maskedText}`);
            console.log(`- Map:   `, entityMap);
            console.log("----------------------------------------------------\n");
        });
    }
}

new MaskingTestRunner().run();