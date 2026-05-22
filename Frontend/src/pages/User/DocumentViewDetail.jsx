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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-center font-bold text-[18px] uppercase mt-10 mb-4" {...props} />,
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
                // Cập nhật trong ReactMarkdown components
                td: ({ node, ...props }) => {
                  const contentStr = JSON.stringify(node);
                  const isNoiNhanCell = contentStr.includes("Nơi nhận") || contentStr.includes("NL");

                  // Logic: Nếu là ô bên phải (không chứa chữ "Nơi nhận") trong bảng cấu trúc cuối trang, thì canh giữa/phải cho Chữ ký
                  const isSignatureCell = isNoiNhanCell && !contentStr.includes("Nơi nhận");

                  return (
                    <td
                      className={`p-2 ${isNoiNhanCell ? 'border-none' : 'border border-gray-400'}`}
                      style={{
                        verticalAlign: 'top',
                        border: isNoiNhanCell ? 'none' : '1px solid #9ca3af',
                        textAlign: isSignatureCell ? 'center' : 'left', // Chữ ký căn giữa trong cột phải
                        paddingLeft: isSignatureCell ? '50px' : '8px',  // Đẩy khối chữ ký sang phải trang giấy

                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {React.Children.map(props.children, child => renderTdChild(child))}
                    </td>
                  );
                },
                th: ({ node, ...props }) => <th className="border border-gray-400 p-2 bg-gray-50 font-bold" {...props} />,
              }}
            >
              {getCleanContent(doc.Content || "")}
            </ReactMarkdown>
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