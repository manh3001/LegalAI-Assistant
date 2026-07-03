import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import usePersistedState from '../../hooks/usePersistedState';
import {
    ArrowPathIcon,
    ClipboardDocumentIcon,
    DocumentTextIcon,
    LightBulbIcon,
    ScaleIcon,
    ShieldCheckIcon,
    SparklesIcon,
    VideoCameraIcon,
    MagnifyingGlassIcon,
    CheckBadgeIcon
} from '@heroicons/react/24/outline';

const getConfidenceTone = (level) => {
    switch ((level || '').toUpperCase()) {
        case 'HIGH':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'MEDIUM':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'LOW':
            return 'border-red-200 bg-red-50 text-red-700';
        default:
            return 'border-zinc-200 bg-zinc-50 text-zinc-600';
    }
};
// ==========================================================
// TỪ ĐIỂN MAP DỮ LIỆU ENUM SANG TIẾNG VIỆT
// ==========================================================
const VIETSUB_CONTEXT = {
    'LEGAL': 'Pháp Lý Chuẩn',
    'PARTIAL_LEGAL': 'Có Yếu Tố Pháp Lý',
    'NON_LEGAL': 'Giải Trí / Đời Thường'
};

const VIETSUB_MODE = {
    'VERIFIED': 'Đã Xác Thực (RAG)',
    'PARTIAL': 'Xác Thực Một Phần',
    'DEGRADED': 'Thiếu Data'
};

const VIETSUB_CONFIDENCE = {
    'HIGH': 'Cao (Đủ Data)',
    'MEDIUM': 'Trung Bình (Thiếu Data)',
    'LOW': 'Thấp (Không Có Data)'
};

