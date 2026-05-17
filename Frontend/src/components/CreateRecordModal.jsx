import React, { useState, useCallback } from 'react';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';

export default function CreateRecordModal({ isOpen, onClose, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) setFile(droppedFile);
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleUpload = () => {
        if (!file || !title) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng chọn file và nhập tiêu đề hồ sơ!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }

        const newRecord = {
            id: Date.now(),
            name: title,
            file: file.name,
            description: description,
            date: new Date().toLocaleDateString('vi-VN')
        };

        onUploadSuccess(newRecord);
        handleResetAndClose();
    };

    const handleResetAndClose = () => {
        setFile(null);
        setTitle("");
        setDescription("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden relative">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Tạo mới hồ sơ pháp lí</h2>
                    <button onClick={handleResetAndClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                            }`}
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        <input
                            id="fileInput"
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mb-4" />
                        <p className="text-gray-600 font-medium">
                            {file ? `Đã chọn: ${file.name}` : "Kéo thả file vào đây hoặc nhấp để chọn file"}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block font-bold text-gray-700">Tiêu đề</label>
                        <input
                            type="text"
                            placeholder="Nhập tiêu đề hồ sơ"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block font-bold text-gray-700">Mô tả</label>
                        <textarea
                            rows="3"
                            placeholder="Nhập mô tả hồ sơ"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            onClick={handleResetAndClose}
                            className="px-8 py-2.5 bg-gray-200 text-gray-700 rounded-md font-bold hover:bg-gray-300 transition"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleUpload}
                            className="px-8 py-2.5 bg-[#5e72e4] text-white rounded-md font-bold hover:bg-blue-700 shadow-md transition"
                        >
                            Tải lên
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}