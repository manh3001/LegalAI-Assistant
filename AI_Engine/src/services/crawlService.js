const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const e = require('express');

puppeteer.use(StealthPlugin());

// 1. Kiểm tra Key trước khi khởi tạo 
if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY) {
    console.error("\n [CẢNH BÁO]: Thiếu API Key trong file .env!");
    //process.exit(1);
}

// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Khởi tạo Pinecone client
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

// Trạng thái crawl
let crawlStatus = { isRunning: false, current: 0, total: 0, title: '', step: '' };
const getCrawlStatus = () => crawlStatus;

const extremeDeepClean = (text) => {
    if (!text) return "";
    return text
        .replace(/([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])[\s]*[\n\r]+[\s]*([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])/gi, '$1 $2')
        .replace(/([^.!?:\n])\n(?![A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ])[\s]*/g, '$1 ')
        .replace(/Qu\s+ốc hội/gi, 'Quốc hội')
        .replace(/Cộng\s+hòa/gi, 'Cộng hòa')
        .replace(/Xã\s+hội/gi, 'Xã hội')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
};

// ==========================================
// HÀM PUPPETEER 
// ==========================================
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let distance = 500;
            let maxScrolls = 300;
            let scrolls = 0;

            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                scrolls++;

                if ((window.innerHeight + window.scrollY) >= scrollHeight || scrolls >= maxScrolls) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

