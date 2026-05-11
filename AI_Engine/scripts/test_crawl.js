const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 20
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl = "https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Vien-chuc-2025-so-129-2025-QH15-675261.aspx";

    try {
        console.log("🚀 Đang tiến quân vào website...");
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log("🖱️ Đang tự động cuộn trang (Cuộn động theo độ dài thực tế)...");
        await autoScroll(page);

        await new Promise(r => setTimeout(r, 2000));

        console.log("🧐 Đang bóc tách và dọn dẹp dữ liệu...");
        const data = await page.evaluate(() => {
            const noise = [
                'header', 'footer', '.header', '.footer',
                '#divLeftControl', '.menu-links', '.sidebar',
                '.right-col', '#toTop', '.news-relate', '.vb-tabs',
                '#divRelate', '.box-keyword', '.relate-doc',
                '.tin-lien-quan', '#pnRight', '.pnRight',
                '.box-lien-quan', '.tag-list',
                '[id*="Right"]', '[class*="right"]'
            ];
            noise.forEach(s => {
                const elements = document.querySelectorAll(s);
                elements.forEach(el => el.style.display = 'none');
            });

            const title = document.querySelector('h1')?.innerText.trim() ||
                document.querySelector('.title-vb')?.innerText.trim() || "Không tìm thấy tiêu đề";

            const contentSelectors = ['#divNoiDung', '.content-vb', '.content-html', '#ctl00_CPH_Main_ctl00_pnlContent'];

            let mainContent = "";
            for (let s of contentSelectors) {
                const el = document.querySelector(s);
                if (el && el.innerText.length > 500) {
                    mainContent = el.innerText;
                    break;
                }
            }

            if (!mainContent) {
                const allDivs = Array.from(document.querySelectorAll('div'));
                const legalDiv = allDivs.find(d => d.innerText.includes('Điều 1.') && d.innerText.length > 1000);
                if (legalDiv) mainContent = legalDiv.innerText;
            }

            let finalContent = mainContent ? mainContent.trim() : "Lỗi: Không tìm thấy nội dung.";

            // --- 1. CẮT RÁC Ở ĐẦU ---
            const startKeywords = ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "QUỐC HỘI", "CHÍNH PHỦ", "ỦY BAN NHÂN DÂN"];
            let firstIndex = -1;
            for (let kw of startKeywords) {
                let idx = finalContent.indexOf(kw);
                if (idx !== -1 && idx < 2000) {
                    if (firstIndex === -1 || idx < firstIndex) {
                        firstIndex = idx;
                    }
                }
            }
            if (firstIndex > 0) {
                finalContent = finalContent.substring(firstIndex);
            }

            // --- 2. TÌM MỎ NEO Ở ĐUÔI ---
            const endAnchors = [
                "CHỦ TỊCH QUỐC HỘI", "TM. ỦY BAN THƯỜNG VỤ QUỐC HỘI",
                "TM. CHÍNH PHỦ", "THỦ TƯỚNG CHÍNH PHỦ",
                "KT. BỘ TRƯỞNG", "Nơi nhận:", "CHỦ TỊCH"
            ];

            let bestCutIndex = -1;

            for (let anchor of endAnchors) {
                let idx = finalContent.lastIndexOf(anchor);
                if (idx !== -1 && idx > finalContent.length * 0.6) {
                    // Cắt lấy dư 100 ký tự để bao trọn tên người ký
                    let cutPoint = idx + anchor.length + 100;
                    if (cutPoint > bestCutIndex) {
                        bestCutIndex = cutPoint;
                    }
                }
            }

            if (bestCutIndex !== -1) {
                finalContent = finalContent.substring(0, bestCutIndex);
            }

            // --- 3. LƯỚI LỌC RÁC SIÊU MỊN CHỐT HẠ ---
            // Đã bổ sung các nút Share mà sếp vừa phát hiện
            const trashKeywords = [
                "Lưu trữ", "Ghi chú", "Ý kiến", "Facebook", "Email", "In", "Bài liên quan:", // Rác UI
                "Từ khóa:", "Văn bản liên quan", "Bản án liên quan",
                "PHÁP LUẬT DOANH NGHIỆP", "Pháp Luật Thuế", "Chính sách Pháp luật mới",
                "Tổng hợp toàn văn", "Tiếng Anh |", "Lược đồ |", "Tải về"
            ];

            let firstTrashIndex = finalContent.length;
            for (let kw of trashKeywords) {
                let idx = finalContent.indexOf(kw, finalContent.length - 1500);
                if (idx !== -1 && idx < firstTrashIndex) {
                    firstTrashIndex = idx;
                }
            }

            finalContent = finalContent.substring(0, firstTrashIndex).trim();

            return { title, content: finalContent };
        });
        console.log("\n================ KẾT QUẢ BÓC TÁCH ================");
        console.log("📝 Tiêu đề:", data.title);
        console.log("📏 Độ dài nội dung:", data.content.length, "ký tự");

        console.log("\n--- TRÍCH ĐOẠN 1000 KÝ TỰ ĐẦU TIÊN ---");
        console.log(data.content.substring(0, 1000) + "...");

        // THÊM ĐOẠN NÀY ĐỂ CHECK EXPECTED RESULT CỦA SẾP
        console.log("\n--- TRÍCH ĐOẠN 500 KÝ TỰ CUỐI CÙNG ---");
        console.log(data.content.substring(data.content.length - 500));
        console.log("====================================================\n");

    } catch (err) {
        console.error("❌ Lỗi Scrape:", err.message);
    } finally {
        console.log("✅ Xong việc! Chờ 5 giây rồi đóng trình duyệt.");
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
})();

// --- GIẢI QUYẾT VẤN ĐỀ 2: CUỘN TRANG ĐỘNG ---
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let distance = 500; // Tăng khoảng cách cuộn để duyệt luật dài nhanh hơn
            let maxScrolls = 300; // Giới hạn an toàn (khoảng 300 lần cuộn là đủ cho văn bản rất dài)
            let scrolls = 0;

            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                scrolls++;

                // Logic cuộn động: Kiểm tra xem thanh cuộn đã chạm đáy trang chưa
                // (Vị trí hiện tại + Chiều cao màn hình >= Tổng chiều cao trang)
                if ((window.innerHeight + window.scrollY) >= scrollHeight || scrolls >= maxScrolls) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}