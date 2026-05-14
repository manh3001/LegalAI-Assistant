import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

// Hàm làm sạch nội dung bằng cách loại bỏ phần header dư thừa
const getCleanContent = (content) => {
    if (!content) return '';

    const lines = content.split('\n');
    const keywords = ['QUYẾT ĐỊNH:', 'Điều 1.', 'CHƯƠNG', 'Lệnh:'];

    // Tìm dòng đầu tiên chứa các từ khóa
    const startIndex = lines.findIndex(line =>
        keywords.some(keyword => new RegExp(keyword, 'i').test(line))
    );

    // Nếu tìm thấy, cắt bỏ phần trước đó; nếu không, giữ nguyên
    if (startIndex > 0) {
        return lines.slice(startIndex).join('\n').trim();
    }

    return content.trim();
};

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
    const [activeMenuId, setActiveMenuId] = useState(null);

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

        if (!formData.title.trim()) {
            alert('Tiêu đề văn bản không được để trống!');
            return;
        }

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');

            const payload = {
                title: formData.title,
                documentNumber: formData.documentNumber,
                issueYear: formData.issueYear,
                category: formData.category || 'Lĩnh vực khác',
                status: formData.status,
                sourceUrl: formData.sourceUrl,
                content: formData.content
            };

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

    const handleViewDetail = async (doc) => {
        setSelectedDoc(doc);
        setChunksLoading(true);
        setShowChunksModal(true);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`http://localhost:8000/api/documents/${doc.Id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setSelectedDoc(response.data.data);
            }
        } catch (error) {
            console.error('Lỗi khi tải chi tiết văn bản:', error);
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
                                                                onClick={() => { handleViewDetail(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors"
                                                            >
                                                                <Eye size={14} /> Xem Chi Tiết
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

                    {/* Pagination Section */}
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

                {/* View Detail Modal */}
                {showChunksModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[300] p-4 md:p-10">
                        <div className="bg-[#f8f9fa] w-full max-w-5xl h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-200">

                            {/* Toolbar */}
                            <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                        <Eye size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Xem trước nội dung hệ thống</h2>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Dữ liệu thực tế đang lưu trong SQL & Pinecone</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowChunksModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto p-10 flex justify-center custom-scrollbar">
                                {chunksLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 uppercase text-[10px] tracking-[0.2em]">
                                        <Loader2 className="animate-spin mb-4 text-amber-600" size={40} />
                                        Đang truy xuất bản gốc...
                                    </div>
                                ) : (
                                    <div
                                        className="w-full max-w-[800px] bg-white text-black shadow-2xl flex flex-col p-[1.5cm_1.2cm] border border-gray-100"
                                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                                    >
                                        {/* Header - Cấu trúc chuẩn A4 */}
                                        <div className="flex justify-between items-start mb-8 text-[13px] border-b pb-6">
                                            {/* Cột bên trái: Agency & Document Number */}
                                            <div className="w-1/2 text-center pr-4">
                                                <p className="font-bold uppercase">{selectedDoc?.Agency?.replace(/TTg|Hà Nội/gi, '').trim() || 'CƠ QUAN BAN HÀNH'}</p>
                                                <p className="font-bold text-center">-------</p>
                                                <p className="mt-1 text-[12px]">Số: {selectedDoc?.DocumentNumber || 'N/A'}</p>
                                            </div>

                                            {/* Cột bên phải: Quốc hiệu & Ngày tháng */}
                                            <div className="w-1/2 text-center pl-4">
                                                <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                                                <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                                                <div className="w-24 h-[1px] bg-black mx-auto mt-1"></div>
                                                <p className="text-[11px] mt-2">{selectedDoc?.IssueDateString?.replace(/^TTg/i, '').trim() || ''}</p>
                                            </div>
                                        </div>

                                        {/* Tiêu đề */}
                                        <div className="text-center my-4">
                                            <h3 className="text-[16px] font-bold uppercase leading-tight">{selectedDoc?.Title}</h3>
                                        </div>

                                        {/* Nội dung chính */}
                                        <div className="law-content-preview text-justify leading-relaxed text-[15px] space-y-2">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {getCleanContent(selectedDoc?.Content || '').trim()}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
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
    .custom-scrollbar::-webkit-scrollbar { 
        width: 8px;              
        height: 8px; 
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05); 
        border-radius: 10px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb { 
        background: #B8985D;     
        border-radius: 10px;
        border: 2px solid transparent;
        background-clip: content-box;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
        background: #a6874d;     
    }
`}</style>
        </div>
    );
}