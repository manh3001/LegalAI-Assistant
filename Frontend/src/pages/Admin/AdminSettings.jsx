import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Settings,
    Database,
    Cpu,
    Save,
    Eye,
    EyeOff,
    CheckCircle,
    XCircle,
    Loader
} from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
import Swal from 'sweetalert2';
import { API_URL } from '../../config/api';

const API_BASE = `${API_URL}/admin/settings`;

export default function AdminSettings() {
    const navigate = useNavigate();
    const location = useLocation();

    // --- 1. STATE QUẢN LÝ DỮ LIỆU ---
    const [formData, setFormData] = useState({
        appName: '',
        adminEmail: '',
        geminiApiKey: '',
        geminiModel: 'gemini-3.1-pro-preview',
        temperature: 0.3,
        pineconeApiKey: '',
        pineconeIndex: 'legal-vectors'
    });
    // STATE LƯU DANH SÁCH MODEL 
    const [availableModels, setAvailableModels] = useState(['gemini-2.5-flash', 'gemini-1.5-flash']);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    // --- 2. STATE GIAO DIỆN & LOADING ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showPineconeKey, setShowPineconeKey] = useState(false);

    // State Kiểm tra kết nối
    const [checkingGemini, setCheckingGemini] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);
    const [checkingPinecone, setCheckingPinecone] = useState(false);
    const [pineconeStatus, setPineconeStatus] = useState(null);

    // --- 3. FETCH DỮ LIỆU TỪ DB KHI MỞ TRANG ---
    useEffect(() => {
        fetchSettings();
        fetchAvailableModels(); // Gọi hàm lấy model từ Google
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(API_BASE, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success && response.data.data) {
                setFormData(response.data.data);
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình:', error);
        } finally {
            setIsLoading(false);
        }
    };
    //  HÀM FETCH DANH SÁCH MODEL
    const fetchAvailableModels = async () => {
        try {
            setIsLoadingModels(true);
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`${API_BASE}/models`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success && response.data.data.length > 0) {
                setAvailableModels(response.data.data);
            }
        } catch (error) {
            console.error('Lỗi tải danh sách model:', error);
        } finally {
            setIsLoadingModels(false);
        }
    };
    // --- 4. XỬ LÝ NHẬP LIỆU ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'temperature' ? parseFloat(value) : value
        }));
    };

    // --- 5. LƯU CẤU HÌNH ---
    const handleSave = async () => {
        try {
            setIsSaving(true);
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(API_BASE, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                Swal.fire({ icon: 'success', title: 'Đã lưu cấu hình thành công! Hệ thống đã cập nhật tức thì.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (error) {
            console.error('Lỗi khi lưu:', error);
            Swal.fire({ icon: 'error', title: 'Có lỗi xảy ra! Vui lòng thử lại.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- 6. KIỂM TRA KẾT NỐI ---
    const handleCheckGemini = async () => {
        setCheckingGemini(true);
        setGeminiStatus(null);
        setTimeout(() => {
            setGeminiStatus(formData.geminiApiKey.length > 10 ? 'success' : 'error');
            setCheckingGemini(false);
        }, 1500);
    };

    const handleCheckPinecone = async () => {
        setCheckingPinecone(true);
        setPineconeStatus(null);
        setTimeout(() => {
            setPineconeStatus(formData.pineconeApiKey.length > 10 ? 'success' : 'error');
            setCheckingPinecone(false);
        }, 1500);
    };

    // --- 7. GIAO DIỆN CHÍNH ---
    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">
            {/* SIDEBAR */}
            <AdminSidebar />

            {/* NỘI DUNG */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">

                {/* MÀN HÌNH LOADING  */}
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <Loader className="animate-spin text-amber-600" size={40} />
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest animate-pulse">Đang tải cấu hình AI Engine...</p>
                        </div>
                    </div>
                )}

                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Cài đặt hệ thống</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Cấu hình tham số vận hành, API và bảo mật ứng dụng.</p>
                    </div>
                </header>

                <section className="bg-white/80 backdrop-blur-xl border border-amber-200 rounded-[2.5rem] p-8 shadow-2xl relative">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

                        {/* === CỘT 1: THÔNG TIN HỆ THỐNG === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                <Settings className="text-amber-600" size={20} />
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Thông tin hệ thống</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1">Tên ứng dụng</label>
                                    <input
                                        type="text" name="appName" value={formData.appName} onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm font-medium"
                                        placeholder="LEGAI HUB"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1">Email quản trị viên</label>
                                    <input
                                        type="email" name="adminEmail" value={formData.adminEmail} onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm font-medium"
                                        placeholder="admin@legai.vn"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* === CỘT 2: CẤU HÌNH GEMINI === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                <Cpu className="text-amber-600" size={20} />
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Cấu hình Gemini AI</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Google Gemini API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showGeminiKey ? "text" : "password"}
                                            name="geminiApiKey"
                                            value={formData.geminiApiKey}
                                            onChange={handleInputChange}
                                            autoComplete="new-password" /*  chặn Autofill */
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm font-mono pr-12"
                                            placeholder="••••••••••••••••"
                                        />
                                        <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors">
                                            {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                {/* BƯỚC 3: GIAO DIỆN SELECT MODEL ĐỘNG */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1">
                                        Model AI
                                        {/* Hiển thị icon xoay xoay nếu đang lấy danh sách từ Google */}
                                        {isLoadingModels && <Loader size={10} className="inline animate-spin ml-2 text-amber-600" />}
                                    </label>
                                    <select
                                        name="geminiModel"
                                        value={formData.geminiModel}
                                        onChange={handleInputChange} // Ông nhớ đảm bảo có hàm này trong file nhé
                                        className="w-full bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 text-sm font-medium cursor-pointer"
                                        disabled={isLoadingModels} // Khóa select lại khi đang tải để tránh lỗi
                                    >
                                        {availableModels.map((model) => (
                                            <option key={model} value={model} className="bg-white">
                                                {model}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1 flex justify-between">
                                        <span>Temperature (Độ sáng tạo)</span>
                                        <span className="text-amber-600">{formData.temperature}</span>
                                    </label>
                                    <input
                                        type="range" name="temperature" min="0" max="1" step="0.1" value={formData.temperature} onChange={handleInputChange}
                                        className="w-full accent-amber-500 cursor-pointer h-2 bg-gray-300 rounded-lg appearance-none"
                                    />
                                </div>
                                {/* Nút Test Gemini */}
                                <div className="pt-2">
                                    <button onClick={handleCheckGemini} disabled={checkingGemini} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors">
                                        {checkingGemini ? <Loader size={14} className="animate-spin" /> :
                                            geminiStatus === 'success' ? <CheckCircle size={14} className="text-green-600" /> :
                                                geminiStatus === 'error' ? <XCircle size={14} className="text-red-600" /> :
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></div>}
                                        Kiểm tra trạng thái kết nối
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* === CỘT 3: CẤU HÌNH PINECONE === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                <Database className="text-amber-600" size={20} />
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Cấu hình Pinecone</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1">Pinecone API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showPineconeKey ? "text" : "password"}
                                            name="pineconeApiKey"
                                            value={formData.pineconeApiKey}
                                            onChange={handleInputChange}
                                            autoComplete="new-password" /*  chặn Autofill */
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm font-mono pr-12"
                                            placeholder="••••••••••••••••"
                                        />
                                        <button onClick={() => setShowPineconeKey(!showPineconeKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors">
                                            {showPineconeKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2 ml-1">Index Name</label>
                                    <input
                                        type="text" name="pineconeIndex" value={formData.pineconeIndex} onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm font-medium"
                                        placeholder="legal-vectors"
                                    />
                                </div>
                                {/* Nút Test Pinecone */}
                                <div className="pt-2">
                                    <button onClick={handleCheckPinecone} disabled={checkingPinecone} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors">
                                        {checkingPinecone ? <Loader size={14} className="animate-spin" /> :
                                            pineconeStatus === 'success' ? <CheckCircle size={14} className="text-green-600" /> :
                                                pineconeStatus === 'error' ? <XCircle size={14} className="text-red-600" /> :
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></div>}
                                        Kiểm tra trạng thái kết nối
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* === NÚT LƯU === */}
                    <div className="mt-12 pt-8 border-t border-gray-200 flex justify-end relative z-10">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all transform active:scale-95 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]'}`}
                        >
                            {isSaving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSaving ? 'ĐANG LƯU...' : 'LƯU CẤU HÌNH'}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}