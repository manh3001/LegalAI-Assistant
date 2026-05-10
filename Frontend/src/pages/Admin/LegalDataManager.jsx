import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import {
    Plus, Edit2, Trash2, Eye, Search, Filter,
    AlertTriangle, CheckCircle2, XCircle, Loader2,
    ChevronLeft, ChevronRight, MoreVertical
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/admin/legal-documents';
const VALID_CATEGORIES = [
    "Bộ máy hành chính", "Tài chính nhà nước", "Văn hóa - Xã hội", "Tài nguyên - Môi trường",
    "Bất động sản", "Xây dựng - Đô thị", "Thương mại", "Thể thao - Y tế", "Giáo dục",
    "Thuế - Phí - Lệ phí", "Giao thông - Vận tải", "Lao động - Tiền lương", "Công nghệ thông tin",
    "Đầu tư", "Doanh nghiệp", "Xuất nhập khẩu", "Sở hữu trí tuệ", "Tiền tệ - Ngân hàng",
    "Bảo hiểm", "Thủ tục Tố tụng", "Hình sự", "Dân sự", "Chứng khoán", "Lĩnh vực khác"
];
export default function LegalDataManager() {
    const [lawData, setLawData] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [activeMenuId, setActiveMenuId] = useState(null); // Quản lý ID của hàng đang mở Menu

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showChunksModal, setShowChunksModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [chunksData, setChunksData] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [chunksLoading, setChunksLoading] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        documentNumber: '',
        issueYear: '',
        category: '',
        content: '',
        status: 'Còn hiệu lực',
        sourceUrl: ''
    });
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                const res = await axios.get(`${API_BASE}/categories`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) setCategories(res.data.data);
            } catch (error) {
                console.error("Không lấy được danh sách phân loại:", error);
            }
        };
        fetchCategories();
    }, []);


    const fetchLawData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');
            const params = {
                page: currentPage,
                limit: 10,
                search: searchQuery,
                category: filterCategory,
                status: filterStatus
            };

            const response = await axios.get(API_BASE, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (response.data.success) {
                setLawData(response.data.data || []);
                setCurrentPage(response.data.currentPage || 1);
                setTotalPages(response.data.totalPages || 1);
                setTotalItems(response.data.totalItems || 0);
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu:', error);
            if (error.response?.status === 401) {
                console.error('Phiên đăng nhập hết hạn!');
            }
        } finally {
            setLoading(false);
        }
    };
    // về trang nhất mỗi khi đổi bộ lọc
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [searchQuery, filterCategory, filterStatus]);
    useEffect(() => {
        fetchLawData();
    }, [currentPage, searchQuery, filterCategory, filterStatus]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) {
            alert('Vui lòng điền đầy đủ tiêu đề và nội dung!');
            return;
        }

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(API_BASE, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Thêm văn bản thành công!');
                setShowAddModal(false);
                resetForm();
                fetchLawData();
            } else {
                alert(response.data.message || 'Thêm thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi thêm:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleEdit = (doc) => {
        setSelectedDoc(doc);
        setFormData({
            title: doc.Title || '',
            documentNumber: doc.DocumentNumber || '',
            issueYear: doc.IssueYear || '',
            category: doc.Category || '',
            content: doc.Content || '',
            status: doc.Status || 'Còn hiệu lực',
            sourceUrl: doc.SourceUrl || ''
        });
        setShowEditModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        
        // 1. Nới lỏng Validation: Chỉ bắt buộc Tiêu đề, cho phép sửa mỗi Category
        if (!formData.title.trim()) {
            alert('Tiêu đề văn bản không được để trống!');
            return;
        }

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            
            // 2. Full Update: Bắt nguyên cục Form State gửi đi (Đã tự động gồm Title, Category, v.v...)
            const payload = {
                title: formData.title,
                documentNumber: formData.documentNumber,
                issueYear: formData.issueYear,
                category: formData.category || 'Lĩnh vực khác', // Default an toàn
                status: formData.status,
                sourceUrl: formData.sourceUrl,
                content: formData.content // Gửi luôn nội dung cũ/mới nếu có
            };

            // 3. Gọi PUT Method để ghi đè xuống DB
            const response = await axios.put(`${API_BASE}/${selectedDoc.Id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Cập nhật thành công!');
                setShowEditModal(false);
                resetForm();
                fetchLawData();
            } else {
                alert(response.data.message || 'Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDelete = (doc) => {
        setSelectedDoc(doc);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!selectedDoc) return;

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.delete(`${API_BASE}/${selectedDoc.Id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Xóa thành công!');
                setShowDeleteModal(false);
                fetchLawData();
            } else {
                alert(response.data.message || 'Xóa thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi xóa:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleViewChunks = async (doc) => {
        setSelectedDoc(doc);
        setChunksLoading(true);
        setShowChunksModal(true);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`${API_BASE}/${doc.Id}/chunks`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setChunksData(response.data.data || []);
            } else {
                setChunksData([]);
            }
        } catch (error) {
            console.error('Lỗi khi tải chunks:', error);
            setChunksData([]);
        } finally {
            setChunksLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            documentNumber: '',
            issueYear: '',
            category: '',
            content: '',
            status: 'Còn hiệu lực',
            sourceUrl: ''
        });
        setSelectedDoc(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const glassClass = 'bg-white/80 backdrop-blur-xl border border-amber-200 shadow-2xl';

    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">
            <AdminSidebar />

            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">
                            Quản lý <span className="text-amber-600">Data Luật</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">
                            Cơ sở dữ liệu pháp lý với Dual-Sync SSMS & Pinecone
                        </p>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    >
                        <Plus size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Thêm Văn Bản</span>
                    </button>
                </header>

                {/* Search & Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="TÌM KIẾM THEO TIÊU ĐỀ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-widest text-gray-900 focus:outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-amber-500 cursor-pointer"
                    >
                        <option value="">Tất cả phân loại</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-amber-500 cursor-pointer"
                    >
                        <option value="" className="bg-white text-gray-900 font-bold py-2">
                            Tất cả trạng thái
                        </option>
                        <option value="Còn hiệu lực" className="bg-white text-gray-900 font-bold py-2">
                            Còn hiệu lực
                        </option>
                        <option value="Hết hiệu lực" className="bg-white text-gray-900 font-bold py-2">
                            Hết hiệu lực
                        </option>
                        <option value="Chưa có hiệu lực" className="bg-white text-gray-900 font-bold py-2">
                            Chưa có hiệu lực
                        </option>
                    </select>
                </div>

                {/* Table Section */}
                <section className={`${glassClass} rounded-[2.5rem] p-6 overflow-visible`}>
                    <div className="overflow-x-visible">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-[0.2em] text-gray-900 font-black border-b border-gray-200">
                                    <th className="px-6 py-4 w-[30%]">Điều Luật </th>
                                    <th className="px-6 py-4 w-[30%]">Phân loại</th>
                                    <th className="px-6 py-4 w-[20%]">Hiệu Lực</th>
                                    <th className="px-6 py-4 w-[25%]">Trạng thái DATA</th>
                                    <th className="px-6 py-4 w-[10%] text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center">
                                            <Loader2 className="animate-spin mx-auto mb-2 text-amber-600" size={32} />
                                            <span className="text-[10px] uppercase tracking-widest text-gray-500">Đang đồng bộ dữ liệu...</span>
                                        </td>
                                    </tr>
                                ) : lawData.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center text-gray-500 uppercase text-[10px] tracking-widest">
                                            Không tìm thấy dữ liệu phù hợp
                                        </td>
                                    </tr>
                                ) : (
                                    lawData.map((item) => (
                                        <tr key={item.Id} className="border-b border-gray-100 hover:bg-gray-50 transition-all group">
                                            <td className="px-6 py-4 overflow-hidden">
                                                <div className="font-bold text-gray-900 truncate w-full group-hover:text-amber-600 transition-colors" title={item.Title}>
                                                    {item.Title}
                                                </div>
                                                <div className="text-[11px] text-gray-500 truncate w-full italic mt-0.5 opacity-60">
                                                    {item.ContentPreview || 'Bản xem trước không khả dụng'}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase truncate max-w-full">
                                                    {item.Category || 'Chưa phân loại'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.Status === 'Còn hiệu lực' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-[11px] font-bold whitespace-nowrap text-gray-900">{item.Status}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5" title="SQL Server Storage">
                                                        <div className={`w-1 h-1 rounded-full ${item.SyncStatusSsms === 'success' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">DB</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5" title="Pinecone Vectorized">
                                                        <div className={`w-1 h-1 rounded-full ${item.SyncStatusPinecone === 'success' ? 'bg-purple-500' : 'bg-red-500'}`}></div>
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter font-mono">PINE</span>
                                                    </div>
                                                    {item.SyncStatusPinecone === 'success' && (
                                                        <span className="text-[8px] font-black bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/20">VECTORED</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={() => setActiveMenuId(activeMenuId === item.Id ? null : item.Id)}
                                                    className={`p-2 rounded-xl transition-all ${activeMenuId === item.Id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'hover:bg-gray-100 text-gray-600'}`}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {/* Dropdown */}
                                                {activeMenuId === item.Id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)}></div>
                                                        <div className="absolute right-6 top-14 w-44 bg-white border border-gray-200 rounded-2xl shadow-2xl z-20 overflow-hidden backdrop-blur-2xl py-1 animate-in fade-in zoom-in duration-150">
                                                            <button
                                                                onClick={() => { handleViewChunks(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors"
                                                            >
                                                                <Eye size={14} /> Xem Chunks
                                                            </button>
                                                            <button
                                                                onClick={() => { handleEdit(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors border-t border-gray-100"
                                                            >
                                                                <Edit2 size={14} /> Chỉnh sửa
                                                            </button>
                                                            <button
                                                                onClick={() => { handleDelete(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                                                            >
                                                                <Trash2 size={14} /> Gỡ bỏ
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Section - Nằm gọn trong khối Section */}
                    {totalPages > 1 && (
                        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                                Hiển thị <span className="text-gray-900">{lawData.length}</span> / <span className="text-gray-900">{totalItems}</span> tri thức pháp luật
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-black px-4 py-2 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
                                        TRANG {currentPage}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-600 px-2">/</span>
                                    <span className="text-[11px] font-black text-gray-400 px-3">
                                        {totalPages}
                                    </span>
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Thêm Văn Bản Mới</h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Tiêu đề *</label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                            placeholder="Ví dụ: Điều 117. Điều kiện có hiệu lực của giao dịch dân sự"
                                            
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Số văn bản</label>
                                        <input
                                            type="text"
                                            name="documentNumber"
                                            value={formData.documentNumber}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                            placeholder="Ví dụ: 103/NQ-CP"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Năm ban hành</label>
                                        <input
                                            type="number"
                                            name="issueYear"
                                            value={formData.issueYear}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                            placeholder="Ví dụ: 2015"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Phân loại</label>
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleFormChange}
                                            className="w-full bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        >
                                            <option className="bg-white text-gray-900" value="">Chọn phân loại</option>
                                            {VALID_CATEGORIES.map((cat) => (
                                                <option className="bg-white text-gray-900" key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Trạng thái hiệu lực</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleFormChange}
                                            className="w-full bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        >
                                            <option className="bg-white text-gray-900" value="Còn hiệu lực">Còn hiệu lực</option>
                                            <option className="bg-white text-gray-900" value="Hết hiệu lực">Hết hiệu lực</option>
                                            <option className="bg-white text-gray-900" value="Chưa có hiệu lực">Chưa có hiệu lực</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">URL nguồn</label>
                                    <input
                                        type="url"
                                        name="sourceUrl"
                                        value={formData.sourceUrl}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="https://thuvienphapluat.vn/..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Nội dung đầy đủ *</label>
                                    <textarea
                                        name="content"
                                        value={formData.content}
                                        onChange={handleFormChange}
                                        rows={8}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="Nhập toàn bộ nội dung điều luật..."
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalLoading}
                                        className="flex-1 px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                    >
                                        {modalLoading ? 'Đang thêm...' : 'Thêm mới'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Sửa Văn Bản</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Tiêu đề *</label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                           
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Số văn bản</label>
                                        <input
                                            type="text"
                                            name="documentNumber"
                                            value={formData.documentNumber}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Năm ban hành</label>
                                        <input
                                            type="number"
                                            name="issueYear"
                                            value={formData.issueYear}
                                            onChange={handleFormChange}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Phân loại</label>
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleFormChange}
                                            className="w-full bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        >
                                            <option className="bg-white text-gray-900" value="">Chọn phân loại</option>
                                            {VALID_CATEGORIES.map((cat) => (
                                                <option className="bg-white text-gray-900" key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Trạng thái hiệu lực</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleFormChange}
                                            className="w-full bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        >
                                            <option className="bg-white text-gray-900" value="Còn hiệu lực">Còn hiệu lực</option>
                                            <option className="bg-white text-gray-900" value="Hết hiệu lực">Hết hiệu lực</option>
                                            <option className="bg-white text-gray-900" value="Chưa có hiệu lực">Chưa có hiệu lực</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">URL nguồn</label>
                                    <input
                                        type="url"
                                        name="sourceUrl"
                                        value={formData.sourceUrl}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Nội dung đầy đủ *</label>
                                    <textarea
                                        name="content"
                                        value={formData.content}
                                        onChange={handleFormChange}
                                        rows={8}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalLoading}
                                        className="flex-1 px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                    >
                                        {modalLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Chunks Modal */}
                {showChunksModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Preview Chunks</h2>
                                <button
                                    onClick={() => setShowChunksModal(false)}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {chunksLoading ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Loader2 className="animate-spin mx-auto mb-2 text-amber-600" size={24} />
                                    Đang tải chunks...
                                </div>
                            ) : chunksData.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">Không có chunks nào.</div>
                            ) : (
                                <div className="space-y-4">
                                    {chunksData.map((chunk, index) => (
                                        <div key={index} className="bg-gray-50 rounded-3xl border border-gray-200 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Chunk {index + 1}</span>
                                                <span className="text-xs text-gray-500">{chunk.length} ký tự</span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{chunk}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-md mx-4 rounded-3xl p-6`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Xác nhận xóa</h2>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="text-center mb-6">
                                <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                                <p className="text-sm text-gray-700">
                                    Bạn có chắc muốn xóa "<span className="text-gray-900 font-bold">{selectedDoc?.Title}</span>"?
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Hành động này không thể hoàn tác.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={modalLoading}
                                    className="flex-1 px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {modalLoading ? 'Đang xóa...' : 'Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}