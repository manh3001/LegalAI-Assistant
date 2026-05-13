import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function DocumentViewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

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
  // DocumentViewDetail.jsx

  // Thêm useEffect này để tự động ghi nhận lịch sử xem
  useEffect(() => {
    // Chỉ ghi nhận khi đã load xong dữ liệu văn bản (doc) và người dùng đã đăng nhập
    const userStr = localStorage.getItem("user");
    if (id && doc && userStr) {
      const recordView = async () => {
        try {
          const token = localStorage.getItem("accessToken");
          // Gọi API sếp đã sửa ở Bước A trong adminController
          await axios.post("http://localhost:8000/api/user/record-view", {
            documentId: doc.Id,      // NVARCHAR(500) khớp SQL sếp vừa chạy
            documentTitle: doc.Title,
            documentNumber: doc.DocumentNumber,
            issueYear: doc.IssueYear
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(" Đã ghi nhận lịch sử xem vào Database.");
        } catch (err) {
          console.error(" Lỗi ghi nhận lịch sử xem:", err);
        }
      };
      recordView();
    }
  }, [id, doc]); // Chạy lại mỗi khi ID hoặc dữ liệu văn bản thay đổi
  const handleBack = () => navigate(-1);

  const formatDate = (dateStr) => {
    if (!dateStr) return "..........";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? ".........." : `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  };

  const getCleanContent = (content) => {
    if (!content) return "";

    const linesRaw = content.split('\n');
    const processedLines = linesRaw.map(line => {
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
    const firstChapterIndex = lines.findIndex(l => {
      const line = l.trim().toUpperCase().replace(/[#*]/g, "").replace(/<BR\s*\/?>/gi, " ");
      return line.startsWith("CHƯƠNG") || line.startsWith("PHẦN") || line.startsWith("ĐIỀU 1.");
    });

    return firstChapterIndex > -1 ? lines.slice(firstChapterIndex).join('\n') : cleaned;
  };

  const renderTextWithBr = (text) => {
    if (typeof text !== 'string') return text;
    return text.split('[NL]').reduce((prev, curr, i) => [prev, <br key={i} />, curr]);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!doc) return <div className="min-h-screen bg-black" />;

  return (
    // Đổi nền tổng thể thành Xám nhạt (#f8f9fa) để tờ giấy A4 màu Trắng nổi bật lên
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-[#1A2530] font-sans selection:bg-[#B8985D]/30 selection:text-[#1A2530]">

      {/* HEADER: Kính mờ trắng, viền kẽm */}
      <header className="bg-white/90 border-b border-zinc-200 sticky top-0 z-20 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Nút Back: Chuyển sang Xám/Đen Than */}
            <button onClick={handleBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-[#1A2530]">
              <ArrowLeftIcon className="w-5 h-5 stroke-2" />
            </button>

            <div className="flex flex-col border-l border-zinc-200 pl-4">
              {/* Chữ danh mục: Vàng Đồng */}
              <h1 className="text-[10px] font-black text-[#B8985D] uppercase tracking-[0.2em]">{doc.Category || "VĂN BẢN PHÁP LUẬT"}</h1>
              <p className="text-[12px] text-[#1A2530] font-bold truncate max-w-[400px]">{doc.Title}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Vùng Main chứa tờ giấy A4 */}
      <main className="flex-grow p-4 md:p-10 overflow-y-auto flex justify-center bg-[#f8f9fa] scroll-smooth">
        <div
          // Nâng cấp Shadow cho tờ giấy để tạo độ nổi khối 3D trên nền xám
          className="w-full max-w-[900px] bg-white text-black shadow-[0_15px_50px_rgba(0,0,0,0.08)] flex flex-col p-[2cm_1.5cm]"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          {/* HEADER CHUẨN CỦA VĂN BẢN NHÀ NƯỚC */}
          <div className="flex justify-between items-start mb-8">
            <div className="text-center min-w-[200px]">
              <p className="font-bold text-[13px] uppercase">{doc.Agency || "CƠ QUAN BAN HÀNH"}</p>
              <p className="text-[13px] font-bold">-------</p>
              <p className="text-[12px] mt-1">Số: {doc.DocumentNumber}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-[14px] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold text-[14px]">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-32 h-[1.5px] bg-black mx-auto mt-1 mb-2"></div>
              <p className="text-[12px] italic mt-4 text-right">Hà Nội, {formatDate(doc.IssueDate)}</p>
            </div>
          </div>

          {/* TIÊU ĐỀ */}
          <div className="text-center mt-6 mb-12">
            <h2 className="text-[20px] font-bold leading-tight uppercase px-12">{doc.Title}</h2>
          </div>

          {/* NỘI DUNG SẠCH (Dùng ReactMarkdown của members) */}
          <div className="law-content-display">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-center font-bold text-[18px] uppercase mt-10 mb-4" {...props} />,
                // Đã xóa class text-cyan-800 của members ở đây, trả về màu đen chuẩn pháp lý
                h2: ({ node, ...props }) => <h2 className="text-center font-bold text-[17.5px] mt-8 mb-4 uppercase" {...props} />,
                p: ({ node, ...props }) => <p className="indent-8 text-justify leading-[1.85] mb-4 text-[#222] text-[16px]" {...props} />,

                table: ({ node, ...props }) => {
                  const isNoiNhan = JSON.stringify(node).includes("Nơi nhận");
                  return (
                    <div className="overflow-x-auto my-8">
                      <table
                        className={`w-full border-collapse ${isNoiNhan ? 'border-none' : 'border border-gray-400'}`}
                        style={{ border: isNoiNhan ? 'none' : '1px solid #9ca3af' }}
                        {...props}
                      />
                    </div>
                  );
                },
                td: ({ node, ...props }) => {
                  const contentStr = JSON.stringify(node);
                  const isNoiNhanCell = contentStr.includes("Nơi nhận") || contentStr.includes("NL");
                  return (
                    <td
                      className={`p-2 ${isNoiNhanCell ? 'border-none' : 'border border-gray-400'}`}
                      style={{ verticalAlign: 'top', border: isNoiNhanCell ? 'none' : '1px solid #9ca3af' }}
                    >
                      {React.Children.map(props.children, child =>
                        typeof child === 'string' ? renderTextWithBr(child) : child
                      )}
                    </td>
                  );
                },
                th: ({ node, ...props }) => <th className="border border-gray-400 p-2 bg-gray-50 font-bold" {...props} />,
              }}
            >
              {getCleanContent(doc.Content)}
            </ReactMarkdown>
          </div>

          {/* Footer nhỏ dưới cùng tờ giấy */}
          <footer className="mt-20 pt-8 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500 font-mono mt-auto italic">
            <span>Hệ thống LegAI - Dữ liệu đã mã hóa xác thực</span>
            <span>Mã bản ghi: {id}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}