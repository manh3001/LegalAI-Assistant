import {
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  ShieldExclamationIcon,
  PrinterIcon,
  DocumentTextIcon,
  DocumentMagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export default function AnalysisDetailView({ record, riskScore }) {

  // 1. (Deep Parse)
  let result = {};
  try {
    // lấy từ AnalysisJson 
    let rawData = record?.fullData?.AnalysisJson || record?.AnalysisJson || record?.Content || '{}';

    // Nếu nó là chuỗi, parse nó
    if (typeof rawData === 'string') {
      result = JSON.parse(rawData);
    } else {
      result = rawData;
    }

    // Đề phòng trường hợp chuỗi bị lồng 2 lần (Stringified String)
    if (typeof result === 'string') {
      result = JSON.parse(result);
    }
  } catch (error) {
    console.error("Lỗi parse JSON trong AnalysisDetailView:", error);
    result = {};
  }

  // 2. BÓC TÁCH DỮ LIỆU ĐÃ ĐƯỢC PARSE
  const finalScore = result?.risk_score ?? result?.riskScore ?? record?.RiskScore ?? riskScore ?? 0;
  const summaryText = result?.summary ?? result?.overview ?? "Không có tóm tắt tổng quan cho hồ sơ này.";

  // Quét lấy mảng rủi ro 
  const riskList = Array.isArray(result?.analysis_report)
    ? result.analysis_report
    : (Array.isArray(result?.risks) ? result.risks : []);

  // Trích xuất văn bản gốc (Nếu có)
  const originalText = result?.full_text ?? result?.contract_text ?? result?.raw_text ?? result?.text ?? null;

  const chartData = [
    { name: "An toàn", value: finalScore, color: "#06b6d4" },
    { name: "Rủi ro", value: Math.max(100 - finalScore, 0), color: "#ef4444" },
  ];

  const handlePrint = () => window.print();

  const getSeverityBadge = (severity) => {
    const level = severity ? severity.toLowerCase() : 'advisory';

    if (level === 'dangerous') {
      // Đỏ đậm: 
      return (
        <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-red-600 text-white border border-red-700 shadow-sm tracking-wide">
          NGUY HIỂM
        </span>
      );
    }

    if (level === 'high risk' || level === 'high') {
      // Vàng/Cam đậm:
      return (
        <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-orange-500 text-white border border-orange-600 shadow-sm tracking-wide">
          RỦI RO CAO
        </span>
      );
    }

    // Lưu ý: Vàng sáng 
    return (
      <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-yellow-100 text-yellow-700 border border-yellow-300 tracking-wide">
        LƯU Ý
      </span>
    );
  };

  return (
    <section className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl p-6 relative print:p-0 print:border-none print:shadow-none print:bg-white">

      {/* Header & Nút In */}
      <div className="mb-6 flex justify-between items-center print:hidden border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-[#B8985D] stroke-2" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
            Báo cáo Thẩm định Hợp đồng
          </h2>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-[#B8985D] hover:text-[#B8985D] rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <PrinterIcon className="w-4 h-4 stroke-2" /> In / Lưu PDF
        </button>
      </div>

      <div className="print-content w-full">
        <div className="hidden print:block text-center mb-10 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black uppercase tracking-widest">BÁO CÁO THẨM ĐỊNH RỦI RO HỢP ĐỒNG</h1>
          <p className="text-sm font-bold mt-2">Hệ thống Trí tuệ Nhân tạo LegAI</p>
        </div>

        {/* 1. Biểu đồ & Tóm tắt tổng quan */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-zinc-100 pb-8 print:border-black/20">
          <div className="relative w-40 h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-black ${finalScore >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{finalScore}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold mt-1">Điểm an toàn</span>
            </div>
          </div>

          <div className="flex-grow">
            <h3 className="text-lg font-bold text-[#1A2530] mb-2 uppercase tracking-wide">Đánh giá tổng quan</h3>
            <p className="text-zinc-600 text-sm leading-relaxed font-medium print:text-black">{summaryText}</p>
          </div>
        </div>

        {/* 2. Chi tiết các rủi ro */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 stroke-2" />
            <h3 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
              Các điều khoản cần chú ý ({riskList.length} rủi ro)
            </h3>
          </div>

          {riskList.length > 0 ? (
            <div className="space-y-5">
              {riskList.map((risk, index) => {
                const level = risk.severity ? risk.severity.toLowerCase() : 'advisory';
                const solutionText = risk.solution || risk.recommendation;
                const legalText = risk.legal_basis?.law ? `${risk.legal_basis.law} ${risk.legal_basis.article ? `(Điều ${risk.legal_basis.article})` : ''}` : risk.legal_basis || risk.description;

                return (
                  <div key={`risk-${index}`} className={`border rounded-2xl p-5 bg-white shadow-sm print:border-black/20 print:shadow-none break-inside-avoid ${level === 'dangerous' ? 'border-red-200' : level.includes('high') ? 'border-orange-200' : 'border-amber-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1A2530] bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                        {risk.pillar || "Điều khoản"}
                      </span>
                      {getSeverityBadge(risk.severity)}
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="bg-zinc-50 border-l-4 border-zinc-300 text-zinc-600 px-4 py-3 rounded-r-xl text-xs font-mono italic print:bg-white print:border-black/30 print:text-black">
                        "{risk.clause || "Không trích dẫn được điều khoản"}"
                      </div>

                      <div className="space-y-2">
                        <p className="text-zinc-700 text-sm leading-relaxed font-medium print:text-black">
                          <span className={`${level === 'dangerous' ? 'text-red-600' : level.includes('high') ? 'text-orange-600' : 'text-amber-600'} font-bold flex items-center gap-1.5 mb-1 print:text-black`}>
                            <ShieldExclamationIcon className="w-4 h-4 stroke-2" /> Phân tích rủi ro:
                          </span>
                          {risk.issue}
                        </p>

                        {legalText && (
                          <p className="text-xs text-zinc-500 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 mt-2 print:border-black/20 print:text-black">
                            ⚖️ <span className="font-bold text-zinc-700 print:text-black">Căn cứ / Mô tả:</span> {legalText}
                          </p>
                        )}
                      </div>

                      {solutionText && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-1 print:bg-white print:border-black/20">
                          <p className="text-emerald-800 text-sm leading-relaxed font-medium print:text-black">
                            <span className="text-emerald-600 font-bold flex items-center gap-1.5 mb-1.5 print:text-black">
                              <CheckBadgeIcon className="w-4 h-4 stroke-2" /> Đề xuất sửa đổi:
                            </span>
                            {solutionText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center print:border-solid print:border-black/20">
              <CheckBadgeIcon className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-zinc-600 print:text-black">Hợp đồng an toàn</p>
              <p className="text-xs text-zinc-500 mt-1 print:text-black">Không phát hiện rủi ro nghiêm trọng nào trong nội dung hợp đồng này.</p>
            </div>
          )}
        </div>

        {/* 3. NỘI DUNG VĂN BẢN GỐC */}
        {originalText && (
          <div className="mt-8 border-t border-zinc-200 pt-8 print:border-black/20 break-inside-avoid">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#1A2530] mb-4 flex items-center gap-2">
              <DocumentMagnifyingGlassIcon className="w-5 h-5 text-[#B8985D] stroke-2" />
              Toàn văn hợp đồng đã phân tích
            </h3>
            <div className="bg-white p-6 md:p-10 border border-zinc-200 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap font-serif text-gray-900 print:border-none print:shadow-none print:p-0">
              {originalText}
            </div>
          </div>
        )}

      </div>

      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .print\\:hidden { display: none !important; }
            .print-content, .print-content * { visibility: visible; }
            .print-content { position: absolute; left: 0; top: 0; width: 100%; }
            .break-inside-avoid { break-inside: avoid; }
          }
        `}
      </style>
    </section>
  );
}