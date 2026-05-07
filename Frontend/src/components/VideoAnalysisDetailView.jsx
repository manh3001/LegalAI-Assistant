import {
  VideoCameraIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export default function VideoAnalysisDetailView({ record }) {
  let rawJson =
    record.fullData?.AnalysisJson ||
    record.fullData?.analysisJson ||
    record.AnalysisJson ||
    record.analysisJson;

  let data = {};

  try {
    data = rawJson ? JSON.parse(rawJson) : {};
  } catch (error) {
    console.error("Parse lỗi:", error);
    data = {};
  }

 const { summary, legalMap, trustScore } = data;
const legalBases = legalMap || [];

  return (
    <section className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl p-6">
      <div className="mb-6 flex items-center gap-2">
        <VideoCameraIcon className="h-5 w-5 text-orange-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Phân tích video
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary Card */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#1A2530] mb-3 uppercase tracking-wide">
              Tóm tắt nội dung
            </h3>
            <p className="text-sm font-medium text-zinc-700 leading-6">
              {summary || 'Không có tóm tắt'}
            </p>
          </div>
        </div>

        {/* Trust Score Card */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2"
                />
                <path
                  d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                  fill="none"
                  stroke={trustScore >= 80 ? "#10b981" : trustScore >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="2"
                  strokeDasharray={`${trustScore}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black ${trustScore >= 80 ? "text-emerald-600" : trustScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                  {trustScore || 0}%
                </span>
              </div>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Độ tin cậy
            </p>
          </div>
        </div>
      </div>

      {/* Legal Bases List */}
      {legalBases.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[#1A2530] mb-4 uppercase tracking-wide">
            Cơ sở pháp lý
          </h3>
          <div className="space-y-3">
            {legalBases.map((base, idx) => (
  <div
    key={`base-${idx}`}
    className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
  >
    <CheckCircleIcon className="h-5 w-5 text-emerald-600 stroke-2 flex-shrink-0 mt-0.5" />

    <div className="text-sm text-zinc-700">
      <p className="font-semibold text-[#1A2530]">
        {base.law_name || "Không rõ luật"}
      </p>
      <p className="text-xs text-zinc-500 mt-1">
        {base.article || "Không rõ điều khoản"}
      </p>

      <span
        className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded ${
          base.status?.toLowerCase() === "đúng"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-red-50 text-red-600"
        }`}
      >
        {base.status || "N/A"}
      </span>
    </div>
  </div>
))}
          </div>
        </div>
      )}
    </section>
  );
}
