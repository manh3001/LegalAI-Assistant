# PHÂN TÍCH KỸ THUẬT CÁC TÍNH NĂNG AI HỆ THỐNG LEGALBOT

**Tác giả:** Hệ thống Phân tích AI  
**Ngày tạo:** 2026  
**Phiên bản:** 1.0  
**Mục đích:** Tài liệu khoa học kiến trúc hệ thống LegalAI cho Nghiên cứu cao cấp

---

## 1. ChatBot AI (Hệ thống Trò chuyện Trí tuệ Nhân tạo Pháp lý)

### 1.1. Đặt vấn đề (Problem Statement)

Hệ thống tư vấn pháp lý trực tuyến đặt ra bài toán lõi: làm sao cung cấp câu trả lời pháp lý chính xác, được căn cứ trên bộ luật hiện hành và đầy đủ bối cảnh, cho hàng triệu câu hỏi đa dạng từ người dùng? Phương pháp lập trình truyền thống không thể đáp ứng vì: (i) Cơ sở pháp luật Việt Nam chứa hàng chục ngàn văn bản được cập nhật hàng tháng; (ii) Mỗi câu hỏi có ngữ cảnh riêng biệt, đòi hỏi phân tích nhiều tầng; (iii) Cần kế thừa lịch sử đối thoại để giữ tính nhất quán logic. Hệ thống ChatBot AI giải quyết bằng cách tích hợp **Retrieval-Augmented Generation (RAG)** — trích xuất tài liệu pháp luật liên quan từ cơ sở dữ liệu Pinecone, sau đó cho mô hình Gemini sinh văn bản trả lời dựa trên ngữ cảnh đó.

### 1.2. Kiến trúc & Luồng hoạt động (Workflow)

**Bước 1 - Nhận yêu cầu từ người dùng:**  
Endpoint `/api/ai/ask` nhận dữ liệu POST chứa câu hỏi (`question` hoặc `message`), thực hiện kiểm tra hợp lệ cơ bản (không rỗng, đủ dài). Nếu không hợp lệ, trả về HTTP 400.

**Bước 2 - Trích xuất tài liệu via RAG:**  
Gọi `ragService.query(userQuery)` để tìm kiếm vector-based các tài liệu pháp luật liên quan từ Pinecone, trả về danh sách `relatedDocs` (mỗi doc chứa: `title`, `content`, `sourceUrl`, `dieu` — số Điều luật). Nếu RAG thất bại, log lỗi nhưng vẫn tiếp tục (fallback thành "Trả lời từ kiến thức chung").

**Bước 3 - Xây dựng Prompt với ngữ cảnh:**  
Dữ liệu tài liệu được chuyển hóa thành văn bản: `[TÀI LIỆU 1]: {title} (Điều {dieu})\nNội dung: {content}`. Lịch sử chat cũng được ghép vào prompt dưới dạng: `NGƯỜI DÙNG: {msg} | LEGAI: {response}`.

**Bước 4 - Gọi mô hình sinh văn bản:**  
`getActiveModel(prompt)` thực thi prompt với các model trong priority queue: `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-flash-latest`, có cơ chế retry và timeout 45 giây. Mô hình sinh text output thô.

**Bước 5 - Định dạng và trả về:**  
Hàm `generateAnswerWithGemini()` trả về văn bản trực tiếp (không cần wrapper JSON). Controller ghi lại thống kê sử dụng vào DB (`logUsage('CHATBOT')`), sau đó trả về JSON có cấu trúc:  
```json
{
  "success": true,
  "answer": "string-văn-bản-trả-lời",
  "sources": [
    {
      "title": "Tên tài liệu",
      "source": "URL hoặc 'Cơ sở dữ liệu nội bộ'"
    }
  ]
}
```

### 1.3. Phân tích Thuật toán & Công nghệ lõi (Core Logic)

Phần lõi của ChatBot là **cơ chế xác định kịch bản (Scenario Routing)**:  
Prompt chứa logic phân loại 3 kịch bản:
- **Kịch bản 1**: Giao tiếp & hỏi về AI → Trả lời ngắn gọn, thân thiện.
- **Kịch bản 2**: Câu hỏi ngoài chuyên môn / yêu cầu vi phạm pháp luật → Từ chối lịch sự.
- **Kịch bản 3**: Tư vấn pháp lý cụ thể → Cấu trúc 4 phần: Kết luận → Phân tích → Cơ sở pháp lý → Lời khuyên.

Thuật toán mô hình phân loại dựa trên pattern matching của từ khóa và ngữ pháp. Một khi kịch bản được xác định, mô hình Gemini (nhiệt độ 0.1 để logic cứng nhắc) sinh văn bản tuân thủ quy tắc ứng với từng kịch bản. 