const scrapeContent = async (url) => {
    // Bước 1: Nhận diện loại văn bản
    const isCongVan = url.includes('/cong-van/');
    const minLen = isCongVan ? 200 : 500;


    const browser = await puppeteer.launch({
        headless: "new", // Chạy ngầm
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await autoScroll(page);
        await new Promise(r => setTimeout(r, 2000));

        const data = await page.evaluate((minLen) => {
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
                document.querySelector('.title-vb')?.innerText.trim() ||
                document.querySelector('#ctl00_mainContent_lblTitle')?.innerText.trim() ||
                document.querySelector('.title-vbp')?.innerText.trim() ||
                "Không tìm thấy tiêu đề";

            const contentSelectors = ['#divNoiDung', '.content-vb', '.content-html', '#ctl00_CPH_Main_ctl00_pnlContent'];

            const agency = document.querySelector('.left-header')?.innerText.trim() ||
                document.querySelector('.content-html p:first-child')?.innerText.trim() || "";

            // 2. Bóc tách Địa danh & Ngày tháng (Phía trên bên phải)
            const issueDateFull = document.querySelector('.right-header')?.innerText.match(/(.*ngày\s+\d+.*)/i)?.[0] || "";

            let mainContent = "";
            for (let s of contentSelectors) {
                const el = document.querySelector(s);
                if (el && el.innerText.length > minLen) { // Sử dụng minLen 
                    mainContent = el.innerText;
                    break;
                }
            }

            if (!mainContent) {
                const allDivs = Array.from(document.querySelectorAll('div'));
                const legalDiv = allDivs.find(d => d.innerText.includes('Điều 1.') && d.innerText.length > 800);
                if (legalDiv) mainContent = legalDiv.innerText;
            }

            let finalContent = mainContent ? mainContent.trim() : "Lỗi: Không tìm thấy nội dung.";

            // CẮT ĐẦU
            const startKeywords = ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "QUỐC HỘI", "CHÍNH PHỦ", "ỦY BAN NHÂN DÂN"];
            let firstIndex = -1;
            for (let kw of startKeywords) {
                let idx = finalContent.indexOf(kw);
                if (idx !== -1 && idx < 2000) {
                    if (firstIndex === -1 || idx < firstIndex) firstIndex = idx;
                }
            }
            if (firstIndex > 0) finalContent = finalContent.substring(firstIndex);

            // TÌM  Ở ĐUÔI
            const endAnchors = [
                "CHỦ TỊCH QUỐC HỘI", "TM. ỦY BAN THƯỜNG VỤ QUỐC HỘI",
                "TM. CHÍNH PHỦ", "THỦ TƯỚNG CHÍNH PHỦ",
                "KT. BỘ TRƯỞNG", "Nơi nhận:", "CHỦ TỊCH"
            ];
            let bestCutIndex = -1;
            for (let anchor of endAnchors) {
                let idx = finalContent.lastIndexOf(anchor);
                if (idx !== -1 && idx > finalContent.length * 0.6) {
                    let cutPoint = idx + anchor.length + 100;
                    if (cutPoint > bestCutIndex) {
                        bestCutIndex = cutPoint;
                    }
                }
            }
            if (bestCutIndex !== -1) {
                finalContent = finalContent.substring(0, bestCutIndex);
            }

            // LƯỚI LỌC RÁC CHỐT HẠ
            const trashKeywords = [
                "Lưu trữ", "Ghi chú", "Ý kiến", "Facebook", "Email", "In", "Bài liên quan:",
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

            return { title, agency, issueDateFull, content: finalContent };
        }, minLen);
        return data;
    } catch (err) {
        console.error(" Lỗi Scrape:", err.message);
        return null;
    } finally {
        await browser.close();
    }
};
// ==========================================

const processLegalCrawl = async (urlArray, io) => {
    try {
        crawlStatus = { isRunning: true, current: 0, total: urlArray.length, title: '', step: '' };
        console.log(" KIỂM TRA ĐẦU VÀO url:", JSON.stringify(urlArray));
        await poolConnect;

        let successCount = 0; let duplicateCount = 0; let failCount = 0;

        function smartChunk(content) {
            if (!content || typeof content !== 'string' || content.length === 0) return [];
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
        }

        for (let i = 0; i < urlArray.length; i++) {
            const url = String(urlArray[i] || '').trim();
            if (!url) continue;

            try {
                // Kiểm tra trùng lặp
                const checkResult = await pool.request()
                    .input('url', sql.NVarChar(1000), url)
                    .query('SELECT Id FROM dbo.LegalDocuments WHERE SourceUrl = @url');

                if (checkResult.recordset.length > 0) {
                    duplicateCount++; continue;
                }

                if (io) io.emit('crawl-progress', { ...crawlStatus, current: i + 1, title: 'Đang bóc tách dữ liệu...', step: 'crawl' });

                console.log(`[Crawl] Đang truy cập URL: ${url}`);

                // Gọi Puppeteer 
                const scrapedData = await scrapeContent(url);
                const minThreshold = url.includes('/cong-van/') ? 150 : 200;
                if (!scrapedData || !scrapedData.content || scrapedData.content.length < minThreshold) {
                    console.error(`Bỏ qua URL do bóc tách thất bại hoặc nội dung quá ngắn.`);
                    failCount++;
                    continue;
                }

                // Áp dụng DeepClean 
                const title = scrapedData.title;
                const content = extremeDeepClean(scrapedData.content);

                console.log(`[Crawl] Hoàn tất bóc tách | Độ dài: ${content.length}`);

                // Phân loại và ID
                const finalCategory = getCategoryFromUrl(url);
                const docNumMatch = content.substring(0, 1000).match(/([0-9]{1,4}\/[0-9]{4}\/[A-ZĐ0-9\-]{2,10})\b/);
                const documentNumber = docNumMatch ? docNumMatch[1] : "Đang cập nhật";

                if (documentNumber === "Đang cập nhật") {
                    const urlMatch = url.match(/([0-9]{1,4}-[A-Z0-9-]{2,10}-[0-9]{4})/i);
                    if (urlMatch) documentNumber = urlMatch[1].replace(/-/g, '/');
                }

                const urlSlug = url.split('/').pop().replace('.aspx', '');
                const yearMatch = documentNumber.match(/\d{4}/) || content.match(/năm\s+(20\d{2})/i);
                const issueYear = yearMatch ? parseInt(yearMatch[0] || yearMatch[1]) : new Date().getFullYear();
                let idSource = "";
                if (documentNumber && documentNumber !== "Đang cập nhật") {
                    idSource = documentNumber;
                } else if (title && title !== "Không tìm thấy tiêu đề") {
                    idSource = title;
                }
                else {
                    idSource = urlSlug;
                }
                let documentId = convertLegalStringToSlug(idSource);

                console.log(`Generated document ID: ${documentId}`);
                // gửi tín hiệu tiến độ để sáng Pipeline
                if (io) io.emit('crawl-progress', { ...crawlStatus, current: i + 1, title: 'Đang lưu vào SQL Server...', step: 'sql' });
                // Lưu SQL
                await pool.request()
                    .input('id', sql.NVarChar(100), documentId)
                    .input('title', sql.NVarChar(500), title)
                    .input('docNum', sql.NVarChar(100), documentNumber)
                    .input('year', sql.Int, issueYear)
                    .input('category', sql.NVarChar(100), finalCategory)
                    .input('content', sql.NVarChar(sql.MAX), content)
                    .input('sourceUrl', sql.NVarChar(1000), url)
                    .input('syncSsms', sql.NVarChar(50), 'success')
                    .input('syncPinecone', sql.NVarChar(50), 'pending')
                    .query(`
                        INSERT INTO dbo.LegalDocuments 
                        (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, SourceUrl, CreatedAt, SyncStatusSsms, SyncStatusPinecone) 
                        VALUES 
                        (@id, @title, @docNum, @year, N'Còn hiệu lực', @category, @content, @sourceUrl, GETDATE(), @syncSsms, @syncPinecone)
                    `);

                // Embedding & Pinecone 
                if (io) io.emit('crawl-progress', { ...crawlStatus, current: i + 1, title: 'Đang tạo vector...', step: 'pinecone' });

                const chunkData = smartChunk(content);
                const index = pc.index(process.env.PINECONE_INDEX_NAME || 'legai-index');
                const vectors = [];

                for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                    try {
                        const embedResult = await embedModel.embedContent(chunkData[chunkIdx].text);
                        vectors.push({
                            id: `${documentId}_chunk_${chunkIdx}`,
                            values: Array.from(embedResult.embedding.values).map(Number),
                            metadata: {
                                doc_id: documentId,
                                title: title,
                                doc_type: 'law',
                                text: chunkData[chunkIdx].text,
                                chunk_length: chunkData[chunkIdx].text.length,
                                text_preview: chunkData[chunkIdx].text.substring(0, 300),
                                source: url
                            }
                        });
                        await new Promise(r => setTimeout(r, 400));
                    } catch (chunkError) {
                        if (chunkError.message && chunkError.message.includes('429')) {
                            console.log(`Quá tải API nhúng Vector, tạm nghỉ 30 giây...`);
                            await new Promise(r => setTimeout(r, 30000));
                            chunkIdx--;
                            continue;
                        } else {
                            console.error(`Lỗi tạo vector tại chunk ${chunkIdx}:`, chunkError.message);
                        }
                    }
                }

                if (vectors.length > 0) {
                    for (let j = 0; j < vectors.length; j += 50) {
                        await index.upsert(vectors.slice(j, j + 50));
                    }
                    await pool.request()
                        .input('id', sql.NVarChar(100), documentId)
                        .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

                    successCount++;
                    console.log(`Xử lý thành công: ${title.substring(0, 50)}...`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    console.log(`Cảnh báo: Không tạo được vector cho tài liệu ${documentId}`);
                }

            } catch (urlError) {
                console.error(`Lỗi xử lý tại URL ${url}:`, urlError.message);
                failCount++;
            }
        }

        if (io) io.emit('crawl-progress', {
            isRunning: false,

            current: urlArray.length,
            total: urlArray.length,
            title: 'Hoàn thành!',
            step: 'done',
            result: { successCount, duplicateCount, failCount }
        });
        return { successCount, duplicateCount, failCount };

    } catch (error) {
        console.error('Lỗi hệ thống toàn cục:', error);
        throw error;
    }
};

const getCategoryFromUrl = (url) => {
    const categoryMap = {
        'Bo-may-hanh-chinh': 'Bộ máy hành chính', 'Van-hoa-Xa-hoi': 'Văn hóa - Xã hội', 'Tai-chinh-nha-nuoc': 'Tài chính nhà nước', 'The-thao-Y-te': 'Thể thao - Y tế', 'Tai-nguyen-Moi-truong': 'Tài nguyên - Môi trường', 'Thuong-mai': 'Thương mại', 'Bat-dong-san': 'Bất động sản', 'Xay-dung-Do-thi': 'Xây dựng - Đô thị', 'Giao-duc': 'Giáo dục', 'Dau-tu': 'Đầu tư', 'Lao-dong-Tien-luong': 'Lao động - Tiền lương', 'Cong-nghe-thong-tin': 'Công nghệ thông tin', 'Giao-thong-Van-tai': 'Giao thông - Vận tải', 'Doanh-nghiep': 'Doanh nghiệp', 'Thue-Phi-Le-Phi': 'Thuế - Phí - Lệ phí', 'Bao-hiem': 'Bảo hiểm', 'Tien-te-Ngan-hang': 'Tiền tệ - Ngân hàng', 'Xuat-nhap-khau': 'Xuất nhập khẩu', 'Quyen-dan-su': 'Quyền dân sự', 'Vi-pham-hanh-chinh': 'Vi phạm hành chính', 'Thu-tuc-To-tung': 'Thủ tục Tố tụng', 'Trach-nhiem-hinh-su': 'Trách nhiệm hình sự', 'Ke-toan-Kiem-toan': 'Kế toán - Kiểm toán', 'Dich-vu-phap-ly': 'Dịch vụ pháp lý', 'So-huu-tri-tue': 'Sở hữu trí tuệ', 'Chung-khoan': 'Chứng khoán'
    };
    const match = url.match(/\/van-ban\/([^\/]+)\//);
    const slug = match ? match[1] : null;
    return categoryMap[slug] || 'Lĩnh vực khác';
};

const convertLegalStringToSlug = (str) => {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};

module.exports = {
    processLegalCrawl,
    getCrawlStatus,
    getCategoryFromUrl,
    convertLegalStringToSlug
};