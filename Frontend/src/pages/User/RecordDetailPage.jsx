import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  CalendarIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import {
  getTypeConfig,
  normalizeRecord,
  parseAnalysisJson,
  renderRecordBadge,
} from "../../utils/legalRecordUtils";
import {
  getMockDetailResponse,
  USE_MOCK_DATA,
} from "../../mockData/legalRecordsMock";
// Import 5 sub-components
import AnalysisDetailView from "../../components/AnalysisDetailView";
import ChatDetailView from "../../components/ChatDetailView";
import PlanningDetailView from "../../components/PlanningDetailView";
import VideoAnalysisDetailView from "../../components/VideoAnalysisDetailView";
import FormDetailView from "../../components/FormDetailView";

export default function RecordDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log("🔍 Current Record Data:", record);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        let res;

        {
          // Gọi API thực tế
          const token = localStorage.getItem("accessToken");
          res = await axios.get(
            `http://localhost:8000/api/history/detail/${id}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );
        }

        if (res.data?.success) {
          setRecord(normalizeRecord(res.data.data));
        } else {
          toast.error(res.data?.message || "Không thể tải hồ sơ.");
        }
      } catch (error) {
        console.error("Fetch record detail error:", error);
        toast.error(
          error.response?.data?.message || "Không thể tải hồ sơ này.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const safeRecord = useMemo(() => normalizeRecord(record || {}), [record]);
  const config = getTypeConfig(safeRecord.type);
  const riskScore = Number(safeRecord.riskScore || 0);

  const detailRows = [
    ["Mã hồ sơ", safeRecord.id || "N/A"],
    ["Tên hồ sơ", safeRecord.name],
    ["Loại hồ sơ", config.label || "N/A"],
    [
      "Ngày tạo",
      safeRecord.createdAt
        ? new Date(safeRecord.createdAt).toLocaleString("vi-VN")
        : safeRecord.date,
    ],
    ["Tên file", safeRecord.fileName || "Không có file"],
    ["Mô tả", safeRecord.description || "Chưa có mô tả"],
  ];

  // Hàm render nội dung chi tiết dựa trên type
  const renderDetailContent = () => {
    const type = String(safeRecord.type || "").toUpperCase();

    switch (type) {
      case "ANALYSIS":
        return <AnalysisDetailView record={safeRecord} riskScore={riskScore} />;
      case "CHAT":
        return <ChatDetailView record={safeRecord} />;
      case "PLANNING":
        return <PlanningDetailView record={safeRecord} />;
      case "VIDEO":
        return <VideoAnalysisDetailView record={safeRecord} />;
      case "FORM":
        return <FormDetailView record={safeRecord} />;
      default:
        return (
          <div className="lg:col-span-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <DocumentTextIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-600">
              Loại hồ sơ không được hỗ trợ
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Không thể hiển thị chi tiết cho loại hồ sơ này.
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-[#B8985D] font-black uppercase tracking-widest">
        Đang tải hồ sơ...
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-4 text-[#1A2530]">
        <DocumentTextIcon className="h-14 w-14 text-zinc-300 stroke-1" />
        <p className="font-bold">Không tìm thấy hồ sơ.</p>
        <button
          onClick={() => navigate("/ho-so-phap-ly")}
          className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-600 shadow-sm hover:text-[#B8985D]"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-x-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
      {/* Decorative Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#B8985D]/5 rounded-full blur-[120px] -z-10"></div>

      <main className="max-w-6xl mx-auto w-full px-6 py-24 relative z-10">
        {/* Header Actions */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-fit px-6 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 hover:text-[#1A2530] transition-colors shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 stroke-2" /> Quay lại
          </button>
          <button
            onClick={() => navigate(`/ho-so/chinh-sua/${safeRecord.id}`)}
            className="w-fit px-6 py-3 bg-[#1A2530] border border-[#1A2530] rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:bg-[#263442] transition-colors shadow-sm"
          >
            <PencilSquareIcon className="w-4 h-4 stroke-2" /> Chỉnh sửa
          </button>
        </div>

        {/* Main Content Section */}
        <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-zinc-100 p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <div
                  className={`rounded-2xl border border-zinc-100 p-4 shadow-sm ${config.bgColor}`}
                >
                  {config.icon}
                </div>
                <div className="flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    {renderRecordBadge(safeRecord)}
                    <span className="inline-flex items-center gap-2 rounded-md border border-[#B8985D]/30 bg-[#B8985D]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#8E6D45]">
                      <CalendarIcon className="h-3.5 w-3.5 stroke-2" />{" "}
                      {safeRecord.date}
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide text-[#1A2530] leading-tight">
                    {safeRecord.name}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-zinc-500">
                    {safeRecord.description || "Hồ sơ chưa có mô tả chi tiết."}
                  </p>
                </div>
              </div>

              {/* Risk Score Card - Chỉ hiển thị cho ANALYSIS và VIDEO_ANALYSIS */}
              {["ANALYSIS", "VIDEO_ANALYSIS"].includes(
                String(safeRecord.type || "").toUpperCase(),
              ) && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4 text-center shadow-inner flex-shrink-0">
                  <div
                    className={`text-4xl font-black ${riskScore >= 80 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {riskScore}%
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                    Điểm an toàn
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Body Content - Dynamic per Type */}
          <div className="grid gap-8 p-8 lg:grid-cols-3">
            {/* Info Panel - Luôn hiển thị */}
            <aside className="space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-[#B8985D]">
                  Thông tin hồ sơ
                </h3>
                <div className="space-y-3">
                  {detailRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-zinc-200/70 pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                        {label}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-[#1A2530]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Dynamic Content Panel */}
            {renderDetailContent()}
          </div>
        </section>
      </main>
    </div>
  );
}