**Cơ chế RAG (Retrieval)**: Sử dụng vector embedding — câu hỏi và tài liệu được chuyển thành vector 384-1536 chiều, sau đó tính cosine similarity để lấy top-K tài liệu gần nhất (K thường = 3-5). Điều này giúp hệ thống tìm luật liên quan nhanh chóng mà không cần lập chỉ mục full-text truyền thống.

**Cơ chế lịch sử ngữ cảnh**: Duy trì mảng `chatHistory[]` chứa `[{role, content}, ...]` để mô hình nhận biết chủ đề trước đó, tránh trả lời đột ngột lệch hướng.

### 1.4. Minh chứng Kỹ thuật (Code Snippet)

```javascript
// Dòng 25-42 trong aiController.js - phần lõi RAG
let relatedDocs = [];
try {
    relatedDocs = await ragService.query(userQuery);
} catch (err) {
    console.error('Lỗi RAG (sẽ trả lời bằng kiến thức chung):', err.message);
}
const answer = await geminiService.generateAnswerWithGemini(userQuery, relatedDocs);
return res.json({
    success: true,
    answer,
    sources: relatedDocs.map(doc => ({
        title: doc.title,
        source: doc.sourceUrl || 'Cơ sở dữ liệu nội bộ'
    }))
});
```

**Giải thích:** Hàm `ask()` trước tiên thực hiện truy vấn RAG. Nếu thất bại, log lỗi nhưng không làm gián đoạn luồng (fail-safe pattern). Sau đó truyền `relatedDocs` cho hàm sinh text. Kết quả trả về chứa cả câu trả lời (`answer`) và danh sách nguồn tài liệu (`sources`) — giúp người dùng kiểm chứng độ tin cậy.

---

## 2. Contract Review AI / Phân tích hợp đồng AI (Hệ thống Thẩm phán Hợp đồng Tự động)

### 2.1. Đặt vấn đề (Problem Statement)

Hợp đồng là công cụ pháp lý then chốt nhưng phần lớn người dùng không có kiến thức để nhận diện các điều khoản độc hại, thiếu sót hoặc vi phạm pháp luật. Bài toán đặt ra: thiết kế hệ thống tự động rà soát hợp đồng, xác định rủi ro pháp lý, gán điểm rủi ro từ 0-100, và đưa ra khuyến nghị sửa đổi — tất cả với mức độ bảo mật cao (bảo vệ dữ liệu nhạy cảm cá nhân như CCCD, tài khoản ngân hàng, tên công ty). 

Giải pháp được phân chia làm hai phần chính:
1. **Lớp bảo mật (PII Masking Engine)**: Che giấu thông tin định danh cá nhân trước khi gửi cho AI.
2. **Lớp phân tích (Multi-layer Risk Scoring)**: Ánh xạ các điều khoản hợp đồng thành 15 "trụ cột pháp lý", tính điểm rủi ro theo thuật toán xác định.

### 2.2. Kiến trúc & Luồng hoạt động (Workflow)

**Bước 1 - Upload & Trích xuất nội dung:**  
Endpoint `/api/ai/analyze-contract` nhận file (PDF, Word, TXT) qua multipart form. Hệ thống tự phát hiện MIME type, rồi dùng `pdf-parse`, `mammoth`, hoặc `fs.readFileSync()` để trích text thô (`contractText`).

**Bước 2 - Làm sạch text:**  
Gọi `cleanContractText(text)` — loại bỏ ký tự điều khiển (`\r\n\t\u0007\u0002`), rút gọn khoảng trắng thừa, trim.

**Bước 3 - Phát hiện dữ liệu đã được bảo vệ sẵn:**  
`detectPreMaskedData(text)` kiểm tra xem người dùng đã tự tay che giấu dữ liệu chưa (tìm pattern `***`, `[MASKED]`, `[HỌ_TÊN]`). Cờ `isUserPreMasked` được lưu để AI điều chỉnh cách xử lý.

**Bước 4 - Thực thi Masking Engine:**  
Gọi `maskingEngine(cleanedText, context)` — thuật toán chuyên dụng che giấu 7 loại thông tin nhạy cảm:
- **P1 (ID/Tài khoản)**: Regex `/cccd|cmnd|mst|stk|tài khoản/i` → giữ 3 ký tự đầu, che phần còn lại.
- **P2 (Email)**: `user@domain.com` → `u***@domain.com`.
- **P3 (Phone)**: `0901234567` → `0901****567`.
- **P4 (Công ty)**: Regex bắt tiền tố pháp nhân (Công ty, Ngân hàng, Tập đoàn...) + tên → `[COMPANY_1]`.
- **P5 (Cá nhân–Prefix)**: `Ông/Bà/Anh/Chị` + tên → `[PERSON_1]`.
- **P6 (Cá nhân–Standalone)**: Họ Việt Nam + tên → `[PERSON_2]`.
- **P7 (ID thô)**: Chuỗi số 6-15 ký tự → `12****`.

