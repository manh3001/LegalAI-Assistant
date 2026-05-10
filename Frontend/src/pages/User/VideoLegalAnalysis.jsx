import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import usePersistedState from '../../hooks/usePersistedState';
import {
    VideoCameraIcon,
    SparklesIcon,
    DocumentTextIcon,
    ClipboardDocumentIcon,
    ArrowPathIcon,
    ScaleIcon
} from '@heroicons/react/24/outline';

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

    // 2. Hàm xử lý Markdown 
    const formatSummary = (text) => {
        if (!text) return null;
        // Tách các dòng ra để xử lý
        return text.split('\n').map((line, index) => {
            // Xóa dấu ### và khoảng trắng thừa
            let cleanLine = line.replace(/###/g, '').trim();
            if (!cleanLine) return <br key={index} />;

            // Xử lý in đậm cho các chữ nằm trong **...**
            const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
            return (
                <span key={index} className="block mb-2">
                    {parts.map((part, i) =>
                        i % 2 === 1 ? (

                            <strong key={i} className="text-[#B8985D] font-black">{part}</strong>
                        ) : (
                            part
                        )
                    )}
                </span>
            );
        });
    };

    // 3. GỌI API THẬT
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
                    'Authorization': `Bearer ${token}`
                },
                timeout: 120000
            });

            if (response.data.success) {
                const result = response.data.data;

                setVideoData({

                    transcript: result.Transcript || result.transcript,
                    summary: result.analysis_report || result.Summary || result.summary,
                    legalMap: (typeof result.LegalBases === 'string'
                        ? JSON.parse(result.LegalBases)
                        : (result.legal_map || result.legalBases)) || [],
                    trustScore: result.TrustScore || result.audit_metrics?.trust_score || result.trustScore || 0,
                    actionPlan: result.action_plan || (result.AnalysisJson ? JSON.parse(result.AnalysisJson).action_plan : [])
                });

                setEmbedUrl(parseYoutubeEmbedUrl(videoUrl));

            } else {
                setAnalysisError(response.data.error || 'Không thể phân tích video này.');
            }
        } catch (error) {
            console.error(" Lỗi gọi API phân tích video:", error);
            setAnalysisError(error.response?.data?.error || "Hệ thống không thể phân tích video này. Bạn kiểm tra lại server hoặc thử URL khác.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Đã copy Transcript!");
    };

    //hàm lưu vào lịch sử phân tích (ContractHistory) - Dành cho Member
    const handleSave = async () => {
        if (!videoData || isSaved) return;

        setIsSaving(true);

        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");

            let userId = 1;
            try {
                const user = userStr ? JSON.parse(userStr) : null;
                userId = user?.id ?? user?.Id ?? user?.ID ?? 1;
            } catch { }

            const payload = {
                userId: userId,
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
                alert(" Đã lưu vào ContractHistory!");
            }

        } catch (err) {
            console.error("Lỗi lưu video:", err);
            alert("Không thể lưu.");
        } finally {
            setIsSaving(false);
        }
    };
    // hàm reset toàn bộ trạng thái để phân tích video mới
    const handleReset = () => {
        if (!window.confirm("Reset sẽ xoá dữ liệu hiện tại. Bạn chắc chứ?")) return;

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

    return (

        <div className="w-full h-[calc(100vh-80px)] p-6 text-[#1A2530] overflow-hidden flex flex-col md:flex-row gap-6">

            {/*  CỘT TRÁI: ĐIỀU KHIỂN & VIDEO (40%) */}
            <div className="w-full md:w-5/12 flex flex-col gap-6 h-full">
                {/* Ô nhập URL YouTube - Đổi sang nền trắng kính mờ */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-zinc-200 p-6">
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 ml-1">
                            YouTube Video URL
                        </label>

                        {/* VÙNG RELATIVE ĐƯỢC CÔ LẬP CHO INPUT VÀ BUTTON */}
                        <div className="relative w-full">
                            <input
                                type="text"
                                value={videoUrl}
                                onChange={handleUrlChange}
                                placeholder="https://www.youtube.com/watch?v=..."
                                // Thêm pr-[130px] để chữ không bị khuất sau nút
                                className="w-full text-sm rounded-2xl border border-zinc-200 pl-5 pr-[130px] py-4 focus:outline-none focus:ring-2 focus:ring-[#B8985D] bg-zinc-50/50 transition-all"
                            />
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !videoUrl.trim()}
                                // Nút giờ chỉ bám theo cái input, thu nhỏ lại một chút cho thanh lịch
                                className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-[#1A2530] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#B8985D] active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:hover:scale-100 flex items-center justify-center"
                            >
                                {isAnalyzing ? (
                                    <span className="inline-flex items-center gap-2">
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    </span>
                                ) : "Phân tích"}
                            </button>
                        </div>

                        {/* Vùng hiển thị lỗi đẩy xuống dưới cùng */}
                        {analysisError && (
                            <p className="text-[11px] text-red-500 font-medium ml-2 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-red-500 inline-block animate-pulse"></span>
                                {analysisError}
                            </p>
                        )}
                    </div>
                </div>

                {/* Khung chạy Video */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-zinc-200 flex-grow overflow-hidden relative group p-2">
                    {embedUrl ? (
                        <div className="w-full h-full rounded-2xl overflow-hidden">
                            <iframe
                                src={embedUrl}
                                title="YouTube preview"
                                className="w-full h-full border-none rounded-2xl"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                            <div className="p-8 rounded-full bg-zinc-100 mb-4 group-hover:scale-110 transition-transform">
                                <VideoCameraIcon className="w-16 h-16 text-zinc-400 stroke-1" />
                            </div>
                            <p className="text-sm font-bold tracking-widest uppercase text-zinc-400">Nhập URL YouTube để xem trước và phân tích</p>
                        </div>
                    )}
                </div>
            </div>




            {/*  CỘT PHẢI: KẾT QUẢ AI (60%) */}
            <div className="w-full md:w-7/12 flex flex-col h-full overflow-hidden bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl">
                <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-[#B8985D] stroke-2" />
                        <h2 className="font-black uppercase tracking-tighter text-xl text-[#1A2530]">LEGAL Insights</h2>
                    </div>

                    {/* ⭐ GROUP RIGHT SIDE */}
                    <div className="flex items-center gap-2">

                        {videoData && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 hover:border-[#B8985D] hover:text-[#B8985D] transition"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                                RESET
                            </button>
                        )}

                        {videoData && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isSaved}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition ${isSaved
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                        : 'bg-[#1A2530] text-white hover:bg-[#B8985D]'
                                    }`}
                            >
                                {isSaving ? (
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                ) : 'LƯU'}
                            </button>
                        )}

                        {videoData && (
                            <span className="bg-[#B8985D]/10 text-[#8E6D45] px-4 py-1.5 rounded-full text-[10px] font-black border border-[#B8985D]/20 tracking-wider">
                                AI PROCESSED
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-white/50">
                    {!videoData && !isAnalyzing ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                            <DocumentTextIcon className="w-20 h-20 mb-4 text-zinc-400 stroke-1" />
                            <p className="font-bold uppercase tracking-[0.3em] text-zinc-500">Kết quả sẽ hiển thị tại đây</p>
                        </div>
                    ) : isAnalyzing ? (
                        // Skeleton Loaders màu sáng
                        <div className="space-y-6 animate-pulse">
                            <div className="h-32 bg-zinc-200 rounded-3xl" />
                            <div className="h-64 bg-zinc-200 rounded-3xl" />
                            <div className="h-20 bg-zinc-200 rounded-3xl" />
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

                            {/* SECTION: TRANSCRIPT */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="flex items-center gap-2 text-[#B8985D] font-black uppercase text-xs tracking-widest">
                                        <DocumentTextIcon className="w-4 h-4 stroke-2" /> Transcript bóc tách
                                    </h3>
                                    <button
                                        onClick={() => copyToClipboard(videoData.transcript)}
                                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-[#B8985D] transition-colors border border-transparent hover:border-zinc-200"
                                        title="Copy Transcript"
                                    >
                                        <ClipboardDocumentIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 text-zinc-600 text-sm leading-relaxed italic max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                                    "{videoData.transcript}"
                                </div>
                            </section>

                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* SECTION: BÁO CÁO KIỂM TOÁN */}
                                <div className="bg-white shadow-sm p-6 rounded-3xl border border-zinc-200 lg:col-span-2">
                                    <h4 className="font-black mb-4 flex items-center gap-2 text-lg text-[#1A2530]">
                                        <ScaleIcon className="w-6 h-6 text-[#B8985D] stroke-2" /> Báo cáo Legal Audit
                                    </h4>
                                    <div className="text-zinc-600 text-sm leading-relaxed font-medium">
                                        {formatSummary(videoData.summary)}
                                    </div>
                                </div>

                                {/* SECTION: CHECKLIST CƠ SỞ PHÁP LÝ */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Kiểm toán pháp lý</h4>
                                    <div className="flex flex-col gap-3">
                                        {videoData.legalMap && videoData.legalMap.length > 0 ? (
                                            videoData.legalMap.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                                    <div>
                                                        <p className="text-xs font-bold text-[#1A2530]">{item.law_name}</p>
                                                        <p className="text-[10px] text-zinc-500 font-medium mt-1">Điều/Khoản: {item.article}</p>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black border ${item.status?.toLowerCase() === 'đúng'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        : 'bg-red-50 text-red-600 border-red-200'
                                                        }`}>
                                                        {item.status ? item.status.toUpperCase() : 'N/A'}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-zinc-400 italic font-medium">Không tìm thấy cơ sở pháp lý cụ thể.</p>
                                        )}
                                    </div>
                                </div>

                                {/* SECTION: TRUST SCORE */}
                                <div className="space-y-5 flex flex-col justify-center">
                                    <div className="flex justify-between items-end bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                                        <div>
                                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Độ tin cậy</h4>
                                            <p className="text-xs text-zinc-500 font-medium">Trust Score</p>
                                        </div>
                                        <span className="text-4xl font-black text-[#1A2530] tabular-nums">{videoData.trustScore}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-zinc-200 rounded-full overflow-hidden shadow-inner">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${videoData.trustScore}%` }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            // Đổi dải màu sang Vàng Đồng
                                            className="h-full bg-gradient-to-r from-[#C5A880] to-[#8E6D45]"
                                        />
                                    </div>
                                </div>
                            </section>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}