const VIETSUB_SEVERITY = {
    'DANGEROUS': 'Nguy Hiểm',
    'HIGH_RISK': 'Rủi Ro Cao',
    'ADVISORY': 'Cần Lưu Ý'
};
const getSeverityTone = (severity) => {
    switch (severity) {
        case 'Dangerous':
            return 'bg-red-600 text-white';
        case 'High Risk':
            return 'bg-red-50 text-red-700 border border-red-200';
        default:
            return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
};
// Hàm tự động làm nổi bật text trong ngoặc kép
const highlightQuotes = (text) => {
    if (!text) return null;
    // Tách chuỗi dựa trên dấu ngoặc kép (bao gồm cả ngoặc kép thẳng "" và ngoặc kép cong “”)
    const parts = text.split(/(["“”][^"“”]+["“”])/g);

    return parts.map((part, index) => {
        // Kiểm tra xem đoạn cắt ra có phải là đoạn nằm trong ngoặc kép không
        if (/^["“”].*["“”]$/.test(part)) {
            return (
                <span
                    key={index}
                    // Tailwind : In đậm (font-black), size to (text-[13px]), màu chữ tối/nổi bật, bỏ in nghiêng
                    className="font-black text-[13px] text-zinc-950 not-italic leading-relaxed mx-0.5"
                >
                    {part}
                </span>
            );
        }
        // Nếu là text bình thường thì trả về nguyên bản
        return part;
    });
};
export default function VideoLegalAnalysis() {
    const [videoUrl, setVideoUrl] = usePersistedState('videoUrl', '');
    const [embedUrl, setEmbedUrl] = usePersistedState('embedUrl', '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [videoData, setVideoData] = usePersistedState('videoData', null);
    const [analysisError, setAnalysisError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const parseYoutubeEmbedUrl = (url) => {
        if (!url) return '';
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]+)/);
        return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0` : '';
    };

    const handleUrlChange = (event) => {
        const value = event.target.value;
        setVideoUrl(value);
        setVideoData(null);
        setAnalysisError(null);
        setEmbedUrl(parseYoutubeEmbedUrl(value));
    };

    const formatSummary = (text) => {
        if (!text) return null;

        return text.split('\n').map((line, index) => {
            const cleanLine = line.replace(/###/g, '').trim();
            if (!cleanLine) return <br key={index} />;

            const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
            return (
                <span key={index} className="mb-3 block">
                    {parts.map((part, i) =>
                        i % 2 === 1 ? (
                            <strong key={i} className="font-black text-zinc-950">{part}</strong>
                        ) : (
                            part
                        )
                    )}
                </span>
            );
        });
    };

    const handleAnalyze = async () => {
        if (!videoUrl.trim()) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng nhập URL YouTube của video.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }

        setIsAnalyzing(true);
        setIsSaved(false);
        setAnalysisError(null);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(`${API_URL}/ai/analyze-video`, { videoUrl }, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                timeout: 120000
            });

            if (response.data.success) {
                const result = response.data.data;

                setVideoData({
                    transcript: result.transcript || result.Transcript,
                    summary: result.summary || result.Summary,
                    legalMap: result.legalBases || result.legal_map || [],
                    trustScore: result.trustScore ?? result.TrustScore ?? 0,
                    contextType: result.context_type,
                    confidence: result.confidence,
                    scoringDetails: result.scoring_details,
                    criticalAnalysis: result.critical_analysis || [],
                    actionPlan: result.action_plan || [],
                    grounding: result.grounding,
                    legal_summary_card: result.legal_summary_card || null,
                    critical_analysis_cards: result.critical_analysis_cards || result.critical_analysis || []
                });

                setEmbedUrl(parseYoutubeEmbedUrl(videoUrl));
            } else {
                setAnalysisError(response.data.error || 'Không thể phân tích video này.');
            }
        } catch (error) {
            console.error('Lỗi gọi API phân tích video:', error);
            setAnalysisError(error.response?.data?.error || 'Hệ thống không thể phân tích video này. Bạn kiểm tra lại server hoặc thử URL khác.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text || '');
        Swal.fire({ icon: 'success', title: 'Đã copy Transcript!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
    };

    const handleSave = async () => {
        if (!videoData || isSaved) return;

        setIsSaving(true);

        try {
            const token = localStorage.getItem('accessToken');
            const userStr = localStorage.getItem('user');

            let userId = 1;
            try {
                const user = userStr ? JSON.parse(userStr) : null;
                userId = user?.id ?? user?.Id ?? user?.ID ?? 1;
            } catch { }

            const payload = {
                userId,
                fileName: `Video_${Date.now()}.txt`,
                title: `Phân tích video: ${videoUrl}`,
                recordType: 'VIDEO',
                riskScore: videoData.trustScore || 0,
                content: JSON.stringify({
                    ...videoData,
                    legalBases: videoData.legalMap
                })
            };

            const res = await axios.post(`${API_URL}/history/save`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                Swal.fire({ icon: 'success', title: 'Đã lưu vào ContractHistory!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (err) {
            console.error('Lỗi lưu video:', err);
            Swal.fire({ icon: 'error', title: 'Không thể lưu.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        const result = await Swal.fire({
            title: 'Reset sẽ xoá dữ liệu hiện tại. Bạn chắc chứ?',
            showCancelButton: true,
            confirmButtonText: 'Đồng ý',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#B8985D'
        });
        if (!result.isConfirmed) return;

        setVideoUrl('');
        setEmbedUrl('');
        setVideoData(null);
        setAnalysisError(null);
        setIsSaved(false);
    };

    useEffect(() => {
        if (videoUrl) {
            setEmbedUrl(parseYoutubeEmbedUrl(videoUrl));
        }
    }, [videoUrl]);

    const confidenceLevel = videoData?.confidence?.level || 'N/A';
    const actionPlan = videoData?.actionPlan || [];
    const critical_analysis_cards = videoData?.critical_analysis_cards || [];
    return (
        <div className="h-[calc(100vh-80px)] w-full overflow-y-auto bg-zinc-50 px-6 py-5 text-[#1A2530]">
            <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-6">
                <header className="mb-8 rounded-3xl border-2 border-zinc-300 bg-white p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">Video Legal</p>

                            {videoData && (
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={handleReset}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-100 bg-white px-4 text-xs font-black uppercase tracking-wider text-zinc-600 transition hover:border-zinc-200 hover:text-zinc-950"
                                    >
                                        <ArrowPathIcon className="h-4 w-4" />
                                        Reset
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || isSaved}
                                        className={`inline-flex h-10 min-w-[94px] items-center justify-center rounded-xl px-4 text-xs font-black uppercase tracking-wider transition ${isSaved
                                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'bg-zinc-950 text-white hover:bg-amber-600 disabled:bg-zinc-200 disabled:text-zinc-400'
                                            }`}
                                    >
                                        {isSaving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : isSaved ? 'Đã lưu' : 'Lưu'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-[60%] lg:flex-row lg:items-center">
                            <div className="flex w-full gap-2">
                                <input
                                    type="text"
                                    value={videoUrl}
                                    onChange={handleUrlChange}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-100 bg-white px-4 text-sm text-zinc-800 outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                                />
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || !videoUrl.trim()}
                                    className="inline-flex h-11 min-w-[124px] items-center justify-center rounded-xl bg-zinc-950 px-5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-amber-600 disabled:bg-zinc-200 disabled:text-zinc-400"
                                >
                                    {isAnalyzing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 'Phân tích'}
                                </button>
                            </div>

                        </div>
                    </div>

                    {analysisError && (
                        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs font-semibold text-red-600">
                            {analysisError}
                        </p>
                    )}
                </header>

                <main className="grid min-h-0 flex-1 gap-6 xl:grid-cols-12">
                    <aside className="xl:col-span-4">
                        <div className="rounded-3xl border-2 border-zinc-300 bg-zinc-50/30 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <VideoCameraIcon className="h-5 w-5 text-zinc-500" />
                                    <h2 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Preview</h2>
                                </div>
                                {embedUrl && <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">YouTube</span>}
                            </div>

                            <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                                {embedUrl ? (
                                    <iframe
                                        src={embedUrl}
                                        title="YouTube preview"
                                        className="aspect-video w-full border-none"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="flex aspect-video flex-col items-center justify-center gap-3 text-center">
                                        <VideoCameraIcon className="h-12 w-12 text-zinc-300" />
                                        <p className="max-w-[260px] text-xs font-bold uppercase leading-relaxed tracking-[0.18em] text-zinc-400">
                                            Nhập URL YouTube để xem trước
                                        </p>
                                    </div>
                                )}
                            </div>

                            {videoData?.transcript && (
                                <section className="mt-5 border-t border-zinc-100 pt-5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                                            <DocumentTextIcon className="h-4 w-4" />
                                            Transcript
                                        </h3>
                                        <button
                                            onClick={() => copyToClipboard(videoData.transcript)}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-100 text-zinc-500 transition hover:border-zinc-200 hover:text-zinc-950"
                                            title="Copy Transcript"
                                        >
                                            <ClipboardDocumentIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm italic leading-relaxed text-zinc-600 custom-scrollbar">
                                        {highlightQuotes(videoData.transcript)}
                                    </div>
                                </section>
                            )}
                        </div>
                    </aside>

                    <section className="min-h-0 rounded-3xl border-2 border-zinc-300 bg-white p-6 xl:col-span-8">
                        <div className="border-b border-zinc-100 px-6 py-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="flex items-center gap-3">
                                    <SparklesIcon className="h-5 w-5 text-amber-600" />
                                    <div>
                                        {/* sửa lại text kết quả phân tích màu vàng ánh đồng     */}
                                        <p className="text-[18px] font-black uppercase tracking-[0.24em] text-zinc-400">Kết quả phân tích</p>

                                    </div>
                                </div>

                                {videoData && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                                            Loại nội dung: {VIETSUB_CONTEXT[videoData.contextType] || videoData.contextType || 'N/A'}
                                        </span>

                                        {/* Badge hiển thị trạng thái RAG */}
                                        {videoData.grounding && (
                                            <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${videoData.grounding.grounding_mode === 'DEGRADED'
                                                ? 'border-red-200 bg-red-50 text-red-700'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                }`}>
                                                Chế độ: {VIETSUB_MODE[videoData.grounding.grounding_mode] || videoData.grounding.grounding_mode}
                                            </span>
                                        )}

                                        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${getConfidenceTone(confidenceLevel)}`}>
                                            Mức Độ AI Xác Thực: {VIETSUB_CONFIDENCE[confidenceLevel] || confidenceLevel}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="min-h-[560px] overflow-y-auto custom-scrollbar">
                            {!videoData && !isAnalyzing ? (
                                <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                                    <DocumentTextIcon className="mb-4 h-16 w-16 text-zinc-200" />
                                    <p className="text-xs font-black uppercase tracking-[0.26em] text-zinc-400">Kết quả sẽ hiển thị tại đây</p>
                                </div>
                            ) : isAnalyzing ? (
                                <div className="space-y-4">
                                    <div className="h-32 rounded-2xl bg-zinc-100" />
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="h-28 rounded-2xl bg-zinc-100" />
                                        <div className="h-28 rounded-2xl bg-zinc-100 md:col-span-2" />
                                    </div>
                                    <div className="h-56 rounded-2xl bg-zinc-100" />
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">

                                    <section className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                                        {/* Trust Score Box */}
                                        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6 flex flex-col items-center justify-center min-h-[250px]">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-5">Trust Score</p>

                                            {videoData.trustScore === -1 ? (
                                                <div className="flex flex-col items-center justify-center text-center px-2">
                                                    <div className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-200 flex items-center justify-center mb-4">
                                                        <MagnifyingGlassIcon className="h-10 w-10 text-zinc-200" />
                                                    </div>
                                                    <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Phạm vi không áp dụng</p>
                                                    <p className="mt-2 text-[9px] font-bold text-zinc-400 italic leading-tight">Hệ thống xác định đây là nội dung giải trí/quảng cáo.</p>
                                                </div>
                                            ) : (
                                                <div className="relative h-32 w-32">
                                                    <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                                                        <circle cx="60" cy="60" r="48" fill="none" stroke="#f4f4f5" strokeWidth="8" />
                                                        <circle
                                                            cx="60" cy="60" r="48" fill="none" stroke="#18181b" strokeWidth="8"
                                                            strokeLinecap="round"
                                                            strokeDasharray={301.59}
                                                            strokeDashoffset={301.59 - (301.59 * videoData.trustScore) / 100}
                                                            className="transition-all duration-1000"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-4xl font-black text-zinc-950 tabular-nums">{videoData.trustScore}</span>
                                                        <span className="ml-0.5 pt-3 text-base font-black text-zinc-400">%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Khối nội dung kết quả rà soát & Tóm tắt luật bình dân */}
                                        <div className="space-y-4">
                                            {/* CARD TÓM TẮT LUẬT */}
                                            {videoData.legal_summary_card && (
                                                <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl">
                                                    <h4 className="font-bold text-amber-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                        ⚖️ Tóm tắt luật hiện hành ({videoData.legal_summary_card.title_vong_luat || 'Cơ sở văn bản'})
                                                    </h4>
                                                    <p className="text-zinc-700 text-sm leading-relaxed font-medium text-justify">
                                                        {videoData.legal_summary_card.brief_content}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Báo cáo phân tích Legal Audit tổng quan */}
                                            <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-950">
                                                    <ScaleIcon className="h-5 w-5 text-amber-600" />
                                                    Báo cáo Legal Audit
                                                </h3>
                                                <div className="font-['Inter',ui-sans-serif,system-ui] text-sm font-medium leading-[1.6] text-zinc-700">
                                                    {formatSummary(videoData.summary) || 'Không có tóm tắt dữ liệu.'}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {actionPlan.length > 0 && (
                                        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                            <div className="mb-4 flex items-center gap-2">
                                                <LightBulbIcon className="h-5 w-5 text-amber-600" />
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-950">
                                                    Lộ trình xử lý
                                                </h3>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                {actionPlan.map((item, index) => (
                                                    <article key={`${item.step || index}-${item.action}`} className="flex gap-4 rounded-xl border-2 border-zinc-200 bg-white p-5">
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                                                            {item.step || index + 1}
                                                        </span>
                                                        <p className="pt-1 text-sm font-bold leading-relaxed text-zinc-800">
                                                            {item.action || item}
                                                        </p>
                                                    </article>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                    {/* KHU VỰC PHÂN TÍCH SAI LỆCH THẺ 3 TẦNG - SỬA LẠI ĐỂ SỬ DỤNG BIẾN TRUNG GIAN ĐÃ KHAI BÁO */}
                                    {critical_analysis_cards && critical_analysis_cards.length > 0 ? (
                                        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-6 !mt-6">
                                            <div className="mb-5 flex items-center gap-2">
                                                <ShieldCheckIcon className="h-5 w-5 text-red-600" />
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-950">
                                                    Phân tích sai lệch thông tin
                                                </h3>
                                            </div>
                                            <div className="grid gap-6 lg:grid-cols-1">
                                                {critical_analysis_cards.map((card, idx) => (
                                                    <article key={card.id || idx} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
                                                        {/* Header Card */}
                                                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                                                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Khảo sát nội dung #{idx + 1}</span>
                                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${card.severity === 'DANGEROUS' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                                    card.severity === 'HIGH_RISK' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                                        'bg-blue-100 text-blue-700 border border-blue-200'
                                                                }`}>
                                                                {card.severity === 'DANGEROUS' ? '🚨 Nguy hiểm' : card.severity === 'HIGH_RISK' ? '⚠️ Rủi ro cao' : '💡 Cần lưu ý'}
                                                            </span>
                                                        </div>

                                                        {/* Nội dung 3 tầng đối chiếu chi tiết */}
                                                        <div className="grid grid-cols-1 gap-3 text-sm">
                                                            {/* Tầng 1: Lời thoại clip */}
                                                            <div className="bg-red-50/40 border border-red-100 p-3.5 rounded-xl">
                                                                <span className="font-black text-red-800 text-[12px] uppercase block mb-1 tracking-wide"> Video nói:</span>
                                                                <p className="text-zinc-700 font-medium italic">"{card.video_claim || card.claim || ''}"</p>
                                                            </div>

                                                            {/* Tầng 2: Nơi hiện chi tiết số hiệu Điều/Khoản luật của Nhà nước từ Pinecone */}
                                                            <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-xl">
                                                                <span className="font-black text-emerald-800 text-[12px] uppercase block mb-1 tracking-wide"> Luật thực tế quy định:</span>
                                                                <p className="text-zinc-800 font-semibold leading-relaxed">{card.law_fact || card.truth || 'Không tìm thấy cơ sở pháp lý cụ thể.'}</p>
                                                            </div>

                                                            {/* Tầng 3: Kết luận chốt chặn giải thích cho user */}
                                                            <div className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-xl">
                                                                <span className="font-black text-zinc-800 text-[12px] uppercase block mb-1 tracking-wide"> Kết luận:</span>
                                                                <p className="text-zinc-600 font-medium">{card.conclusion || card.gap || ''}</p>
                                                            </div>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        </section>
                                    ) : (
                                        /* Dự phòng trường hợp video chuẩn hoặc chưa có dữ liệu sai lệch */
                                        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-6 !mt-6 text-center py-10">
                                            <CheckBadgeIcon className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                                            <h3 className="text-sm font-black uppercase text-zinc-950 mb-1">Nội dung đạt chuẩn pháp lý</h3>
                                            <p className="text-xs text-zinc-400 italic">Hệ thống đối chiếu RAG không phát hiện dấu hiệu sai lệch thông tin trong video này.</p>
                                        </section>
                                    )}

                                </motion.div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
