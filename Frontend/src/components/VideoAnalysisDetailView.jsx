import React from 'react';
import { motion } from 'framer-motion';
import {
  VideoCameraIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ScaleIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

// Đồng bộ bộ màu Tones với VideoLegalAnalysis
const getConfidenceTone = (level) => {
  switch ((level || '').toUpperCase()) {
    case 'HIGH': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'MEDIUM': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'LOW': return 'border-red-200 bg-red-50 text-red-700';
    default: return 'border-zinc-200 bg-zinc-50 text-zinc-600';
  }
};

const getSeverityTone = (severity) => {
  switch (severity) {
    case 'Dangerous': return 'bg-red-600 text-white';
    case 'High Risk': return 'bg-red-50 text-red-700 border border-red-200';
    default: return 'bg-amber-50 text-amber-700 border border-amber-200';
  }
};

export default function VideoAnalysisDetailView({ record }) {
  // 1. Bóc tách dữ liệu từ record (Hồ sơ lưu)
  let rawJson = record.fullData?.AnalysisJson || record.AnalysisJson || record.analysisJson;
  let data = {};
  try {
    data = rawJson ? (typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson) : {};
  } catch (error) {
    console.error("Lỗi Parse AnalysisJson:", error);
  }

  // 2. Mapping Key đồng bộ hoàn toàn với VideoLegalAnalysis.jsx
  const summary = data.summary || data.Summary;
  const contextType = data.context_type || data.contextType;
  const confidenceLevel = data.confidence?.level || 'N/A';
  const trustScore = data.trustScore ?? data.TrustScore ?? 0;
  const legalMap = data.legal_map || data.legalMap || data.legalBases || [];
  const criticalAnalysis = data.critical_analysis || data.criticalAnalysis || [];
  const actionPlan = data.action_plan || data.actionPlan || [];
  const scoringDetails = data.scoring_details || data.scoringDetails;

  // 3. Hàm format text chuẩn Impeccable
  const formatSummary = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      const cleanLine = line.replace(/###/g, '').trim();
      if (!cleanLine) return <br key={index} />;
      const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={index} className="mb-3 block">
          {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-black text-zinc-950">{part}</strong> : part)}
        </span>
      );
    });
  };

  // 4. Case Video giải trí / quảng cáo (NON_LEGAL) - Đồng bộ UI Empty State
  if (contextType === 'NON_LEGAL' || trustScore === -1) {
    return (
      <section className="lg:col-span-3 rounded-3xl border-2 border-zinc-300 bg-white p-12 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-200 flex items-center justify-center mb-6">
            <MagnifyingGlassIcon className="h-10 w-10 text-zinc-200" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.24em] text-zinc-400">Kết quả phân tích</h2>
          <p className="mt-4 text-base font-bold text-zinc-500">Nội dung không chứa dữ liệu pháp lý.</p>
          <p className="text-[11px] text-zinc-400 italic mt-1 max-w-xs mx-auto">
            Video được nhận diện là nội dung giải trí hoặc quảng cáo. Hệ thống LegAI đã tự động bỏ qua chấm điểm.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="lg:col-span-3 min-h-0 flex flex-col overflow-hidden rounded-3xl border-2 border-zinc-300 bg-white">
      {/* Header - Đồng bộ với VideoLegalAnalysis */}
      <div className="shrink-0 border-b border-zinc-100 px-8 py-6 bg-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Legal Insights (Archived)</p>
              <h2 className="text-xl font-black tracking-tight text-zinc-950 uppercase">Chi tiết Hồ sơ Kiểm toán</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
              Loại nội dung: {contextType}
            </span>
            <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${getConfidenceTone(confidenceLevel)}`}>
              Độ tin cậy: {confidenceLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Body Nội dung - Cuộn mượt với p-8 */}
      <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
          
          {/* Section: Score & Summary Grid */}
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Score Box */}
            <div className="rounded-2xl border-2 border-zinc-100 bg-white p-6 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-6">Trust Score</p>
              <div className="relative h-32 w-32 mb-4">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#f4f4f5" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" stroke="#18181b" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={326.7}
                    strokeDashoffset={326.7 - (326.7 * trustScore) / 100}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-black text-zinc-950">{trustScore}%</span>
                </div>
              </div>
              {scoringDetails?.calculation_note && (
                <p className="text-[9px] font-bold text-zinc-400 italic leading-tight px-2">
                  {scoringDetails.calculation_note}
                </p>
              )}
            </div>

            {/* Summary Box */}
            <div className="rounded-2xl border-2 border-zinc-100 bg-zinc-50/30 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-950">
                <ScaleIcon className="h-5 w-5 text-amber-600" /> Báo cáo Legal Audit
              </h3>
              <div className="text-sm font-medium leading-relaxed text-zinc-700">
                {formatSummary(summary) || "Không có tóm tắt dữ liệu."}
              </div>
            </div>
          </div>

          {/* Section: Action Plan */}
          {actionPlan.length > 0 && (
            <div className="rounded-2xl border-2 border-zinc-100 bg-white p-6 shadow-sm">
              <h3 className="text-[10px] font-black uppercase text-zinc-950 mb-6 tracking-widest flex items-center gap-2">
                <LightBulbIcon className="h-4 w-4 text-amber-500" /> Lộ trình xử lý (Action Plan)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {actionPlan.map((item, i) => (
                  <div key={i} className="flex gap-4 rounded-xl border-2 border-zinc-50 bg-zinc-50/30 p-4 hover:border-amber-100 transition-colors">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-700">{item.step || i + 1}</span>
                    <p className="text-xs font-bold text-zinc-800 pt-1 leading-relaxed">{item.action || item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Critical Analysis */}
          {criticalAnalysis.length > 0 && (
            <div className="rounded-2xl border-2 border-zinc-100 bg-white p-6 shadow-sm">
              <h3 className="text-[10px] font-black uppercase text-red-600 mb-6 tracking-widest flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4" /> Phân tích sai lệch (Critical Audit)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {criticalAnalysis.map((item, i) => (
                  <div key={i} className="rounded-xl border-2 border-zinc-50 p-5 bg-red-50/20">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Issue {i + 1}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase ${getSeverityTone(item.severity)}`}>{item.severity}</span>
                    </div>
                    <p className="text-xs italic text-zinc-500 mb-2 leading-relaxed">"{item.claim}"</p>
                    <p className="text-[13px] font-black text-zinc-900">Sự thật: {item.truth}</p>
                    <p className="text-[11px] text-red-600 font-bold italic mt-1">Lỗ hổng: {item.gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Legal Map */}
          <div className="rounded-2xl border-2 border-zinc-100 bg-white p-6 shadow-sm !mt-10">
            <h3 className="text-[10px] font-black uppercase text-zinc-950 mb-6 tracking-widest flex items-center gap-2">
              <ScaleIcon className="h-4 w-4 text-emerald-600" /> Kiểm toán pháp lý
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {legalMap.length > 0 ? (
                legalMap.map((item, i) => (
                  <div key={i} className="rounded-xl border-2 border-zinc-50 p-4 flex items-start justify-between bg-zinc-50/20 hover:border-emerald-100 transition-colors">
                    <div>
                      <p className="text-xs font-black text-zinc-950">{item.law_name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 mt-1">Điều/Khoản: {item.article}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-md text-[9px] font-black border ${item.status?.toLowerCase() === 'đúng' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                      {item.status || 'CẦN ĐỐI CHIẾU'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs italic text-zinc-400 col-span-2">Không tìm thấy cơ sở pháp lý cụ thể.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}