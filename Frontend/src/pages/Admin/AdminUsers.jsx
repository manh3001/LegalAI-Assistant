import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, Database, Scale, Users, Activity, Search, RefreshCw, Settings, ShieldCheck, Zap, MoreVertical, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import AdminSidebar from '../../components/AdminSidebar';
const backendBase = 'http://localhost:8000/api';

export default function AdminUsers() {
    const navigate = useNavigate();
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [actionLoading, setActionLoading] = useState(null);

    // State cho modal thêm người dùng
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'USER'
    });
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => {
        fetchUsers(currentPage);
    }, [currentPage]);

    const fetchUsers = async (page = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/users`, {
                headers,
                params: { page, limit: 5 }
            });

            if (res.data?.success) {
                setUsers(res.data.data || []);
                setCurrentPage(res.data.currentPage || 1);
                setTotalPages(res.data.totalPages || 1);
            } else {
                Swal.fire({ icon: 'error', title: res.data?.message || 'Không thể tải danh sách người dùng', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (error) {
            console.error('Lỗi khi tải người dùng:', error);
            Swal.fire({ icon: 'error', title: error.response?.data?.message || error.message || 'Lỗi server', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleBan = async (userId) => {
        setActionLoading(userId);
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.put(`${backendBase}/admin/users/${userId}/ban`, null, { headers });

            if (res.data?.success && res.data.user) {
                setUsers((prev) => prev.map((user) => user.Id === userId ? res.data.user : user));
            } else {
                Swal.fire({ icon: 'error', title: res.data?.message || 'Cập nhật trạng thái thất bại', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (error) {
            console.error('Lỗi khi khóa/mở khóa người dùng:', error);
            Swal.fire({ icon: 'error', title: error.response?.data?.message || error.message || 'Lỗi server', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddFormChange = (e) => {
        const { name, value } = e.target;
        setAddForm(prev => ({ ...prev, [name]: value }));
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!addForm.fullName.trim() || !addForm.email.trim() || !addForm.password.trim()) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng điền đầy đủ thông tin!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }

        setAddLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(`${backendBase}/admin/users`, addForm, { headers });

            if (res.data?.success) {
                Swal.fire({ icon: 'success', title: 'Thêm người dùng thành công!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
                setShowAddModal(false);
                setAddForm({ fullName: '', email: '', password: '', role: 'USER' });
                fetchUsers(currentPage); // Refresh danh sách
            } else {
                Swal.fire({ icon: 'error', title: res.data?.message || 'Thêm người dùng thất bại', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (error) {
            console.error('Lỗi khi thêm người dùng:', error);
            Swal.fire({ icon: 'error', title: error.response?.data?.message || error.message || 'Lỗi server', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">
            {/* --- SIDEBAR ADMIN --- */}
            <AdminSidebar />

            {/* --- NỘI DUNG CHÍNH --- */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Quản lý Người dùng</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Danh sách người dùng, khóa/mở khóa và phân trang.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all"
                        >
                            <Plus size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Thêm Người Dùng</span>
                        </button>
                        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-gray-600">
                            <span>{users.length} người dùng trên trang</span>
                            <span>|</span>
                            <span>Trang {currentPage} / {totalPages}</span>
                        </div>
                    </div>
                </header>

                <section className="bg-white/80 backdrop-blur-xl border border-amber-200 rounded-[2.5rem] p-6 shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-[0.22em] text-gray-600 border-b border-gray-200">
                                    <th className="px-4 py-4">ID</th>
                                    <th className="px-4 py-4">Tên / Email</th>
                                    <th className="px-4 py-4">Vai trò</th>
                                    <th className="px-4 py-4">Trạng thái</th>
                                    <th className="px-4 py-4">Ngày tham gia</th>
                                    <th className="px-4 py-4 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-900">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-10 text-center text-gray-500">Đang tải danh sách người dùng...</td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-10 text-center text-gray-500">Chưa có người dùng nào.</td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.Id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4 font-mono text-amber-600">#{user.Id}</td>
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-gray-900">{user.FullName || 'Chưa cập nhật'}</div>
                                                <div className="text-xs text-gray-500">{user.Email || '-'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.Role === 'ADMIN' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                                                    {user.Role || 'USER'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.Status === 'Banned' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                    {user.Status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-gray-600">{user.CreatedAt ? new Date(user.CreatedAt).toLocaleDateString('vi-VN') : '-'}</td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    onClick={() => handleToggleBan(user.Id)}
                                                    disabled={actionLoading === user.Id}
                                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] transition ${user.Status === 'Banned' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'} ${actionLoading === user.Id ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {actionLoading === user.Id ? 'Đang xử lý...' : user.Status === 'Banned' ? 'Mở khóa' : 'Khóa'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 items-center justify-center">
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`min-w-[36px] rounded-full px-3 py-2 text-sm font-bold transition ${page === currentPage ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Modal Thêm Người Dùng */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white/95 backdrop-blur-2xl border border-gray-200 rounded-3xl p-6 w-full max-w-md mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Thêm Người Dùng Mới</h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Tên Đầy Đủ</label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={addForm.fullName}
                                        onChange={handleAddFormChange}
                                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="Nhập tên đầy đủ"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={addForm.email}
                                        onChange={handleAddFormChange}
                                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="Nhập email"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Mật Khẩu</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={addForm.password}
                                        onChange={handleAddFormChange}
                                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-3 py-2 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="Nhập mật khẩu"
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
                                        disabled={addLoading}
                                        className="flex-1 px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                    >
                                        {addLoading ? 'Đang thêm...' : 'Thêm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
