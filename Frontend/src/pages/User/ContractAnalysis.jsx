import React, { useState, useRef } from 'react';
import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    StopIcon,
    ShieldExclamationIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";
import axios from "axios";
import { API_URL } from '../../config/api';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import usePersistedState from '../../hooks/usePersistedState';
import Swal from 'sweetalert2';


export default function ContractAnalysis() {
    // --- STATE thường  ---
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // --- STATE F5  ---

    const [analyzedFileName, setAnalyzedFileName] = usePersistedState('legai_contract_filename', '');
    const [result, setResult] = usePersistedState('legai_contract_result', null);
    const [isSaved, setIsSaved] = usePersistedState('legai_contract_is_saved', false);

    // --- REFS ---
    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);
    const fileInputRef = useRef(null);
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        const ext = (selectedFile.name.split('.').pop() || '').toLowerCase();
        if (!['pdf', 'txt', 'doc', 'docx'].includes(ext)) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng chọn file văn bản (.pdf, .txt, .doc)', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }
        setFile(selectedFile);
    };

    const handleCancelAnalysis = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setIsAnalyzing(false);
        setProgress(0);
        // Đã xóa setStatusIndex ở đây để hết lỗi trắng màn hình
        console.log(" đã dừng phân tích.");
    };

    const handleAnalyze = async () => {
        if (!file) return;
        abortControllerRef.current = new AbortController();
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);
        setIsSaved(false);

        // Bắt đầu chạy progress ảo
        intervalRef.current = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 600);

        try {
            const aiResult = await aiClient.analyzeContract(file, abortControllerRef.current.signal);
            const analysis = aiResult?.data ?? aiResult;

            setProgress(100);
            setResult(analysis);
            // LƯU TÊN FILE VÀO STORAGE KHI F5
            setAnalyzedFileName(file.name);

        } catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error("Lỗi:", error);
                Swal.fire({ icon: 'error', title: 'Có lỗi xảy ra. Hãy thử lại!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } finally {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsAnalyzing(false);
        }
    };
    const handleSaveToHistory = async () => {
        if (!result || !file) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 };
            const userId = user.id ?? user.Id ?? user.ID;

            // =================================================================
            // TRÍCH XUẤT CHUỖI VĂN BẢN GỐC AN TOÀN - CHỐNG [object Object]
            // =================================================================
            let rawContractString = "";
            
            if (result?.original_text) {
                // Nếu là đối tượng, ép về chuỗi hoặc bốc thuộc tính nội dung
                rawContractString = typeof result.original_text === 'object' 
                    ? (result.original_text.text || JSON.stringify(result.original_text))
                    : String(result.original_text);
            } else if (result?.originalText) {
                rawContractString = String(result.originalText);
            } else if (result?.full_text) {
                rawContractString = String(result.full_text);
            }

            // Phòng hờ nếu chuỗi trích xuất ra vẫn dính chữ rác do AI lồng
            if (rawContractString === "[object Object]" || !rawContractString) {
                rawContractString = "Nội dung văn bản gốc được bảo mật lưu trữ trong cấu trúc hồ sơ phân tích.";
            }

            const payload = {
                userId: userId,
                fileName: file.name,
                title: `Thẩm định: ${file.name}`,
                recordType: 'ANALYSIS',
                riskScore: result.risk_score ?? result.riskScore ?? 0,
                content: JSON.stringify(result), // Chứa JSON kết quả rà soát
                
                // 🎯 ĐÃ SỬA THÀNH CÔNG: Đảm bảo dữ liệu đẩy lên SQL Server luôn là STRING THÔ SẠCH SẼ
                contractText: rawContractString
            };

            const res = await axios.post(`${API_URL}/history/save`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setIsSaved(true);
                Swal.fire({ icon: 'success', title: 'Đã lưu hồ sơ vào Kho lưu trữ số thành công!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (saveErr) {
            console.error("Lỗi lưu SQL:", saveErr);
            Swal.fire({ icon: 'error', title: 'Lỗi khi lưu hồ sơ vào Database.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setIsSaving(false);
        }
    };
    // Helper: Badge 
    const getSeverityBadge = (severity) => {
        // Chuyển về chữ thường để tránh lỗi type mismatch (ví dụ AI trả về 'Dangerous' hay 'dangerous' đều dính)
        const level = severity ? severity.toLowerCase() : 'advisory';

        if (level === 'dangerous') {
            return (
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                    NGUY HIỂM
                </span>
            );
        }

        // Gộp luôn case 'high' cũ phòng hờ AI ngáo quên chữ 'risk'
        if (level === 'high risk' || level === 'high') {
            return (
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    RỦI RO CAO
                </span>
            );
        }

        // Mặc định cho 'advisory' hoặc các trường hợp khác
        return (
            <span className="px-2 py-1 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                LƯU Ý
            </span>
        );
    };

    const chartData = result ? [
        { name: 'An toàn', value: result.risk_score ?? result.riskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (result.risk_score ?? result.riskScore ?? 0), color: '#ef4444' }
    ] : [];
    // Helper: Reset tất cả trạng thái về ban đầu, bao gồm cả giá trị thẻ input
    const resetAll = () => {
        setFile(null);
        setResult(null);
        setAnalyzedFileName('');
        setIsSaved(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    // xử lý khi người dùng muốn xóa file đã chọn (nếu có) và reset trạng thái về ban đầu
    const handleRemoveFile = (e) => {

        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }



        resetAll();
        console.log("Đã xóa file và reset trạng thái.");
    };

    return (
        <div className="w-full relative">
            {/* Progress Bar - Đổi sang màu Vàng Đồng */}
            {isAnalyzing && (
                <div className="absolute top-0 left-0 w-full h-1 bg-transparent z-[9999]">
                    <div
                        className="h-full bg-[#B8985D] transition-all duration-300 shadow-[0_0_12px_rgba(184,152,93,0.6)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10 pb-20 gap-10">
                {/* 🟢 CỘT TRÁI */}
                <div className="w-full md:w-5/12 relative z-10 flex flex-col gap-6">
                    <div className="text-left mb-6">
                        {/* Tiêu đề Đen Than + Vàng Đồng */}
                        <h1 className="text-4xl lg:text-6xl font-black uppercase text-[#1A2530] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C5A880] to-[#8E6D45]">Hợp đồng AI</span>
                        </h1>
                    </div>

                    <div className="w-full flex flex-col gap-4">
                        <label className="block w-full cursor-pointer group relative shadow-sm">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

                            {/* Upload Box: Nền trắng, viền kẽm, hiệu ứng vàng đồng */}
                            <div className={`group bg-white/80 backdrop-blur-xl rounded-[2rem] p-10 text-center transition-all duration-500 relative flex flex-col items-center justify-center min-h-[200px]
    border-2 border-dashed 
    ${file
                                    ? 'border-[#B8985D] bg-[#B8985D]/5 shadow-[0_10px_30px_rgba(184,152,93,0.15)] scale-[1.02]'
                                    : 'border-zinc-300 hover:border-[#B8985D] hover:bg-zinc-50 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)]'
                                }`}
                            >

                                {file ? (
                                    <>
                                        {/* Nút xóa file */}
                                        <button
                                            onClick={handleRemoveFile}
                                            className="absolute top-5 right-5 p-2 rounded-full bg-white hover:bg-red-50 hover:text-red-500 text-zinc-400 transition-all z-20 border border-zinc-200 hover:border-red-200 shadow-sm"
                                            title="Xóa file"
                                        >
                                            <XMarkIcon className="w-5 h-5 stroke-2" />
                                        </button>

                                        {/* Hiển thị file đã chọn */}
                                        <div className="text-[#B8985D] flex flex-col items-center gap-3">
                                            <div className="relative">
                                                <DocumentTextIcon className="w-16 h-16 animate-pulse" />
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#B8985D] rounded-full blur-sm animate-ping"></div>
                                            </div>
                                            <span className="text-[#1A2530] font-bold break-all px-4 tracking-wide">{file.name}</span>
                                            <span className="text-[#B8985D]/80 text-[10px] uppercase font-black tracking-widest">Sẵn sàng phân tích</span>
                                        </div>
                                    </>
                                ) : (
                                    /* Trạng thái chờ upload */
                                    <div className="flex flex-col items-center cursor-pointer">
                                        <CloudArrowUpIcon className="w-14 h-14 mb-4 text-zinc-300 group-hover:text-[#B8985D] group-hover:scale-110 transition-all duration-300 stroke-1" />
                                        <span className="text-[14px] text-zinc-500 group-hover:text-[#1A2530] uppercase tracking-[0.2em] font-black transition-colors">
                                            Tải lên tài liệu pháp lý
                                        </span>
                                        <span className="text-[12px] text-zinc-400 mt-2 font-medium">Hỗ trợ PDF, DOCX </span>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* LOGIC NÚT BẤM CỘT TRÁI */}
                        {isAnalyzing ? (
                            <button
                                onClick={handleCancelAnalysis}
                                className="w-fit px-8 py-2 mx-auto rounded-xl font-bold text-[12px] text-red-600 flex items-center justify-center gap-2 tracking-wider bg-red-50 border border-red-200 hover:bg-red-100 transition-all backdrop-blur-md group"
                            >
                                <StopIcon className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform stroke-2" />
                                <span>DỪNG PHÂN TÍCH</span>
                            </button>
                        ) : result ? (
                            <button onClick={() => { setFile(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="w-fit px-8 py-2 mx-auto rounded-xl border border-zinc-300 hover:border-[#B8985D] hover:bg-[#B8985D]/5 text-[#1A2530] hover:text-[#B8985D] font-bold text-[12px] flex items-center justify-center gap-2 transition-all shadow-sm">
                                <ArrowPathIcon className="w-4 h-4 stroke-2" /> PHÂN TÍCH VĂN BẢN KHÁC
                            </button>
                        ) : file && (
                            <button
                                onClick={handleAnalyze}
                                disabled={!file}
                                className={`w-fit px-10 py-2.5 mx-auto rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 tracking-wider transition-all shadow-md
        ${!file
                                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                        : 'bg-[#1A2530] text-white hover:bg-[#B8985D] hover:scale-105 active:scale-95 border border-transparent shadow-[0_10px_20px_rgba(26,37,48,0.2)]'
                                    }
    `}
                            >
                                <ShieldCheckIcon className="w-4 h-4 stroke-2" />
                                <span>THẨM ĐỊNH NGAY</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 🔵 CỘT PHẢI - KẾT QUẢ PHÂN TÍCH */}
                <div className="w-full md:w-7/12 relative min-h-[400px]">
                    {result && !isAnalyzing && (
                        <div className="animate-slideUp bg-white backdrop-blur-xl border border-zinc-200 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
                            {/* Header kết quả */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 bg-[#B8985D] rounded-full"></div>
                                    <h3 className="text-lg font-black text-[#1A2530] uppercase tracking-wider">Kết quả phân tích</h3>
                                </div>

                                <button
                                    onClick={handleSaveToHistory}
                                    disabled={isSaving || isSaved}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${isSaving || isSaved
                                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white shadow-sm'
                                        }`}
                                >
                                    {isSaving ? (
                                        <ArrowPathIcon className="w-4 h-4 animate-spin stroke-2" />
                                    ) : isSaved ? (
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-500 stroke-2" />
                                    ) : (
                                        <CheckBadgeIcon className="w-4 h-4 stroke-2" />
                                    )}
                                    {isSaving ? "ĐANG LƯU..." : isSaved ? "ĐÃ LƯU VÀO HỒ SƠ" : "LƯU VÀO HỒ SƠ"}
                                </button>
                            </div>

                            {/* Biểu đồ & Đánh giá */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-zinc-100 pb-8">
                                <div className="relative w-40 h-40 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        {/* Điểm an toàn: Xanh lá nếu >= 80, Đỏ nếu thấp hơn */}
                                        <span className={`text-4xl font-black ${(result.risk_score ?? 0) >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{result.risk_score ?? 0}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase font-bold mt-1">Điểm an toàn</span>
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <h3 className="text-lg font-bold text-[#1A2530] mb-2">Đánh giá tổng quan</h3>
                                    <p className="text-zinc-600 text-sm leading-relaxed font-medium">{result.summary ?? "Đang cập nhật..."}</p>
                                </div>
                            </div>

                            {/* Danh sách phân tích rủi ro */}
                            <div className="space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                {result.analysis_report?.map((risk, index) => {
                                    const level = risk.severity ? risk.severity.toLowerCase() : 'advisory';

                                    return (
                                        <div
                                            key={index}
                                            // Chuyển màu nền thẻ sang các tông Pastel chuẩn Light Mode
                                            className={`border rounded-2xl p-5 transition-all duration-300 bg-white shadow-sm hover:shadow-md ${level === 'dangerous'
                                                ? 'border-red-200 hover:border-red-300'
                                                : level === 'high risk' || level === 'high'
                                                    ? 'border-orange-200 hover:border-orange-300'
                                                    : 'border-amber-200 hover:border-amber-300'
                                                }`}
                                        >
                                            {/* Header thẻ */}
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-[#1A2530] bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                                                    {risk.pillar}
                                                </span>
                                                {getSeverityBadge(risk.severity)}
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                {/* Trích dẫn điều khoản */}
                                                <div className="bg-zinc-50 border-l-4 border-zinc-300 text-zinc-600 px-4 py-3 rounded-r-xl text-xs font-mono italic">
                                                    "{risk.clause}"
                                                </div>

                                                {/* Vấn đề */}
                                                <div className="space-y-2">
                                                    <p className="text-zinc-700 text-sm leading-relaxed font-medium">
                                                        <span className={`${level === 'dangerous' ? 'text-red-600' : level.includes('high') ? 'text-orange-600' : 'text-amber-600'} font-bold flex items-center gap-1.5 mb-1`}>
                                                            <ShieldExclamationIcon className="w-4 h-4 stroke-2" /> Phân tích rủi ro:
                                                        </span>
                                                        {risk.issue}
                                                    </p>

                                                    {/* Căn cứ pháp lý */}
                                                    {risk.legal_basis && risk.legal_basis.law && (
                                                        <p className="text-xs text-zinc-500 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 mt-2">
                                                            ⚖️ <span className="font-bold text-zinc-700">Căn cứ:</span> {risk.legal_basis.law}
                                                            {risk.legal_basis.article ? ` (Điều ${risk.legal_basis.article})` : ''}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Đề xuất sửa đổi */}
                                                {risk.solution && (
                                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-1">
                                                        <p className="text-emerald-800 text-sm leading-relaxed font-medium">
                                                            <span className="text-emerald-600 font-bold flex items-center gap-1.5 mb-1.5">
                                                                <CheckBadgeIcon className="w-4 h-4 stroke-2" /> Đề xuất sửa đổi:
                                                            </span>
                                                            {risk.solution}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}