Kết quả: `{maskedText, entityMap}` — văn bản đã che giấu + bản đồ ánh xạ `PERSON_1 → "Nguyễn Văn A"`.

**Bước 5 - Gửi cho AI phân tích:**  
Gọi hàm `analyzeContract(finalMaskedText, isUserPreMasked)` trong `geminiService.js`. Prompt chứa 15 trụ cột pháp lý bắt buộc và công thức tính điểm rủi ro xác định (deterministic).

**Bước 6 - AI sinh JSON phân tích:**  
Mô hình Gemini trả về cấu trúc JSON chứa:
- `summary`: Tóm tắt hợp đồng và overall assessment.
- `risk_score`: Điểm 0-100, được tính bằng thuật toán có CAP logic.
- `analysis_report`: Mảng các phát hiện, mỗi phát hiện gồm: pillar (trụ cột), severity (Dangerous/High/Advisory), clause (văn bản nguyên gốc), issue (vấn đề), solution (đề xuất sửa).
- `evaluation_flags`: Cờ `has_void_risk`, `has_unbalanced_terms`.

**Bước 7 - Trả về kết quả:**  
Controller trả về JSON, sau đó xóa file tạm trên server.

### 2.3. Phân tích Thuật toán & Công nghệ lõi (Core Logic)

**A. Thuật toán Masking (SpanManager):**

Hệ thống masking sử dụng kỹ thuật **Span Conflict Resolution** — bởi một ký tự có thể vừa khớp pattern ID vừa khớp pattern Phone, cần quyết định ưu tiên nào. 

Giải pháp: Duy trì danh sách `candidates` của tất cả match, sắp xếp theo `priority` (1-7) và độ dài (longest match preferred). Sau đó lọc để loại bỏ overlap:
```
for each candidate in sorted_list:
    if no prior candidates overlap with current:
        add current to resolved list
```

Cuối cùng, áp dụng thay thế từ cuối về đầu (reverse order) để index không thay đổi.

**B. Thuật toán Risk Scoring (Deterministic):**

```
Base = 100
Dangerous = -40đ (Vi phạm luật, có thể vô hiệu)
High Risk = -20đ (Bất lợi lớn)
Advisory = -10đ (Thiếu rõ ràng)

Raw = max(0, 100 - Σ điểm trừ)

CAP = min(Raw, {
  ≥2 Dangerous → 20,
  1 Dangerous → 40,
  ≥1 High Risk → 60,
  else → 100
})

Final Score = min(Raw, CAP)
```

Ví dụ: Nếu hợp đồng có 2 điều khoản Dangerous (−40 −40 = −80) → Raw = 20, CAP = 20 → Final = 20.

**C. Luật ước lệ không trừ điểm (Context Sensitivity):**

Hệ thống không trừ điểm nặng nếu chỉ là THIẾU điều khoản mà không bắt buộc theo luật Việt Nam. Ví dụ, hợp đồng thuê nhà đơn giản không cần NDA hoặc Bất khả kháng → ghi "N/A", đánh "Safe". Ngược lại, hợp đồng thương mại lớn thiếu các trụ cột có thể là rủi ro.

### 2.4. Minh chứng Kỹ thuật (Code Snippet)

```javascript
// Dòng 60-95 trong aiController.js - lõi SpanManager
class SpanManager {
    constructor() { this.candidates = []; }
    add(start, end, replacement, priority) { 
        this.candidates.push({ start, end, replacement, priority }); 
    }
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
```

**Giải thích cơ chế:** 
- Sắp xếp `candidates` theo priority tăng dần (ưu tiên các pattern có priority thấp hơn trước), sau đó loại bỏ conflict bằng cách kiểm tra overlap khoảng [start, end).  
- Sau khi có danh sách `resolved` không xung đột, sắp xếp lại theo vị trí giảm dần (từ cuối về đầu), rồi áp dụng string slicing để thay thế từng span một. Phương pháp này bảo đảm mỗi thay thế không làm thay đổi index của các thay thế còn lại.

---

## 3. AI Planning Engine / Lập kế hoạch AI (Hệ thống Tạo Kế hoạch Hành động Pháp lý Tự động)

