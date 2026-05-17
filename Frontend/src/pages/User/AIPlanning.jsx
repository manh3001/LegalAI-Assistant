import React, { useState, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import pptxgen from 'pptxgenjs';
import usePersistedState from '../../hooks/usePersistedState';
import {
    DocumentChartBarIcon,
    PlayIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    PresentationChartBarIcon,
    Bars3BottomLeftIcon,
    ClockIcon,
    UserCircleIcon,
    PaperClipIcon,
    DocumentIcon,
    XMarkIcon,
    ScaleIcon,
    PrinterIcon,
    EllipsisVerticalIcon,
    DocumentTextIcon,
    DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

import aiClient from "../../api/aiClient";

export default function AIPlanning() {
    const [rawText, setRawText] = usePersistedState('legai_plan_raw_text', '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [planData, setPlanData] = usePersistedState('legai_plan_data', null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };
    const handleFileSelect = (e) => {
        if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files)]);
    };
    const removeFile = (indexToRemove) => {
        setAttachedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };
    // hàm reset toàn bộ kế hoạch để tạo mới
    const showToast = (message, icon = 'info') => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon,
            title: message,
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
            background: '#ffffff',
            color: '#1A2530',
            customClass: { popup: 'shadow-xl' }
        });
    };

    const handleNewPlan = () => {
        Swal.fire({
            title: 'Kế hoạch hiện tại sẽ bị xóa (nếu chưa Lưu hồ sơ). Bạn có chắc muốn tạo mới?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xác nhận',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#B8985D',
            cancelButtonColor: '#ef4444',
            color: '#1A2530'
        }).then((result) => {
            if (result.isConfirmed) {
                setRawText('');
                setPlanData(null);
                setAttachedFiles([]);
                setIsSaved(false);
            }
        });
    };

    const handleDownloadWord = () => {
        setIsActionMenuOpen(false);

        if (!planData || !Array.isArray(planData) || planData.length === 0) {
            showToast('Không có dữ liệu để xuất file Word.', 'warning');
            return;
        }

        const grouped = planData.reduce((acc, task) => {
            const phaseName = task.phase || 'Giai đoạn khác';
            if (!acc[phaseName]) acc[phaseName] = [];
            acc[phaseName].push(task);
            return acc;
        }, {});

        let htmlString = `<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>`;
        htmlString += `<h1>KẾ HOẠCH HÀNH ĐỘNG PHÁP LÝ</h1>`;

        Object.keys(grouped).forEach((phaseName) => {
            htmlString += `<h2>${phaseName}</h2>`;
            htmlString += '<ul>';
            grouped[phaseName].forEach((task) => {
                const title = task.title || 'Không có tên task';
                const assignee = task.assignee || 'Chưa phân công';
                const deadline = task.deadline || 'Không có hạn';
                const notes = task.legal_notes || task.description || 'Không có lưu ý';
                htmlString += `<li>${title} | Phụ trách: ${assignee} | Hạn: ${deadline} | Lưu ý: ${notes}</li>`;
            });
            htmlString += '</ul>';
        });

        htmlString += '</body></html>';

        const blob = new Blob(['\ufeff', htmlString], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'KeHoach_LegAI.doc';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Đã tải file Word thành công!', 'success');
    };

    const handleGenerateSlide = () => {
        setIsActionMenuOpen(false);

        if (!tasks || tasks.length === 0) {
            showToast("Không có dữ liệu để tạo slide.", "warning");
            return;
        }

        const grouped = tasks.reduce((acc, task) => {
            const phase = task.phase || "Chưa phân loại";
            if (!acc[phase]) acc[phase] = [];
            acc[phase].push(task);
            return acc;
        }, {});

        const pres = new pptxgen();
        let slide = pres.addSlide();
        slide.addText("KẾ HOẠCH THỰC THI PHÁP LÝ", {
            x: 0.5,
            y: 1.5,
            w: "90%",
            align: "center",
            bold: true,
            fontSize: 32,
        });
        slide.addText("Tạo tự động bởi LegAI", {
            x: 0.5,
            y: 3,
            w: "90%",
            align: "center",
            italic: true,
            fontSize: 18,
            color: "666666",
        });

        Object.keys(grouped).forEach((phaseName) => {
            slide = pres.addSlide();
            slide.addText(phaseName, {
                x: 0.5,
                y: 0.5,
                w: "90%",
                fontSize: 28,
                bold: true,
                color: "1A2530",
            });

            // mảng Object chứa 'text' và 'options'
            const items = grouped[phaseName].map((task) => {
                const title = task.title || 'Không có tên task';
                const assignee = task.assignee || 'Chưa phân công';
                const deadline = task.deadline || 'Không có hạn';

                return {
                    text: `${title} – ${assignee} – ${deadline}`,
                    options: { bullet: true, breakLine: true }
                };
            });


            slide.addText(items, {
                x: 0.5,
                y: 1.5,
                w: "90%",
                fontSize: 16,
                color: "333333",
                margin: 0.1,
                lineSpacing: 20
            });
        });

        pres.writeFile({ fileName: "Slide_KeHoach_LegAI.pptx" })
            .then(() => {
                showToast("Đã tạo file Slide thành công!", "success");
            })
            .catch((error) => {
                console.error("Error generating PPTX:", error);
                showToast("Không thể tạo slide. Vui lòng thử lại.", "error");
            });
    };

    const handleAnalyze = async () => {
        // 1. Kiểm tra đầu vào
        if (!rawText.trim() && attachedFiles.length === 0) {
            showToast('Vui lòng nhập yêu cầu!', 'warning'); return;
        }

        // 2. Lấy Token
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

        setIsProcessing(true);
        setPlanData(null);
        setProgress(1);

        try {
            const formData = new FormData();
            formData.append('prompt', rawText); // Thống nhất dùng 'prompt'
            attachedFiles.forEach(file => formData.append('files', file));

            const result = await aiClient.generatePlan(formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log("Kết quả từ Backend:", result);

            //  Backend trả về result.data
            if (result && result.success && result.data) {
                let finalArray = Array.isArray(result.data) ? result.data : [];

                if (finalArray.length > 0) {
                    const processedData = finalArray.map(item => ({
                        ...item,
                        status: item.status || 'pending'
                    }));
                    setPlanData(processedData);
                    setProgress(3);
                } else {
                    showToast('AI không tạo được danh sách công việc. Hãy thử lại!', 'warning');
                    setProgress(0);
                }
            }
        } catch (error) {
            console.error(" Lỗi kết nối server:", error.message);
            showToast('Server đang bận hoặc bị sập. hãy kiểm tra lại Terminal Backend!', 'error');
            setProgress(0);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToHistory = async () => {
        if (!planData) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 3 };
            const userId = user.id ?? user.Id ?? user.ID;

            const payload = {
                userId: userId,
                fileName: `Plan_${Date.now()}.json`,
                title: `Lập kế hoạch: ${rawText.substring(0, 40) || 'Tài liệu đính kèm'}...`,
                recordType: 'PLANNING',
                content: JSON.stringify(planData)
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                showToast('Đã lưu Kế hoạch thành công!', 'success');
            }
        } catch (err) {
            console.error("Lỗi lưu:", err);
            showToast('Lỗi lưu trữ Database.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    //  return giao diện
    const groupedPlan = planData?.reduce((acc, task) => {
        const phaseName = task.phase || 'Giai đoạn khác';
        if (!acc[phaseName]) {
            acc[phaseName] = [];
        }
        acc[phaseName].push(task);
        return acc;
    }, {});
    const handlePrint = () => window.print();

    // Đổi biến giao diện sang chuẩn Light Mode
    const lightPanel = "bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl";

    return (
        // Đổi màu text mặc định sang Đen Than và Selection màu Vàng Đồng
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col lg:flex-row gap-6 text-[#1A2530] selection:bg-[#B8985D]/30 selection:text-[#1A2530]">

            {/* ========================================================= */}
            {/* CỘT TRÁI: NHẬP LIỆU */}
            {/* ========================================================= */}
            <div className={`w-full lg:w-[450px] flex flex-col h-full ${lightPanel} overflow-hidden flex-shrink-0 print:hidden`}>

                {/* HEADER */}
                <div className="p-5 border-b border-zinc-200 bg-zinc-50 flex items-center gap-3 flex-shrink-0">
                    <div className="p-2 bg-[#B8985D]/10 rounded-xl border border-[#B8985D]/20">
                        <DocumentChartBarIcon className="w-6 h-6 text-[#8E6D45] stroke-2" />
                    </div>
                    <div>
                        <h2 className="font-black text-lg text-[#1A2530]">Dữ liệu đầu vào</h2>
                        <p className="text-xs text-zinc-500 font-medium">Agent sẽ lập kế hoạch từ đây</p>
                    </div>
                </div>
                {/* NÚT TẠO MỚI */}
                <button
                    onClick={handleNewPlan}
                    title="Làm sạch để tạo kế hoạch mới"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-[#B8985D] hover:bg-[#B8985D]/10 transition-colors"
                >
                    <ArrowPathIcon className="w-4 h-4 stroke-2" />
                    TẠO MỚI
                </button>
                {/* KHU VỰC NHẬP LIỆU */}
                <div className="flex-1 p-5 flex flex-col min-h-0 bg-white">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex-1 flex flex-col rounded-2xl border-2 transition-all bg-zinc-50 overflow-hidden ${isDragging
                            ? 'border-dashed border-[#B8985D] bg-[#B8985D]/5 scale-[1.01]'
                            : 'border-solid border-zinc-200 focus-within:border-[#B8985D]/50 focus-within:bg-white focus-within:shadow-[0_0_15px_rgba(184,152,93,0.1)]'
                            }`}
                    >
                        {/* TEXTAREA */}
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Nhập yêu cầu chi tiết hoặc kéo thả tài liệu pháp lý vào đây..."
                            className="flex-1 w-full p-5 text-sm font-medium text-[#1A2530] bg-transparent focus:outline-none resize-none custom-scrollbar placeholder:text-zinc-400"
                        ></textarea>

                        {/* DANH SÁCH FILE ĐÍNH KÈM */}
                        {attachedFiles.length > 0 && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar border-t border-zinc-200 pt-3">
                                {attachedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white border border-zinc-200 shadow-sm px-3 py-1.5 rounded-lg text-[11px] font-bold">
                                        <DocumentIcon className="w-4 h-4 text-[#B8985D]" />
                                        <span className="max-w-[150px] truncate text-zinc-700">{file.name}</span>
                                        <button onClick={() => removeFile(index)}>
                                            <XMarkIcon className="w-4 h-4 text-zinc-400 hover:text-red-500 transition-colors" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* THANH CÔNG CỤ BOTTOM */}
                        <div className="flex justify-between items-center px-4 py-3 bg-zinc-50 border-t border-zinc-200">
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-[#B8985D] transition-colors"
                            >
                                <PaperClipIcon className="w-4 h-4 transform -rotate-45 stroke-2" />
                                Đính kèm tài liệu
                            </button>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.txt"
                            />
                            <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                                PDF / DOCX
                            </span>
                        </div>
                    </div>

                    {/* NÚT KHỞI CHẠY */}
                    <button
                        onClick={handleAnalyze}
                        disabled={isProcessing}
                        className={`mt-4 w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex justify-center items-center gap-3 ${isProcessing
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                            : 'bg-[#1A2530] text-white hover:bg-[#B8985D] shadow-md hover:shadow-lg active:scale-95'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin text-[#B8985D]" />
                                <span className="text-[#B8985D]">Đang trích xuất luật...</span>
                            </>
                        ) : (
                            <>
                                <PlayIcon className="w-5 h-5 stroke-2" />
                                <span>Khởi chạy Workflow</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* CỘT PHẢI: KẾT QUẢ KANBAN */}
            {/* ========================================================= */}
            <div className={`flex-1 flex flex-col h-full ${lightPanel} overflow-hidden relative print:bg-white print:text-black print:shadow-none print:border-none`}>

                {/* HEADER BẢN XEM TRƯỚC */}
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center px-6 print:hidden">
                    <div className="flex items-center gap-3 text-[#1A2530]">
                        <PresentationChartBarIcon className="w-5 h-5 text-[#B8985D] stroke-2" />
                        <span className="text-sm font-black uppercase tracking-widest">Lộ trình thực thi (Preview)</span>
                    </div>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsActionMenuOpen(prev => !prev)}
                            className="flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-200 bg-white text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors shadow-sm"
                        >
                            <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>

                        {isActionMenuOpen && (
                            <div className="absolute right-6 mt-12 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { setIsActionMenuOpen(false); handleSaveToHistory(); }}
                                    disabled={!planData || isSaving || isSaved}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] transition-colors ${!planData || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#B8985D]/10'}`}
                                >
                                    <CheckCircleIcon className="w-5 h-5" />
                                    Lưu Kế Hoạch
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadWord}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
                                >
                                    <DocumentTextIcon className="w-5 h-5" />
                                    Tải file Word (.docx)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsActionMenuOpen(false); handlePrint(); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
                                >
                                    <DocumentArrowDownIcon className="w-5 h-5" />
                                    Tải file PDF (.pdf)
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerateSlide}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
                                >
                                    <PresentationChartBarIcon className="w-5 h-5" />
                                    Tạo Slide (.pptx)
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-zinc-100/80 custom-scrollbar print:bg-white print:overflow-visible">
                    {(!planData || !Array.isArray(planData)) ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <DocumentChartBarIcon className="w-20 h-20 mb-4 text-zinc-400 stroke-1" />
                            <p className="text-lg font-bold text-zinc-500">
                                {!planData ? "Chưa có kế hoạch nào được khởi tạo" : "Lỗi: Dữ liệu AI trả về sai cấu trúc mảng"}
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-10 print:space-y-8">
                            <h2 className="hidden print:block text-2xl font-bold text-center mb-8 uppercase">Lộ trình giải quyết pháp lý</h2>

                            {groupedPlan && Object.keys(groupedPlan).map((phaseName, phaseIndex) => (
                                <div key={phaseIndex} className="phase-group">

                                    {/* TIÊU ĐỀ GIAI ĐOẠN */}
                                    <div className="py-3 mb-5 border-b-2 border-zinc-200 print:border-black">
                                        <h3 className="text-lg font-black uppercase tracking-wider text-[#1A2530] flex items-center gap-3">
                                            <span className="bg-[#B8985D]/10 text-[#8E6D45] border border-[#B8985D]/30 px-3 py-1 rounded-lg text-xs">Bước {phaseIndex + 1}</span>
                                            {phaseName}
                                        </h3>
                                    </div>

                                    {/* DANH SÁCH TASK TRONG GIAI ĐOẠN */}
                                    <div className="space-y-4 pl-2 md:pl-4 border-l-2 border-zinc-200 print:border-black/10">
                                        {groupedPlan[phaseName].map((task, index) => (
                                            <div key={task.id || index} className="p-6 rounded-2xl bg-white border border-zinc-200 hover:border-[#B8985D]/50 hover:shadow-md transition-all shadow-sm print:border-black/20 print:bg-white print:shadow-none">
                                                <h4 className="text-lg font-bold text-[#1A2530]">{task.title}</h4>

                                                {/* Ghi chú pháp lý */}
                                                {(task.legal_notes || task.description) && (
                                                    <div className="mt-4 text-sm text-zinc-600 font-medium leading-relaxed border-l-4 border-[#B8985D] pl-4 py-3 bg-amber-50/50 rounded-r-xl print:text-black">
                                                        <span className="font-bold text-[#8E6D45] flex items-center gap-1.5 mb-1.5">
                                                            <ScaleIcon className="w-4 h-4 stroke-2" /> Góc nhìn pháp lý:
                                                        </span>
                                                        {task.legal_notes || task.description}
                                                    </div>
                                                )}

                                                {/* Meta Info (Assignee, Deadline, Status) */}
                                                <div className="flex flex-wrap gap-5 mt-5 text-xs font-bold text-zinc-500">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircleIcon className="w-4 h-4 stroke-2 text-zinc-400" /> {task.assignee || "Chưa phân công"}
                                                    </div>


                                                    <div className="flex items-center gap-2 text-[#8E6D45]">
                                                        <ClockIcon className="w-4 h-4 stroke-2" /> {task.deadline || "N/A"}
                                                    </div>

                                                    {/* Bộ chuyển dịch Trạng thái (Status Translator) */}
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-black border ${task.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                            task.status?.toLowerCase() === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                                task.status?.toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                                    'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                            }`}>
                                                            {task.status?.toLowerCase() === 'pending' ? ' Chờ xử lý' :
                                                                task.status?.toLowerCase() === 'in_progress' ? ' Đang làm' :
                                                                    task.status?.toLowerCase() === 'completed' ? ' Đã xong' :
                                                                        task.status || "Chưa rõ"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                /* Tối ưu Thanh cuộn Light Mode */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(26, 37, 48, 0.15); border-radius: 10px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(184, 152, 93, 0.5); }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
                .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
                @media print {
                    .print\\:hidden { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
}