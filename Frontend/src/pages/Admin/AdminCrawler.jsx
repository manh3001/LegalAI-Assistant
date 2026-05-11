import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
    Database, Play, CloudDownload, CheckCircle, Clock,
    ShieldCheck, Scale, LayoutDashboard, Users, Activity, Settings, LogOut, User, FileText, BarChart2
} from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
export default function AdminCrawler() {
    const [isAutoCrawlEnabled, setIsAutoCrawlEnabled] = useState(false);
    const [crawlTime, setCrawlTime] = useState('02:00');
    const [urls, setUrls] = useState('');
    const [dailyLimit, setDailyLimit] = useState(50);
    const [keywordFilter, setKeywordFilter] = useState('/ban-an/');
    const navigate = useNavigate();
    const location = useLocation();
    const backendBase = 'http://localhost:8000/api';
    const [isManualCrawling, setIsManualCrawling] = useState(false);
    const [history, setHistory] = useState([]);


    // Fetch settings từ API
    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/crawler/settings`, { headers });

            // CONSOLE 
            console.log("Data từ API trả về:", res.data);

            if (res.data.success) {
                const data = res.data.data;

                //  Bọc lót cả hoa lẫn thường (SQL hay trả về viết hoa chữ cái đầu)
                setIsAutoCrawlEnabled(data.IsAutoCrawlOn ?? data.isAutoCrawlOn ?? false);
                setCrawlTime(data.CrawlTime || data.crawlTime || '02:00');
                setUrls(data.TargetUrls || data.targetUrls || '');
                setDailyLimit(data.DailyLimit || data.dailyLimit || 50);
                setKeywordFilter(data.FilterPatterns || data.filterPatterns || '/ban-an/');
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình crawler:', error);
        }
    };

    // Fetch lịch sử thu thập
    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/crawler/history`, { headers });

            if (res.data.success) {
                console.log(" Dữ liệu lịch sử mới đã cập nhật:", res.data.data[0]?.Title);
                setHistory(res.data.data || []);
            }
        } catch (error) {
            console.error('Lỗi khi tải lịch sử thu thập:', error);
            setHistory([]);
        }
    };
    useEffect(() => {
        fetchSettings();
        fetchHistory();
    }, []);
    useEffect(() => {

        // dùng URL gốc của Server
        const socket = io('http://localhost:8000');

        const handleProgress = (data) => {
            // Khi tiến trình (Auto hoặc Thủ công) báo cáo đã dừng và có kết quả
            if (data.isRunning === false && data.result) {
                // 1. Hiển thị Popup 
                showCrawlResult(data.result);

                // 2. Load lại bảng lịch sử mới nhất
                fetchHistory();

                // 3. Tắt trạng thái loading của nút 
                setIsManualCrawling(false);
            }
        };

        // Bật máy nghe
        socket.on('crawl-progress', handleProgress);

        // Tắt máy nghe khi chuyển sang trang khác 
        return () => {
            socket.off('crawl-progress', handleProgress);
            socket.disconnect(); // 👉 BƯỚC 2: Ngắt hẳn kết nối socket để dọn dẹp bộ nhớ RAM
        };
    }, []); // Hook này chỉ chạy 1 lần khi mở trang
    const handleSaveConfig = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const data = {
                isAutoCrawlOn: isAutoCrawlEnabled,
                crawlTime: crawlTime,
                targetUrls: urls,
                dailyLimit: parseInt(dailyLimit),
                filterPatterns: keywordFilter
            };
            const res = await axios.put(`${backendBase}/admin/crawler/settings`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // Thay alert bằng toast
                toast.success('Cấu hình đã được lưu thành công!');
            } else {
                toast.error(`Lỗi: ${res.data.message}`);
            }
        } catch (error) {
            console.error('Lỗi khi lưu cấu hình:', error);
            toast.error(`Lỗi server: ${error.response?.data?.message || error.message}`);
        }
    };

    // Hàm showCrawlResult hiển thị kết quả thu thập sau khi chạy thủ công
    const showCrawlResult = (result) => {
        if (!result) return;
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-5 border border-gray-100`}>
                <h3 className="font-bold text-gray-900 mb-3 uppercase tracking-wider text-sm border-b pb-2">Báo Cáo Thu Thập</h3>
                <div className="space-y-2 text-sm">
                    <p className="flex justify-between text-green-600 font-medium">
                        <span>✅ Thành công:</span> <span>{result.successCount || 0} văn bản</span>
                    </p>
                    <p className="flex justify-between text-amber-500 font-medium">
                        <span>⚠️ Trùng lặp (Bỏ qua):</span> <span>{result.duplicateCount || 0} văn bản</span>
                    </p>
                    <p className="flex justify-between text-red-500 font-medium">
                        <span>❌ Lỗi / Bị chặn:</span> <span>{result.failCount || 0} văn bản</span>
                    </p>
                </div>
            </div>
        ), { duration: 5000 });
    };

    // 2. Hàm xử lý Cào Thủ Công
    const handleManualCrawl = async () => {
        const urlArray = urls
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (urlArray.length === 0) {

            toast.error('Vui lòng nhập ít nhất một URL để thu thập.');
            return;
        }

        if (urlArray.length > 5) {

            toast.error('Chỉ được thu thập tối đa 5 URLs mỗi lần.');
            return;
        }

        setIsManualCrawling(true);

        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(`${backendBase}/admin/crawler/run-manual`, { urls: urlArray }, { headers });

            if (res.data?.success) {
                const { successCount, duplicateCount, failCount } = res.data;

                //  GỌI POPUP  
                showCrawlResult({ successCount, duplicateCount, failCount });

                fetchHistory(); // Cập nhật lịch sử ngay lập tức
            } else {
                toast.error(`Lỗi: ${res.data?.message || 'Không thể thu thập dữ liệu.'}`);
            }
        } catch (error) {
            console.error('Lỗi khi chạy thu thập thủ công:', error);
            toast.error(`Có lỗi: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsManualCrawling(false);
        }
    };
    const glassClass = 'bg-white/80 backdrop-blur-xl border border-amber-200 shadow-2xl overflow-hidden';

    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">
            {/* Toaster để hiển thị kết quả thu thập */}
            <Toaster position="top-right" />
            {/*  SIDEBAR ADMIN  */}
            <AdminSidebar />

            {/* 🔵 MAIN CONTENT */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">

                {/* HEADER */}
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Trình Thu Thập Dữ Liệu</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Tự Động & Thủ Công Thu Thập Văn Bản Pháp Luật</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Trạng thái Hệ thống</span>
                            <span className="text-xs text-gray-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                                Trình Thu Thập Sẵn Sàng
                            </span>
                        </div>
                    </div>
                </header>

                {/* --- KHU VỰC 1: BẢNG ĐIỀU KHIỂN TỔNG HỢP (GỘP AUTO & MANUAL) --- */}
                <div className={`${glassClass} rounded-3xl p-8 mb-10`}>

                    {/* Header Box & Toggle Auto */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider">Bảng Điều Khiển & Cấu Hình</h2>
                            <p className="text-xs text-gray-500 mt-1">Quản lý danh sách URL đích và thiết lập tiến trình bóc tách dữ liệu</p>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 mt-4 sm:mt-0">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Thu Thập Tự Động</span>
                            <button
                                onClick={() => setIsAutoCrawlEnabled(!isAutoCrawlEnabled)}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 ease-in-out ${isAutoCrawlEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${isAutoCrawlEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Nội dung Cấu hình */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Cột trái (Chiếm 2/3): Danh sách URL */}
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">Danh Sách URLs Đích (Mỗi Link 1 Dòng)</label>
                            <textarea
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                placeholder="https://thuvienphapluat.vn/van-ban/..."
                                rows={7}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-5 py-4 rounded-2xl outline-none focus:border-amber-500 focus:bg-white transition-all text-sm resize-none font-mono leading-relaxed"
                            />
                        </div>

                        {/* Cột phải (Chiếm 1/3): Các thông số */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">Giờ Chạy Hàng Ngày</label>
                                <input
                                    type="time"
                                    value={crawlTime}
                                    onChange={(e) => setCrawlTime(e.target.value)}
                                    disabled={!isAutoCrawlEnabled}
                                    className={`w-full border border-gray-200 text-gray-900 px-5 py-4 rounded-2xl outline-none focus:border-amber-500 transition-all text-sm ${!isAutoCrawlEnabled ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-gray-50 focus:bg-white'}`}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">Giới Hạn / Ngày</label>
                                    <input
                                        type="number"
                                        value={dailyLimit}
                                        onChange={(e) => setDailyLimit(e.target.value)}
                                        min="1" max="1000"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-5 py-4 rounded-2xl outline-none focus:border-amber-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">Từ Khóa Ưu Tiên</label>
                                    <input
                                        type="text"
                                        value={keywordFilter}
                                        onChange={(e) => setKeywordFilter(e.target.value)}
                                        placeholder="/ban-an/"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-5 py-4 rounded-2xl outline-none focus:border-amber-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Thanh Công Cụ (Action Bar) */}
                    <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-gray-500 leading-relaxed hidden md:block max-w-lg">
                            <span className="font-bold text-amber-600">Lưu ý:</span> Quá trình thu thập thủ công có thể mất vài phút. Trình duyệt không cần phải mở trong quá trình thu thập tự động.
                        </p>

                        <div className="flex w-full md:w-auto items-center gap-3">
                            {/* Nút Lưu Cấu Hình Tự Động */}
                            <button
                                onClick={handleSaveConfig}
                                className="flex-1 md:flex-none bg-white border-2 border-amber-500 text-amber-600 font-bold py-3 px-8 rounded-xl hover:bg-amber-50 transition-all uppercase text-sm tracking-wider whitespace-nowrap"
                            >
                                Lưu Cấu Hình
                            </button>

                            {/* Nút Chạy Thủ Công */}
                            <button
                                onClick={handleManualCrawl}
                                disabled={isManualCrawling}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-8 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-amber-500/25 uppercase text-sm tracking-wider whitespace-nowrap ${isManualCrawling ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isManualCrawling ? (
                                    <>
                                        <Clock className="w-5 h-5 animate-spin-slow" /> Đang Thu Thập...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5" /> Chạy Ngay
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- KHU VỰC 2: LỊCH SỬ THU THẬP GẦN ĐÂY --- */}
                <div className={`${glassClass} rounded-3xl p-8`}>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-6">Lịch Sử Thu Thập Gần Đây</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b-2 border-gray-100">
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">ID</th>
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">Số Hiệu</th>
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">Tiêu Đề Văn Bản</th>
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">Nguồn</th>
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">Thời Gian</th>
                                    <th className="text-xs font-bold text-gray-400 uppercase py-4 px-4 tracking-wider">Trạng Thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!history || history.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                                            Chưa có dữ liệu thu thập nào trong hệ thống
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((item) => {
                                        const createdAt = new Date(item.CreatedAt);
                                        const timeStr = createdAt.getHours().toString().padStart(2, '0') + ":" +
                                            createdAt.getMinutes().toString().padStart(2, '0');

                                        const shortTitle = item.Title.length > 50 ? item.Title.substring(0, 50) + '...' : item.Title;

                                        return (
                                            <motion.tr
                                                key={item.Id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors"
                                            >
                                                {/* ID */}
                                                <td className="py-5 px-4 text-[10px] text-gray-400 font-mono">
                                                    {item.Id}
                                                </td>

                                                {/* SỐ HIỆU */}
                                                <td className="py-5 px-4 text-sm text-amber-600 font-black">
                                                    {item.DocumentNumber && item.DocumentNumber !== "-"
                                                        ? item.DocumentNumber
                                                        : "Đang cập nhật"}
                                                </td>

                                                {/* TIÊU ĐỀ */}
                                                <td className="py-5 px-4 text-sm text-gray-800 font-medium max-w-xs truncate" title={item.Title}>
                                                    {shortTitle}
                                                </td>

                                                {/* NGUỒN */}
                                                <td className="py-5 px-4 text-sm">
                                                    <a
                                                        href={item.SourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-amber-500 hover:text-amber-700 underline decoration-amber-500/30 transition-colors"
                                                    >
                                                        {item.SourceUrl && item.SourceUrl.length > 25 ? item.SourceUrl.substring(0, 25) + '...' : item.SourceUrl}
                                                    </a>
                                                </td>

                                                {/* THỜI GIAN */}
                                                <td className="py-5 px-4 text-sm text-gray-500 font-mono font-medium">
                                                    {timeStr}
                                                </td>

                                                {/* TRẠNG THÁI */}
                                                <td className="py-5 px-4">
                                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg w-max border border-green-100">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                        <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider">
                                                            Thành Công
                                                        </span>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}