### 3.1. Đặt vấn đề (Problem Statement)

Một vụ việc pháp lý phức tạp (kiện tụng, xin cấp phép, giải quyết tranh chấp...) yêu cầu thực hiện hàng chục bước, mỗi bước có deadline, người phụ trách, và căn cứ pháp lý riêng. Phần lớn người dùng không tổ chức được lộ trình hợp lý, dẫn đến bỏ quên thủ tục, vượt quá thời hạn pháp luật.

Hệ thống **AI Planning Engine** giải quyết bằng cách:
1. Phân tích hồ sơ/yêu cầu của người dùng.
2. Tự động trích xuất các vai trò (Giám đốc, Luật sư, Kế toán...).
3. Khởi tạo timeline mốc thời gian, chia thành 3-5 giai đoạn (chuẩn bị, nộp hồ sơ, giải quyết, thi hành).
4. Sinh 12-18 task vi mô (micro-task) cho mỗi giai đoạn, mỗi task có deadline hợp lý, người phụ trách, và căn cứ pháp lý.
5. Tự kiểm tra toàn bộ (self-validation) để đảm bảo số lượng task hợp lệ, deadline không quay ngược, không có khoảng trắng.

### 3.2. Kiến trúc & Luồng hoạt động (Workflow)

**Bước 1 - Nhận input & Xử lý file đính kèm:**  
Endpoint `/api/ai/planning` nhận POST với `prompt` (mô tả yêu cầu text) và `files[]` (PDF, Word). Đọc nội dung file, ghép vào `combinedText`.

**Bước 2 - Lấy mốc thời gian hiện tại:**  
Code lấy ngày hôm nay dạng `DD/MM/YYYY` để AI suy luận timeline từ mốc xác định này. Nếu user nói "từ ngày mai", AI sẽ tính toán theo ngày thực tế, không tương đối.

**Bước 3 - Xây dựng Prompt với quy tắc ràng buộc:**  
Prompt chứa:
- Yêu cầu bắt buộc: 3-5 giai đoạn, 12-18 task.
- Cơ chế tự kiểm tra (self-validation): Đếm task, nếu < 12 → bổ sung, nếu > 18 → rút gọn.
- Luật thời gian (Temporal Engine): Task sau phải có deadline ≥ Task trước, cách nhau 1-5 ngày.
- Phân vai động (Dynamic Assignee): Trích xuất vai trò từ hồ sơ, gán đúng người cho mỗi task.

**Bước 4 - Gọi AI sinh kế hoạch:**  
`getActiveModel(prompt)` trả về text JSON chứa mảng kế hoạch.

