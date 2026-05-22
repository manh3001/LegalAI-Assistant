import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


// =============================================================================
// BỘ PARSER VĂN BẢN PHÁP LUẬT V5: PHÂN CẤP THỤT LỀ + KHỬ TIÊU ĐỀ ĐỘNG THEO AGENCY
// =============================================================================
const parseLegalContentToHTML = (content, agency = "") => {
  if (!content) return null;

  const lines = content.split('\n');

  // Cờ trạng thái kiểm soát nội dung cốt lõi
  let isMainContentStarted = false;

  // Chuẩn hóa chuỗi Agency viết hoa để phục vụ việc lọc động trùng tên tỉnh/cơ quan
  const cleanAgencyUpper = agency ? String(agency).trim().toUpperCase() : "";

  return lines.map((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return <div key={index} className="h-3" />;

    const upperLine = trimmedLine.toUpperCase();

    // 🎯 CHỐT CHẶN PHÁT HIỆN BẮT ĐẦU NỘI DUNG CHÍNH
    if (
      /^CĂN CỨ/i.test(upperLine) ||
      /^QUYẾT ĐỊNH:/i.test(upperLine) ||
      /^LUẬT NÀY BAN HÀNH/i.test(upperLine) ||
      trimmedLine.startsWith("Căn cứ") ||
      trimmedLine.startsWith("Quyết định") ||
      trimmedLine.startsWith("Điều 1")
    ) {
      isMainContentStarted = true;
    }

    // 🔥 VAN LỌC V5: ĐỘNG HÓA HOÀN TOÀN DỌN RÁC ĐẦU TỆP THEO AGENCY
    if (!isMainContentStarted) {
      // A. KIỂM TRA ĐIỀU KIỆN LỌC ĐỘNG THEO TÊN TỈNH/CƠ QUAN (AGENCY) TỪ SQL SERVER ĐẨY LÊN
      let isAgencyNoise = false;
      if (cleanAgencyUpper) {
        // Nếu dòng hiện tại chứa cụm từ cơ quan ban hành (Ví dụ: "ỦY BAN NHÂN DÂN TỈNH THANH HÓA")
        if (upperLine.includes(cleanAgencyUpper)) {
          isAgencyNoise = true;
        }

        // Băm nhỏ chữ trong agency ra (Ví dụ: "UBND Tỉnh Thanh Hóa" -> "THANH HÓA") để quét mảnh thừa dính dấu gạch
        const agencyWords = cleanAgencyUpper.split(/\s+/);
        const geoName = agencyWords.filter(word => !["UBND", "ỦY", "BAN", "NHÂN", "DÂN", "TỈNH", "THÀNH", "PHỐ", "BỘ", "SỞ"].includes(word)).join(" ");
        if (geoName && geoName.length > 2 && upperLine.includes(geoName)) {
          isAgencyNoise = true;
        }
      }

      // B. KÍCH HOẠT QUY TRÌNH TIÊU DIỆT DÒNG NHIỄU TIÊU ĐỀ
      if (
        isAgencyNoise ||
        // Khử trùng Quốc hiệu, Tiêu ngữ mẫu và các mảnh rách dòng bừa bãi
        upperLine.includes("CỘNG HÒA XÃ HỘI") ||
        upperLine.includes("CHỦ NGHĨA VIỆT NAM") ||
        upperLine.includes("ĐỘC LẬP - TỰ DO") ||
        upperLine.includes("ĐỘC LẬP – TỰ DO") ||
        upperLine.includes("HẠNH PHÚC") ||
        upperLine.includes("QUỐC HỘI") ||
        upperLine.includes("ỦY BAN NHÂN DÂN") ||
        upperLine.includes("UBND") ||
        upperLine.includes("CHỦ TỊCH") ||

        // Khử trùng số hiệu hành chính và chuỗi ngày tháng rách lọt
        /^SỐ:\s+/i.test(trimmedLine) ||
        /ngày\s+\d+\s+tháng\s+\d+\s+năm/i.test(trimmedLine) ||
        /tháng\s+\d+\s+năm\s+\d+/i.test(trimmedLine) ||

        // Quét sạch tất cả các kiểu phân tách rác vớ vẩn dưới dạng đường kẻ
        /^-+$/i.test(trimmedLine) ||
        /^_+$/i.test(trimmedLine) ||
        /^\.+$/i.test(trimmedLine) ||
        /^[-\s_]{3,}$/i.test(trimmedLine)
      ) {
        return null; // Dọn sạch khỏi cấu trúc hiển thị
      }
    }

    // =========================================================================
    // HỆ THỐNG PHÂN CẤP THỤT LỀ CHUẨN QUỐC GIA VBPL
    // =========================================================================
    // 1. Định dạng cấu trúc CHƯƠNG / MỤC -> Căn giữa, in đậm
    if (/^(Chương|Mục)\s+[IVXLCDM\d]+/i.test(trimmedLine) || /^[A-ZỨỜỞÁÀẠẢÃÝỲỴỶỸÉÈẸẺẼÓÒỌỎÕÚÙỤỦŨÍÌỊỈĨĐ\s./\\-]{12,}$/.test(trimmedLine)) {
      return (
        <div key={index} className="text-center font-bold text-gray-900 text-[15.5px] my-5 uppercase tracking-wide leading-snug">
          {trimmedLine}
        </div>
      );
    }

    // 2. Định dạng cấu trúc ĐIỀU -> In đậm tiêu đề điều khoản, sát lề trái
    if (/^Điều\s+\d+/i.test(trimmedLine)) {
      return (
        <div key={index} className="font-bold text-zinc-950 text-[15px] mt-5 mb-2 text-left tracking-tight">
          {trimmedLine}
        </div>
      );
    }

    // 3. Định dạng cấu trúc KHOẢN -> Thụt lề cấp 1
    if (/^\d+\.\s+/.test(trimmedLine)) {
      return (
        <div key={index} className="pl-6 text-[14.5px] text-gray-800 leading-relaxed text-justify mb-2 font-medium">
          {trimmedLine}
        </div>
      );
    }

    // 4. Định dạng cấu trúc ĐIỂM -> Thụt lề cấp 2
    if (/^[a-z]\)\s+/.test(trimmedLine)) {
      return (
        <div key={index} className="pl-12 text-[14.5px] text-gray-700 leading-relaxed text-justify mb-1.5 font-normal italic">
          {trimmedLine}
        </div>
      );
    }

    // 5. Các dòng văn xuôi diễn giải thông thường
    return (
      <div key={index} className="text-[14.5px] text-gray-800 leading-relaxed text-justify mb-2 pl-2">
        {trimmedLine}
      </div>
    );
  });
};
export default function DocumentViewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch dữ liệu văn bản
  const fetchDetail = async (docId) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/documents/${docId}`);
      if (res.data && res.data.success) {
        setDoc(res.data.data);
      }
    } catch (err) {
      console.error("Get document detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  // 2. Tự động ghi nhận lịch sử xem (Giữ nguyên logic của sếp)
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (id && doc && userStr) {
      const recordView = async () => {
        try {
          const token = localStorage.getItem("accessToken");
          await axios.post("http://localhost:8000/api/user/record-view", {
            documentId: doc.Id,
            documentTitle: doc.Title,
            documentNumber: doc.DocumentNumber,
            issueYear: doc.IssueYear
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(" Đã ghi nhận lịch sử xem.");
        } catch (err) {
          console.error(" Lỗi ghi nhận lịch sử xem:", err);
        }
      };
      recordView();
    }
  }, [id, doc]);

  const handleBack = () => navigate(-1);

  const formatDate = (dateStr) => {
    if (!dateStr) return "..........";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? ".........." : `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  };

  // 3. Logic làm sạch nội dung (Đã tích hợp xử lý Bảng của sếp + Cắt lặp Header)
  const getCleanContent = (content) => {
    if (!content) return "";

    const linesRaw = content.split('\n');
    const processedLines = linesRaw.map(line => {
      // Giữ nguyên logic xử lý Bảng "Nơi nhận" của sếp
      if (line.includes('|') && line.includes('Nơi nhận:')) {
        let cells = line.split('|');
        if (cells.length >= 3) {
          cells[1] = cells[1].replace(/<br\s*\/?>/gi, "[NL]").trim();
          let rightCell = cells[2].replace(/<br\s*\/?>/gi, " ").trim();
          const upperVn = "A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÍÌỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐ";
          const re = new RegExp(`^([${upperVn}\\s]+)\\s+([A-Z][a-z].*)`);
          cells[2] = rightCell.replace(re, "$1[NL][NL][NL][NL][NL]**$2**");
        }
        return cells.join('|');
      }

      return line
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\*{4,}/g, " ")
        .replace(/\/\*\*+/g, " ")
        .replace(/\*\*+\//g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\\n/g, "\n");
    });

    const cleaned = processedLines.join('\n');
    const lines = cleaned.split('\n');

    // Mở rộng bộ lọc để cắt bỏ phần lặp Header (Chính phủ/Cộng hòa...)
    const startIndex = lines.findIndex(l => {
      const line = l.trim().toUpperCase().replace(/[#*]/g, "").replace(/<BR\s*\/?>/gi, " ");
      return line.startsWith("CHƯƠNG") ||
        line.startsWith("PHẦN") ||
        line.startsWith("ĐIỀU 1.") ||
        line.includes("QUYẾT ĐỊNH:") ||
        line.includes("NGHỊ ĐỊNH:") ||
        line.includes("LỆNH:");
    });

    return startIndex > -1 ? lines.slice(startIndex).join('\n') : cleaned;
  };

  const renderTextWithBr = (text) => {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\[NL\]/g, '\n')
      .split('\n')
      .flatMap((segment, i) => (i === 0 ? [segment] : [<br key={i} />, segment]));
  };

  const renderTdChild = (child) => {
    if (typeof child !== 'string') return child;

    const normalized = child.replace(/\[NL\]/g, '\n');
    if (normalized.includes('CHỦ TỊCH')) {
      return normalized.split(/(CHỦ TỊCH)/g).map((part, index) =>
        part === 'CHỦ TỊCH' ? (
          <span key={index} style={{ display: 'block', marginTop: '0.25rem' }}>
            {part}
          </span>
        ) : (
          renderTextWithBr(part)
        )
      );
    }

    return renderTextWithBr(normalized);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-t-[#B8985D] rounded-full animate-spin"></div>
    </div>
  );

  if (!doc) return <div className="min-h-screen bg-[#f8f9fa]" />;

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-[#1A2530] font-sans selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
      {/* Header điều hướng */}
      <header className="bg-white/90 border-b border-zinc-200 sticky top-0 z-20 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-[#1A2530]">
              <ArrowLeftIcon className="w-5 h-5 stroke-2" />
            </button>
            <div className="flex flex-col border-l border-zinc-200 pl-4">
              <h1 className="text-[10px] font-black text-[#B8985D] uppercase tracking-[0.2em]">{doc.Category || "VĂN BẢN PHÁP LUẬT"}</h1>
              <p className="text-[12px] text-[#1A2530] font-bold truncate max-w-[400px]">{doc.Title}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tờ giấy A4 */}
      <main className="flex-grow p-4 md:p-10 overflow-y-auto flex justify-center bg-[#f8f9fa]">
        <div
          className="w-full max-w-[900px] bg-white text-black shadow-[0_15px_50px_rgba(0,0,0,0.08)] flex flex-col p-[2cm_1.5cm]"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >

          {/* HEADER */}


          <div className="grid grid-cols-2 mb-10 text-[13px] border-b border-gray-100 pb-8">

            {/* Cột trái: Canh giữa trong 50% bên trái */}
            <div className="flex flex-col items-center text-center">
              <p className="font-bold uppercase leading-tight min-h-[40px] flex items-center justify-center">
                {doc.Agency?.replace(/TTg|Hà Nội/gi, '').trim() || "CƠ QUAN BAN HÀNH"}
              </p>
              <p className="font-bold text-[10px] my-1">-------</p>
              <p className="font-medium">Số: {doc.DocumentNumber}</p>
            </div>

            {/* Cột phải (Quốc hiệu): Canh giữa trong 50% bên phải */}
            <div className="flex flex-col items-center text-center">
              <div className="w-full">
                <p className="font-bold uppercase tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                <div className="w-24 h-[1px] bg-black mx-auto mt-1 mb-3"></div>

                {/* Địa danh: Nằm ngay dưới trục giữa của cột phải */}
                <p className="italic text-[12px]">
                  {doc.IssueDateString?.replace(/^TTg/i, '').trim() || `Hà Nội, ${formatDate(doc.IssueDate)}`}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 mb-12">
            <h2 className="text-[20px] font-bold leading-tight uppercase px-12">{doc.Title}</h2>
          </div>

          {/*  hiển thị nội dung văn bản */}
          <div className="law-content-display">
            {/* BỘ PARSER PHÂN CẤP CHUẨN VBPL */}
            <div className="mt-6 flex-1 font-sans antialiased space-y-2.5 text-left w-full">
              {parseLegalContentToHTML(doc?.Content, doc?.Agency)}
            </div>
          </div>

          <footer className="mt-20 pt-8 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500 font-mono mt-auto italic">
            <span>Hệ thống LegAI - Xác thực điện tử</span>
            <span>Mã bản ghi: {id}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}