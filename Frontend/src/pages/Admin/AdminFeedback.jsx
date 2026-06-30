import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { MessageSquare, Star, ChevronRight, Mail } from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
import { API_URL } from '../../config/api';

const backendBase = API_URL;

const typeColors = {
    'Báo lỗi': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Góp ý': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Khen ngợi': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'Khác': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
};

const statusConfig = {
    'Pending': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Chưa xử lý' },
    'Processing': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Đang xử lý' },
    'Resolved': { bg: 'bg-green-100', text: 'text-green-700', label: 'Đã xử lý' }
};

export default function AdminFeedback() {
    const [feedbacks, setFeedbacks] = useState([]);
    const [filteredFeedbacks, setFilteredFeedbacks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);

    const filterOptions = [
        { id: 'all', label: 'Tất cả', type: null },
        { id: 'bug', label: 'Báo lỗi', type: 'Báo lỗi' },
        { id: 'suggestion', label: 'Góp ý', type: 'Góp ý' },
        { id: 'praise', label: 'Khen ngợi', type: 'Khen ngợi' }
    ];

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    useEffect(() => {
        filterFeedbacks();
    }, [selectedFilter, feedbacks]);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/feedback`, { headers });

            if (res.data?.success) {
                setFeedbacks(res.data.data || []);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: res.data?.message || 'Không thể tải danh sách phản hồi',
                    confirmButtonColor: '#B8985D',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2500
                });
            }
        } catch (error) {
            console.error('Lỗi khi tải phản hồi:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi Server',
                text: error.response?.data?.message || 'Không thể tải dữ liệu',
                confirmButtonColor: '#B8985D',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } finally {
            setLoading(false);
        }
    };

    const filterFeedbacks = () => {
        const selectedOption = filterOptions.find(opt => opt.id === selectedFilter);
        if (selectedOption.type === null) {
            setFilteredFeedbacks(feedbacks);
        } else {
            setFilteredFeedbacks(feedbacks.filter(fb => fb.type === selectedOption.type));
        }
    };

    const getFilterCount = (type) => {
        if (type === null) return feedbacks.length;
        return feedbacks.filter(fb => fb.type === type).length;
    };

    const handleStatusChange = async (feedbackId, newStatus) => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.put(
                `${backendBase}/admin/feedback/status`,
                { id: feedbackId, status: newStatus },
                { headers }
            );

            if (res.data?.success) {
                setFeedbacks(prev =>
                    prev.map(fb =>
                        fb.id === feedbackId ? { ...fb, status: newStatus } : fb
                    )
                );
                Swal.fire({
                    icon: 'success',
                    title: 'Đã cập nhật trạng thái',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        } catch (error) {
            console.error('Lỗi cập nhật trạng thái:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể cập nhật trạng thái',
                confirmButtonColor: '#B8985D',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        }
    };

    const handleReply = async (feedback) => {
        const { value: replyContent } = await Swal.fire({
            title: 'Trả lời phản hồi',
            input: 'textarea',
            inputLabel: `Phản hồi từ: ${feedback.name} (${feedback.email})`,
            inputPlaceholder: 'Nhập nội dung trả lời...',
            inputAttributes: {
                'aria-label': 'Nội dung trả lời',
                'style': 'min-height: 150px; padding: 10px;'
            },
            confirmButtonColor: '#B8985D',
            confirmButtonText: 'Gửi Email',
            cancelButtonText: 'Hủy',
            showCancelButton: true,
            didOpen: (modal) => {
                const textarea = modal.querySelector('textarea');
                if (textarea) {
                    textarea.style.fontFamily = 'inherit';
                    textarea.style.resize = 'vertical';
                }
            }
        });

        if (!replyContent) return;

        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(
                `${backendBase}/admin/feedback/reply`,
                { id: feedback.id, replyContent },
                { headers }
            );

            if (res.data?.success) {
                setFeedbacks(prev =>
                    prev.map(fb =>
                        fb.id === feedback.id
                            ? { ...fb, replyContent, status: 'Resolved' }
                            : fb
                    )
                );
                Swal.fire({
                    icon: 'success',
                    title: 'Gửi Email Thành Công!',
                    text: `Email đã được gửi tới ${feedback.email}`,
                    confirmButtonColor: '#B8985D',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2500
                });
            }
        } catch (error) {
            console.error('Lỗi gửi email:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi Gửi Email',
                text: error.response?.data?.message || 'Không thể gửi email trả lời',
                confirmButtonColor: '#B8985D',
                confirmButtonText: 'Đóng'
            });
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">
            {/* SIDEBAR */}
            <AdminSidebar />

            {/* NỘI DUNG CHÍNH */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {/* HEADER */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Quản lý Phản hồi</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Theo dõi và trả lời phản hồi từ người dùng</p>
                    </div>
                    <button
                        onClick={fetchFeedbacks}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all disabled:opacity-50 font-bold text-xs uppercase tracking-widest"
                    >
                        ⟲ Tải lại
                    </button>
                </header>

                {/* FILTER TAGS */}
                <div className="flex gap-3 mb-8 flex-wrap">
                    {filterOptions.map(option => {
                        const count = getFilterCount(option.type);
                        return (
                            <button
                                key={option.id}
                                onClick={() => setSelectedFilter(option.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all ${selectedFilter === option.id
                                    ? 'bg-amber-500 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <span>{option.label}</span>
                                <span className="bg-black/20 px-2 py-0.5 rounded-full text-[10px]">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* FEEDBACKS CONTAINER - FIXED SCROLL */}
                <div className="h-[580px] overflow-y-auto custom-scrollbar space-y-4 pr-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="inline-block animate-spin mb-3">
                                    <div className="w-12 h-12 border-4 border-gray-200 border-t-amber-500 rounded-full"></div>
                                </div>
                                <p className="text-gray-500 font-bold">Đang tải phản hồi...</p>
                            </div>
                        </div>
                    ) : filteredFeedbacks.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-3 opacity-50" />
                                <p className="text-gray-500 font-bold">Không có phản hồi nào</p>
                                <p className="text-gray-400 text-sm">Khách hàng chưa gửi phản hồi</p>
                            </div>
                        </div>
                    ) : (
                        filteredFeedbacks.map(feedback => {
                            const typeStyle = typeColors[feedback.type] || typeColors['Khác'];
                            const statusStyle = statusConfig[feedback.status] || statusConfig['Pending'];
                            const isExpanded = expandedId === feedback.id;

                            return (
                                <div
                                    key={feedback.id}
                                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : feedback.id)}
                                >
                                    {/* ROW 1: Header Info */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">
                                                {feedback.name}
                                            </h3>
                                            <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                <Mail className="w-3 h-3" />
                                                {feedback.email}
                                            </p>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex items-center gap-2">
                                            {/* Type Badge */}
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border} border`}>
                                                {feedback.type}
                                            </span>

                                            {/* Status Badge Dropdown */}
                                            <div className="relative group">
                                                <button
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusStyle.bg} ${statusStyle.text} border border-transparent hover:border-gray-300 transition-all`}
                                                >
                                                    {statusStyle.label}
                                                </button>

                                                {/* Dropdown menu */}
                                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
                                                    {Object.entries(statusConfig).map(([key, config]) => (
                                                        <button
                                                            key={key}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusChange(feedback.id, key);
                                                            }}
                                                            className={`block w-full text-left px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${config.text} hover:bg-gray-50 whitespace-nowrap`}
                                                        >
                                                            {config.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ROW 2: Rating + Time */}
                                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                                        {/* Stars */}
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star
                                                    key={star}
                                                    className={`w-4 h-4 ${feedback.rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                                />
                                            ))}
                                        </div>

                                        {/* Time */}
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                                            {formatDate(feedback.createdAt)}
                                        </span>
                                    </div>

                                    {/* ROW 3: Content Preview */}
                                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                                        {feedback.content}
                                    </p>

                                    {/* EXPANDED CONTENT */}
                                    {isExpanded && (
                                        <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200 space-y-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                                                    Nội dung đầy đủ
                                                </p>
                                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                                    {feedback.content}
                                                </p>
                                            </div>

                                            {feedback.replyContent && (
                                                <div className="border-t pt-3">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                                                        Trả lời của Admin
                                                    </p>
                                                    <p className="text-sm text-green-800 bg-green-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap break-words">
                                                        {feedback.replyContent}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ROW 4: Action Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleReply(feedback);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all active:scale-95"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Phản hồi
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* STATS FOOTER */}
                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest">
                    <span>Tổng: {feedbacks.length} phản hồi</span>
                    <span>|</span>
                    <span>Hiển thị: {filteredFeedbacks.length} phản hồi</span>
                </div>
            </main>
        </div>
    );
}
