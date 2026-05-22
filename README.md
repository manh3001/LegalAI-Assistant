# ⚖️ Hệ thống LegAI HUB Ecosystem
> Ứng dụng tư vấn pháp lý tích hợp AI phân tích hợp đồng và kiểm định truyền thông số.

---

## 🚀 1. Tổng quan Kiến trúc Hệ thống (Technical Stack)
Dự án tuân thủ triết lý thiết kế tối giản, hiệu năng cao và đồng bộ cấu trúc tuyệt đối bằng cơ chế Single-Language Orchestration (Hợp nhất ngôn ngữ) bằng 100% môi trường JavaScript:
- Frontend: React.js, Tailwind CSS (Tôn vinh khoảng không âm và Typography tối giản), Recharts, Heroicons.
- Backend: Node.js, Express Framework.
- Database: Microsoft SQL Server (SSMS).
- AI Base Core: Gemini API & Vector Database Pinecone.

---

## 🧠 2. Chi tiết 5 Chức năng AI Cốt lõi của Hệ thống

1. AI Tạo lập & Soạn thảo Văn bản mẫu: 
   Tự động khởi tạo phôi hợp đồng thương mại hoàn chỉnh dựa trên các tham số cấu hình chi tiết (Họ tên, CCCD, MST, STK Ngân hàng, Địa chỉ) từ người dùng nhập từ Form, tự động xử lý chiều cao co giãn linh hoạt trên giao diện.
   - Giao diện khởi tạo nằm trong thư mục frontend: [Frontend](Frontend)

2. AI Thẩm định & Rà soát Hợp đồng (Phân hệ @ContractAnalysis.jsx): 
   Bóc tách, phân loại các điều khoản rủi ro theo cấp độ hành chính Việt Nam: Nguy hiểm (Dangerous - trừ 40đ), Rủi ro cao (High Risk - trừ 20đ), Lưu ý (Advisory - trừ 10đ). Chấm điểm an toàn tự động dựa trên thuật toán Algorithmic-Deterministic kết hợp công thức ép trần CAP điểm số nghiêm ngặt.
   - Thành phần trình diễn kết quả và xuất lịch sử nằm trong [Frontend/src/components/AnalysisDetailView.jsx](Frontend/src/components/AnalysisDetailView.jsx)

3. AI Kiểm định nội dung Video (Phân hệ @VideoAnalysisDetailView.jsx): 
   Phân tích chuỗi dòng dữ liệu văn bản, trích xuất phụ đề, âm thanh và ngữ cảnh video để cảnh báo các nội dung vi phạm pháp luật truyền thông hoặc chính sách hành chính Việt Nam công khai.
   - Thành phần UI: [Frontend/src/components/VideoAnalysisDetailView.jsx](Frontend/src/components/VideoAnalysisDetailView.jsx)

4. AI Tra cứu văn bản pháp luật & RAG Nội bộ: 
   Sử dụng Vector Database (Pinecone) để lưu trữ và truy xuất nhúng (Embedding) nhanh các phân đoạn văn bản luật lưu trữ cục bộ, làm khiên chốt chặn đối chiếu trực diện các rủi ro pháp lý.
   - API routing và điểm chốt RAG nằm tại: [AI_Engine/src/routes/apiRoutes.js](AI_Engine/src/routes/apiRoutes.js)
   - Lớp tích hợp Gemini (LLM) và hai giai đoạn xử lý: [AI_Engine/src/services/geminiService.js](AI_Engine/src/services/geminiService.js)

5. AI Quản lý & Kết xuất Hồ sơ lịch sử (@AnalysisDetailView.jsx): 
   Hỗ trợ lưu trữ lịch sử phẳng lỳ vào SQL Server, tự động bốc trường phẳng FileName gốc hiển thị lên ô phôi trực quan (Không render text thô rườm rà), bảo vệ cấu trúc Layout tối giản và hỗ trợ in ấn kết xuất PDF chuẩn hành chính.

---

## ⚡ 3. Các Chế độ Crawl & Van điều phối thông minh (LegAI Router)

- Kiến trúc Phân rã hai giai đoạn (Two-Phase Processing): 
  Giai đoạn 1 tự động ngắt cổng Internet Search, ép chạy cục bộ để quét nhanh file văn bản nặng, phòng chống lỗi tràn băng thông và Rate-Limit. Giai đoạn 2 tự động cô lập các câu lỗi ngắn ra để phóng truy vấn siêu nhẹ lên đám mây.

- Cơ chế Tự động mở van Google Search Grounding: 
  Khi kho RAG nội bộ bị giới hạn phân đoạn hoặc dữ liệu luật bị khuyết, hệ thống tự động kích hoạt chế độ Auto Crawl mạng trực tuyến từ các nguồn chính thống uy tín cao (vbpl.vn, thuvienphapluat.vn) để điền chính xác số Điều, số Khoản, xóa sạch vết N/A trên giao diện.

