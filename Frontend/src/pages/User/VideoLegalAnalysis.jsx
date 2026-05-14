import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
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
    MagnifyingGlassIcon
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
            alert('Vui lòng nhập URL YouTube của video.');
            return;
        }

        setIsAnalyzing(true);
        setIsSaved(false);
        setAnalysisError(null);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.post('http://localhost:8000/api/ai/analyze-video', { videoUrl }, {
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
                    legalMap: result.legal_map || result.legalBases || (typeof result.LegalBases === 'string' ? JSON.parse(result.LegalBases) : []),
                    trustScore: result.trustScore ?? result.TrustScore ?? 0,
                    contextType: result.context_type,
                    confidence: result.confidence,
                    scoringDetails: result.scoring_details,
                    criticalAnalysis: result.critical_analysis || [],
                    actionPlan: result.action_plan || []
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
        alert('Đã copy Transcript!');
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

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                alert('Đã lưu vào ContractHistory!');
            }
        } catch (err) {
            console.error('Lỗi lưu video:', err);
            alert('Không thể lưu.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (!window.confirm('Reset sẽ xoá dữ liệu hiện tại. Bạn chắc chứ?')) return;

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
    const criticalAnalysis = videoData?.criticalAnalysis || [];
    const legalMap = videoData?.legalMap || [];

    return (
        <div className="h-[calc(100vh-80px)] w-full overflow-y-auto bg-zinc-50 px-6 py-5 text-[#1A2530]">
            <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-6">
                <header className="mb-8 rounded-3xl border-2 border-zinc-300 bg-white p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">Video Legal Audit</p>

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
                                    {isAnalyzing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 'Analyze'}
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
                                        "{videoData.transcript}"
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
                                            Loại nội dung: {videoData.contextType || 'N/A'}
                                        </span>
                                        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${getConfidenceTone(confidenceLevel)}`}>
                                            Độ tin cậy: {confidenceLevel}
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
                                        {/* Trust Score Box - Section 1 của Grid */}
                                        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6 flex flex-col items-center justify-center min-h-[250px]">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-5">Trust Score</p>

                                            {videoData.trustScore === -1 ? (
                                                /* HIỂN THỊ KHI VIDEO LÀ NON_LEGAL (-1) */
                                                <div className="flex flex-col items-center justify-center text-center px-2">
                                                    <div className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-200 flex items-center justify-center mb-4">
                                                        <MagnifyingGlassIcon className="h-10 w-10 text-zinc-200" />
                                                    </div>
                                                    <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                                                        Phạm vi không áp dụng
                                                    </p>
                                                    <p className="mt-2 text-[9px] font-bold text-zinc-400 italic leading-tight">
                                                        Hệ thống xác định đây là nội dung giải trí/quảng cáo.
                                                    </p>
                                                </div>
                                            ) : (
                                                /* HIỂN THỊ VÒNG TRÒN KHI CÓ ĐIỂM (0-100) */
                                                <>
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
                                                    {videoData.scoringDetails?.calculation_note && (
                                                        <p className="mt-5 text-[10px] italic leading-relaxed text-zinc-500 text-center">
                                                            {videoData.scoringDetails.calculation_note}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                            <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-950">
                                                <ScaleIcon className="h-5 w-5 text-amber-600" />
                                                Báo cáo Legal Audit
                                            </h3>
                                            <div className="font-['Inter',ui-sans-serif,system-ui] text-sm font-medium leading-[1.6] text-zinc-700">
                                                {formatSummary(videoData.summary) || 'Không có tóm tắt dữ liệu.'}
                                            </div>
                                        </div>
                                    </section>

                                    {actionPlan.length > 0 && (
                                        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                            <div className="mb-4 flex items-center gap-2">
                                                <LightBulbIcon className="h-5 w-5 text-amber-600" />
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-950">
                                                    Lộ trình xử lý (Action Plan)
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

                                    {criticalAnalysis.length > 0 && (
                                        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                            <div className="mb-4 flex items-center gap-2">
                                                <ShieldCheckIcon className="h-5 w-5 text-red-600" />
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-950">
                                                    Phân tích sai lệch (Critical Audit)
                                                </h3>
                                            </div>
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                {criticalAnalysis.map((item, i) => (
                                                    <article key={`${item.claim || 'critical'}-${i}`} className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                                                        <div className="mb-4 flex items-center justify-between gap-3">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Issue {i + 1}</span>
                                                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getSeverityTone(item.severity)}`}>
                                                                {item.severity || 'Review'}
                                                            </span>
                                                        </div>
                                                        <p className="mb-3 text-xs italic leading-relaxed text-zinc-500">"{item.claim}"</p>
                                                        <p className="text-sm font-bold leading-relaxed text-zinc-900">Sự thật: {item.truth}</p>
                                                        <p className="mt-2 text-xs font-semibold leading-relaxed text-red-600">Lỗ hổng: {item.gap}</p>
                                                    </article>
                                                ))}
                                            </div>
                                        </section>


                                    )}

                                    <section className="rounded-2xl border-2 border-zinc-200 bg-white p-[15px] !mt-[15px]">
                                        <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-zinc-950">
                                            Kiểm toán pháp lý
                                        </h3>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {legalMap.length > 0 ? (
                                                legalMap.map((item, i) => (
                                                    <article key={`${item.law_name || 'law'}-${i}`} className="rounded-xl border-2 border-zinc-200 bg-white p-5">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="text-sm font-black text-zinc-950">{item.law_name || 'Văn bản chưa xác định'}</p>
                                                                <p className="mt-1 text-xs font-medium text-zinc-500">Điều/Khoản: {item.article || 'Cần đối chiếu thêm'}</p>
                                                            </div>
                                                            <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-black uppercase text-zinc-600">
                                                                {item.status || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </article>
                                                ))
                                            ) : (
                                                <p className="text-sm italic text-zinc-400">Không tìm thấy cơ sở pháp lý cụ thể.</p>
                                            )}
                                        </div>
                                    </section>
                                </motion.div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
