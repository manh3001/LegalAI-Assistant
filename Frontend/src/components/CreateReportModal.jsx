import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';

export default function CreateReportModal({ isOpen, onClose }) {
    const [reportName, setReportName] = useState("");

    const handleSave = (e) => {
        e.preventDefault();
        if (!reportName.trim()) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng nhập tên báo cáo!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }

        console.log("Đang tạo báo cáo:", reportName);
        Swal.fire({ icon: 'success', title: `Đã tạo báo cáo "${reportName}" thành công!`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        setReportName("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-purple-200 overflow-hidden animate-fadeIn">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Tạo báo cáo</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                        title="Đóng"
                    >
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-8 flex flex-col items-center">
                    <div className="w-full max-w-sm space-y-2">
                        <label className="text-sm font-semibold text-slate-600 ml-1">
                            Tên báo cáo
                        </label>
                        <input
                            type="text"
                            value={reportName}
                            required
                            placeholder="Nhập tên báo cáo..."
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            onChange={(e) => setReportName(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="bg-[#7ed321] hover:bg-[#6db91b] text-white px-10 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
                    >
                        Lưu
                    </button>
                </form>
            </div>
        </div>
    );
}