- Cơ chế Bẻ lái Failover dự phòng (Mạng nghẽn 503/429): 
  Khi cổng cào mạng của Google bị quá tải hoặc dính gậy chặn quota, LegAI Router tự động ngắt kết nối Search, bẻ ghi luồng cứu hộ ép chạy bằng Tri thức nền LLM nội tại nhằm đảm bảo tính sẵn sàng cao (High Availability), không bao giờ để treo tiến trình hay làm sập giao diện của người dùng.

- Bộ Scheduler và Dọn dẹp tự động: 
  Lên lịch tuần tự kiểm tra lịch cào dữ liệu, tự động xóa bỏ các tệp dữ liệu tạm sau khi bóc tách xong để giải phóng tài nguyên máy chủ.

---

## 💻 4. Hướng dẫn Khởi chạy và Vận hành (Cài đặt đồ)

### 🔹 4.1. Khởi chạy Backend Server
1. Cài đặt môi trường Microsoft SQL Server, tạo cơ sở dữ liệu và cấu hình bảng `Records` chứa các trường phẳng: `Id`, `Title`, `FileName`, `ContractText`, `AnalysisJson`, `RiskScore`.
2. Di chuyển vào thư mục backend và cấu hình file `.env` (ví dụ cho Node/Express ở `AI_Engine`):

```env
PORT=8000
DB_USER=sa
DB_PASSWORD=Mật_Khẩu_SQL_Server_Của_Bạn
DB_SERVER=localhost
DB_DATABASE=Tên_Database_Của_Bạn
GEMINI_API_KEY=AIzaSyMã_API_Key_Gemini
PINECONE_API_KEY=YOUR_PINECONE_KEY
PINECONE_ENV=YOUR_PINECONE_ENV
```

Chạy lệnh cài đặt và kích nguồn server (thư mục khởi chạy: `AI_Engine` nếu dùng Node):

```bash
cd AI_Engine
npm install
npm run dev
```

> Lưu ý: Nếu backend chính của bạn là Laravel nằm trong `Backend/`, giữ cấu trúc và chuyển đổi endpoint tương ứng hoặc dùng song hành (Node cho AI microservices + Laravel cho core app).

🔹 4.2. Khởi chạy Frontend React
Di chuyển vào thư mục frontend:

```bash
cd Frontend
npm install
npm start
```

Frontend sử dụng React + Tailwind; các view chính quản lý phân tích nằm trong [Frontend/src/components](Frontend/src/components).

---

## ✅ 5. Tích hợp Kỹ thuật & Vị trí mã nguồn quan trọng
- API routing (điểm vào REST/Graph endpoints): [AI_Engine/src/routes/apiRoutes.js](AI_Engine/src/routes/apiRoutes.js)
- Lớp giao tiếp Gemini (hai giai đoạn xử lý, local-first then cloud): [AI_Engine/src/services/geminiService.js](AI_Engine/src/services/geminiService.js)
- Giao diện lịch sử và phân tích: [Frontend/src/components/AnalysisDetailView.jsx](Frontend/src/components/AnalysisDetailView.jsx)
- Giao diện kiểm định video: [Frontend/src/components/VideoAnalysisDetailView.jsx](Frontend/src/components/VideoAnalysisDetailView.jsx)

---

## 🔐 Bảo mật & Quyền truy cập
- Không lưu khóa API trực tiếp trong mã nguồn. Sử dụng biến môi trường trên server hoặc secret manager.
- Giới hạn truy cập endpoints nội bộ (RAG ingestion, Pinecone indexing) bằng API key nội bộ hoặc IP allowlist.

---

## 📦 Triển khai & Vận hành (Suggestions)
- Chạy AI microservice (AI_Engine) riêng với autoscaling khi cần xử lý hàng loạt file và RAG rebuild.
- Lưu trữ embeddings định kỳ trong Pinecone, rebuild delta khi dữ liệu luật thay đổi.
- Sử dụng job queue (Bull/Agenda) cho pipeline hai giai đoạn: bước 1 xử lý cục bộ (heavy-parsing), bước 2 gọi Gemini / external grounding cho kết luận.

---

## 📁 Tham khảo nhanh (File chính trong repo)
- [AI_Engine/src/routes/apiRoutes.js](AI_Engine/src/routes/apiRoutes.js)
- [AI_Engine/src/services/geminiService.js](AI_Engine/src/services/geminiService.js)
- [Frontend/src/components/AnalysisDetailView.jsx](Frontend/src/components/AnalysisDetailView.jsx)
- [Frontend/src/components/VideoAnalysisDetailView.jsx](Frontend/src/components/VideoAnalysisDetailView.jsx)