**Bước 5 - Bóc tách JSON & xác thực:**  
`cleanAIJsonString()` loại bỏ markdown wrapper (```) và trích phần JSON hợp lệ. `JSON.parse()` chuyển thành object.

**Bước 6 - Lưu vào SQL Server (ContractHistory):**  
Bảng `ContractHistory` chứa các field: UserId, RecordType='PLANNING', Title, Folder='Kế hoạch AI', AnalysisJson (mảng task), AIModel='gemini-1.5-flash'.

**Bước 7 - Trả về và dọn dẹp:**  
Trả về HTTP 200 với mảng task, xóa file tạm.

### 3.3. Phân tích Thuật toán & Công nghệ lõi (Core Logic)

**A. Temporal Logic Engine:**

Hệ thống xây dựng timeline theo logic:
```
start_date = today (nếu user không cung cấp)
Với mỗi task i:
    task[i].deadline = start_date + (δ₁ + δ₂ + ... + δᵢ)
    δᵢ ∈ [1, 5] ngày, tùy độ phức tạp task
    Điều kiện: task[i].deadline ≥ task[i-1].deadline (không quay ngược thời gian)
```

So dengan các hệ thống planning truyền thống, kỹ thuật này từ khóa ở chỗ: **Tự động suy luận độ phức tạp của mỗi task** từ loại hợp đồng/vụ việc, và gán `δ` tương ứng.

**B. Task Micro-Segmentation:**

Thay vì sinh "Chuẩn bị hồ sơ" (1 task), hệ thống bắc buộc phải tách thành:
```
- Soạn thảo đơn khởi kiện theo Mẫu số 23-DS
- Sao chép giấy tờ tùy thân + Quyết định thành lập doanh nghiệp
- Dán tem nộp phí và đóng dấu công chứng
- Đóng tạm ứng án phí tại Chi cục Thi hành án
```

Cơ chế tự kiểm tra (self-validation) trong prompt bắc buộc AI đếm task, nếu < 12 → bổ sung thêm.

**C. Dynamic Role Extraction:**

Prompt lệnh AI phân tích hồ sơ để trích xuất các entity (vai trò): "Tôi là Giám đốc Công ty A, cần kiện Công ty B về...". Từ đó AI trích ra "Giám đốc", "Luật sư" (nếu có), gán vào field `assignee` của mỗi task.

### 3.4. Minh chứng Kỹ thuật (Code Snippet)

```javascript
// Dòng 550-610 trong geminiService.js - lõi temporal logic prompt
const currentDate = new Date();
const today = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/2026`;

const prompt = `
...
Deadline phải tuân theo: TASK sau KHÔNG ĐƯỢC có deadline trước TASK trước. 
Các TASK cách nhau hợp lý (1–5 ngày tùy độ phức tạp).
Định dạng ngày: DD/MM/YYYY
...
PHẢI phân tích hồ sơ để trích xuất các vai trò (Ví dụ: "Giám đốc", "Luật sư", "Kế toán"...)
Nếu xác định được: Gán đúng người phù hợp với nhiệm vụ.
...
`;
```

**Giải thích:** Prompt chứa mốc thời gian cụ thể (ngày hôm nay), quy tắc ràng buộc deadline, yêu cầu phân tích vai trò động. Kỹ thuật này đảm bảo AI không đoán mò thời gian hay gán bừa người phụ trách.

---

## 4. AI Contract Generation / Khởi tạo Hợp đồng AI (Hệ thống Tạo Soạn Hợp Đồng Pháp Lý Tự động)

### 4.1. Đặt vấn đề (Problem Statement)

Soạn thảo hợp đồng từ đầu là quá trình tốn nhiều thời gian, đòi hỏi chuyên môn cao, và dễ bỏ sót các điều khoản quan trọng. Bài toán đặt ra: xây dựng hệ thống tư vấn AI có khả năng:
1. **Phát hiện loại hợp đồng** từ mô tả nhu cầu của người dùng (Mua bán, Cung cấp dịch vụ, Thử việc, Thuê nhà...).
2. **Lựa chọn template** phù hợp từ bộ 4 khung (hoặc tự tạo template bổ sung).
3. **Trích xuất dữ liệu** từ văn bản hoặc đối thoại (tên, CCCD, địa chỉ, giá cả...).
4. **Soạn thảo** các điều khoản chi tiết, pháp lý, với từngng tiểu mục (1.1, 1.2...) là 2-3 câu văn pháp lý.
5. **Nhắc nhở** người dùng để bổ sung thông tin bị thiếu.

### 4.2. Kiến trúc & Luồng hoạt động (Workflow)

**Bước 1 - Nhận yêu cầu từ Frontend:**  
Endpoint `/api/ai/generate-form` nhận POST với `text` (mô tả nhu cầu), `history[]` (lịch sử chat), `documents[]` (tài liệu luật từ RAG).

**Bước 2 - Chuyển hóa dữ liệu ngữ cảnh:**  
- Lịch sử chat: `[{role: "user", content: "..."}, ...]` → văn bản: `NGƯỜI DÙNG: ...\nLEGAI: ...`.
- Tài liệu luật: `[{title, content, noi_dung_tom_tat}, ...]` → văn bản: `[TÀI LIỆU 1]: Title\nNội dung: Content`.

**Bước 3 - Xây dựng Prompt với 4 Khung Template:**  
Prompt chứa:
- **Khung 1: Hợp đồng Mua bán** — Điều 1 (Hàng hóa), Điều 2 (Thanh toán)... Điều 8 (Bất khả kháng).
- **Khung 2: Hợp đồng Cung cấp Dịch vụ** — Điều 1 (Đối tượng), Điều 2 (Thời hạn)... Điều 7 (Giải quyết tranh chấp).
- **Khung 3: Hợp đồng Thử việc/Lao động** — Điều 1-6, tập trung vào chế độ làm việc, lương, quyền lợi.
- **Khung 4: Hợp đồng Thuê nhà ở** — Điều 1-10, từ thông tin nhà ở đến hoàn trả cọc.

Mỗi khung chứa chi tiết các tiểu mục (1.1, 1.2...), yêu cầu AI soạn thảo từng tiểu mục thành 2-3 câu văn pháp lý.

**Bước 4 - Phát hiện loại hợp đồng:**  
AI tự động đọc `text` yêu cầu, trích xuất keyword (mua bán, dịch vụ, thử việc, thuê...), chọn 1 trong 4 khung. Nếu không khớp, AI tự sáng tác khung tương tự.

**Bước 5 - Trích xuất dữ liệu (Data Extraction):**  
AI phân tích text yêu cầu để tìm kiếm các trường: `benA_name`, `benA_id`, `benA_address`, `benA_phone`, `benA_rep` (Bên A), và tương tự cho Bên B. Nếu trường nào BỊ TRỐNG, AI BẮT BUỘC liệt kê vào field `chat_reply` để nhắc nhở người dùng.

**Bước 6 - Soạn thảo nội dung:**  
AI cần tuân thủ quy tắc "Anti-Laziness" — với **mỗi Điều khoản, phải soạn thảo tối thiểu 3-5 tiểu mục con**, mỗi tiểu mục ≥ 3 câu văn pháp lý. Ví dụ, Điều 1 của hợp đồng mua bán gồm:
```
1.1. Tên hàng hóa, đơn vị, số lượng, đơn giá, thành tiền
1.2. Tổng giá trị bằng số và chữ
1.3. Mô tả chi tiết chất lượng, xuất xứ
1.4. Bảo hành, hạn sử dụng (nếu có)
```

**Bước 7 - Trả về JSON:**  
```json
{
  "chat_reply": "Đã tạo xong khung hợp đồng. Vui lòng cung cấp: Địa chỉ công ty A, Số điện thoại...",
  "template_type": "hop_dong_mua_ban",
  "extracted_data": {
    "ten_hop_dong": "HỢP ĐỒNG MUA BÁN",
    "benA_name": "...",
    "sections": [
      {"title": "Điều 1: ...", "content": "1.1. ... \n1.2. ..."}
    ]
  }
}
```

### 4.3. Phân tích Thuật toán & Công nghệ lõi (Core Logic)

**A. Dynamic Template Selection:**

Prompt chứa logic phân loại:
```
Đọc userInput
keyword_analysis = extract_keywords(userInput)
if keyword_analysis matches ("mua", "bán", "hàng", "hóa"):
    template = KHUNG_1_MUA_BAN
else if matches ("dịch vụ", "cung cấp", "công việc"):
    template = KHUNG_2_DICH_VU
...
else:
    template = KHUNG_TỰ_SÁNG_TẠO
```

**B. Field Extraction & Validation:**

Sử dụng regex và pattern matching để trích xuất entity từ text:
```
Pattern CCCD/CMND: \d{9,12}
Pattern Phone: (\+?84|0)\d{9,10}
Pattern Name: [A-ZÀ-ỿ][a-zà-ỿ]+(\s[A-ZÀ-ỿ][a-zà-ỿ]+)*
```

Nếu một trường thiếu, AI phải ghi danh sách rõ ràng: "Thiếu: Địa chỉ Bên A, Số điện thoại Bên B", chứ không được nói chung chung "Vui lòng kiểm tra lại".

**C. Content Generation with Structure Lock:**

Prompt yêu cầu AI "giữ nguyên cấu trúc tiểu mục (1.1, 1.2...)", tức là **KHÔNG ĐƯỢC** cosplay tóm tắt, chỉ được viết chi tiết. Kỹ thuật này chặn AI "lười", buộc sinh văn bản pháp lý thực sự.

### 4.4. Minh chứng Kỹ thuật (Code Snippet)

```javascript
// Dòng 520-530 trong geminiService.js - lõi field extraction
"extracted_data": {
    "ten_hop_dong": "TÊN HỢP ĐỒNG IN HOA",
    "benA_role": "VAI TRÒ BÊN A IN HOA",
    "benB_role": "VAI TRÒ BÊN B IN HOA",
    "can_cu_luat": ["Danh sách các luật liên quan"],
    "benA_name": "", 
    "benA_id": "", 
    "benA_address": "", 
    "sections": [...]
}
```

**Giải thích:** Cấu trúc JSON bắc buộc AI phải điền từng trường. Nếu trường rỗng (`""`), Frontend có thể hiện thị dưới dạng `<input>` để người dùng nhập. Nếu AI không thể trích xuất trường nào, **AI BẮT BUỘC** ghi vào `chat_reply` field để nhắc nhở.

---

## 5. AI Video Analysis / Phân tích Video AI (Hệ thống Kiểm toán Phụ đề Video Pháp lý)

### 5.1. Đặt vấn đề (Problem Statement)

Video YouTube, TikTok, Instagram Reels chứa hàng tỉ lượt xem, trong đó có nhiều nội dung "tư vấn pháp lý". Tuy nhiên, phần lớn các video này hoặc sai luật, hoặc lỏng lẻo, hoặc dùng kiến thức lỗi thời, dẫn đến hướng dẫn sai lệch người xem.

Bài toán: Xây dựng hệ thống tự động:
1. **Trích xuất phụ đề video** từ URL YouTube (hỗ trợ shorts, youtu.be, watch?v=).
2. **Phân tích nội dung pháp lý** trong phụ đề — nhận diện vấn đề luật được đề cập.
3. **Kiểm toán tính đúng sai** — so sánh với luật hiện hành Việt Nam (năm 2026).
4. **Xác định Red Flags** — phát hiện hướng dẫn lách luật, lừa đảo, luật cũ.
5. **Gán Trust Score (0-100)** — mức độ tin cậy của video.
6. **Cache thông minh** — lưu kết quả để tránh phân tích lại video cùng URL.

### 5.2. Kiến trúc & Luồng hoạt động (Workflow)

**Bước 1 - Nhận URL video:**  
Endpoint `/api/ai/analyze-video` nhận POST với `videoUrl`. Kiểm tra URL không rỗng.

**Bước 2 - Chuẩn hóa URL (URL Normalization):**  
Gọi `normalizeYouTubeUrl(videoUrl)` — Logic:
```javascript
if URL contains 'shorts/':
    videoId = extract_from_shorts(URL)
else if contains 'youtu.be/':
    videoId = extract_from_short_url(URL)
else if contains 'watch?v=':
    videoId = extract_from_watch_url(URL)

// Chuẩn hóa thành dạng chính tắc
normalized_url = `https://www.youtube.com/watch?v=${videoId}`
```

Ủy lý này giúp hệ thống nhận diện YouTube Shorts/youtu.be/full URL là cùng 1 video, từ đó tận dụng cache.

**Bước 3 - Kiểm tra Cache (VideoHistory table):**  
Truy vấn SQL: `SELECT * FROM VideoHistory WHERE VideoUrl = @normalized_url LIMIT 1`.  
Nếu có cache cũ, UPDATE trường `LastAccessedAt` (để smart cache tracking), tăng `AccessCount`, rồi trả về ngay kết quả lưu trữ — **không cần gọi AI lại**.

**Bước 4 - Trích xuất phụ đề (Transcript):**  
Gọi `YoutubeTranscript.fetchTranscript(normalized_url)` — thư viện này gọi API YouTube để lấy phụ đề có sẵn. Nếu video không có phụ đề → lỗi HTTP 400.

**Bước 5 - Gọi AI phân tích:**  
Hàm `analyzeVideo(videoUrl)` trong `geminiService.js` xây dựng prompt chứa:
- Transcript video.
- Năm hiện tại (để AI suy luận luật hiện hành).
- Quy trình chain-of-thought (COT): Trích nội dung → Kiểm tra tính hợp lệ → Phát hiện Red Flags → Chấm Trust Score.
- Mục đích: Đảm bảo AI không bê nguyên văn phụ đề, mà phải phân tích sâu.

**Bước 6 - AI sinh JSON phân tích:**  
```json
{
  "summary": "Tổng quan video",
  "trustScore": 85,
  "legal_map": [
    {"law_name": "Luật...", "article": "Điều...", "status": "Đúng/Sai/Lỗi thời"}
  ],
  "action_plan": [
    {"step": 1, "action": "Khuyến nghị cụ thể"}
  ]
}
```

**Bước 7 - Lưu vào Cache (VideoHistory):**  
Lưu trữ: `UserId, VideoUrl, Title (từ aiData.title), Transcript, Summary, LegalBases (mảng legal_map), TrustScore, AnalysisJson` vào bảng.

**Bước 8 - Smart Cache Cleanup:**  
Xóa các cache cũ nhất ngoài Top 500 video (ORDER BY LastAccessedAt DESC).

**Bước 9 - Emit Real-time Socket:**  
Nếu hệ thống có Global IO (Socket.io), emit sự kiện `new_activity` với tên tính năng `VIDEO_ANALYSIS` để giao diện real-time cập nhật.

**Bước 10 - Trả về kết quả:**  
```json
{
  "success": true,
  "fromCache": false,
  "data": { ...aiData, Title: videoTitle }
}
```

### 5.3. Phân tích Thuật toán & Công nghệ lõi (Core Logic)

**A. URL Normalization Engine:**

Ba dạng URL YouTube phổ biến:
1. **Shorts**: `https://www.youtube.com/shorts/VIDEOID`
2. **Short URL**: `https://youtu.be/VIDEOID?t=10s`
3. **Watch URL**: `https://www.youtube.com/watch?v=VIDEOID&list=...`

Thuật toán:
```javascript
videoId = null;
if (rawUrl.includes('shorts/')) {
    videoId = rawUrl.split('shorts/')[1].split('?')[0];
} else if (rawUrl.includes('youtu.be/')) {
    videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
} else if (rawUrl.includes('watch?v=')) {
    videoId = rawUrl.split('watch?v=')[1].split('&')[0];
}
if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}
```

Kỹ thuật này đảm bảo cùng video được cache chỉ một lần, dù người dùng paste bất kỳ dạng URL nào.

**B. Legal Audit Chain-of-Thought (COT):**

Prompt yêu cầu AI tuân thủ thứ tự suy luận:
```
1. Trích xuất nội dung: Video đang truyền tải vấn đề gì?
2. Kiểm tra tính hợp lệ: Đúng luật năm 2026 không?
3. Phát hiện Red Flags: Có hướng dẫn lách luật / xúi giục / lừa đảo?
4. Đánh giá Trust Score:
   - Đúng bản chất pháp luật: 75-100
   - Có thiếu sót: 50-70
   - Sai luật nghiêm trọng: ≤40
```

Cơ chế này buộc AI phải lập luận bước từng bước, tránh đoán mò hoặc trả lời vội vàng.

**C. Smart Cache Mechanism:**

Bảng `VideoHistory` chứa:
- `VideoUrl`, `AnalysisJson` (kết quả phân tích).
- `LastAccessedAt` (lần truy cập cuối).
- `AccessCount` (số lần xem).

Logic cleanup:
```sql
DELETE FROM VideoHistory
WHERE Id NOT IN (
    SELECT TOP 500 Id FROM VideoHistory ORDER BY LastAccessedAt DESC
)
```

Cách này giữ 500 video được truy cập gần đây nhất, tối ưu bộ nhớ SQL Server.

### 5.4. Minh chứng Kỹ thuật (Code Snippet)

```javascript
// Dòng 300-315 trong geminiService.js - lõi URL normalization
function normalizeYouTubeUrl(rawUrl) {
    if (!rawUrl) return "";
    let videoId = "";
    try {
        if (rawUrl.includes('shorts/')) {
            videoId = rawUrl.split('shorts/')[1].split('?')[0];
        } else if (rawUrl.includes('youtu.be/')) {
            videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
        } else if (rawUrl.includes('watch?v=')) {
            videoId = rawUrl.split('watch?v=')[1].split('&')[0];
        }
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (e) {
        console.warn("Lỗi khi chuẩn hóa URL:", e);
    }
    return rawUrl;
}
```

**Giải thích cơ chế:**
- Hàm kiểm tra ba dạng URL phổ biến (shorts, youtu.be, watch?v=).
- Dùng `split()` để tách videoId từ các parameter không cần thiết (query string, list ID...).
- Chuẩn hóa thành dạng chính tắc `watch?v=VIDEOID` để cache nhận diện chính xác.
- Try-catch bảo vệ, nếu lỗi → trả về URL nguyên gốc (fail-safe).

---

## KẾT LUẬN CHUNG

Hệ thống LegalBot tích hợp 5 tính năng AI tiên tiến, mỗi tính năng giải quyết một vấn đề pháp lý cụ thể:

| Tính năng | Công nghệ lõi | Đầu ra | Ứng dụng |
|-----------|--------------|--------|---------|
| **ChatBot AI** | RAG + Gemini | Text tư vấn + Nguồn tài liệu | Tra cứu pháp luật real-time |
| **Contract Review** | Masking + Risk Scoring | JSON scores + Phát hiện rủi ro | Kiểm duyệt hợp đồng tự động |
| **Planning Engine** | Temporal Logic + Dynamic Role | JSON lộ trình + Task + Deadline | Lập kế hoạch vụ việc chi tiết |
| **Form Generator** | Template Selection + Data Extraction | JSON hợp đồng + Nhắc nhở trường thiếu | Soạn thảo hợp đồng tuỳ chỉnh |
| **Video Analysis** | URL Normalization + Legal Audit + Cache | JSON audit + Trust Score | Kiểm toán video pháp lý |

Kiến trúc toàn bộ hệ thống tuân thủ nguyên tắc **Fail-Safe** (khi service A lỗi, hệ thống vẫn hoạt động), **Anti-Laziness** (AI phải soạn chi tiết, không tóm tắt), và **Deterministic** (sử dụng công thức toán học rõ ràng, tránh đoán mò).

---

**Tham khảo tài liệu:** 
- File: `aiController.js` (dòng 1-800)
- File: `geminiService.js` (dòng 1-1000)
- Luật pháp: Pháp luật Việt Nam cập nhật đến 2026
