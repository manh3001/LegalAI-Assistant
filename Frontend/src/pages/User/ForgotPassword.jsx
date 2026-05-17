import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, KeyIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import logo from "../../assets/icons/logo.png";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [showPass, setShowPass] = useState({ new: false, confirm: false });
    const [data, setData] = useState({ new: "", confirm: "" });

    const handleReset = (e) => {
        e.preventDefault();
        if (!data.new || !data.confirm) {
            Swal.fire({ icon: 'warning', title: 'Thông báo lỗi yêu cầu nhập đầy đủ thông tin', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }
        if (data.new !== data.confirm) {
            Swal.fire({ icon: 'warning', title: 'Thông báo lỗi: Mật khẩu không khớp', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            return;
        }
        Swal.fire({ icon: 'success', title: 'Thông báo khôi phục mật khẩu thành công', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, iconColor: '#B8985D' }).then(() => navigate('/login'));
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full border border-slate-200 bg-white rounded-3xl shadow-sm relative overflow-hidden min-h-[550px]">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <img
                        src={logo}
                        alt="Watermark Logo"
                        className="w-[500px] h-auto opacity-20 transition-opacity duration-500"
                    />
                </div>
                <div className="absolute -left-10 top-10 w-64 h-64 border-2 border-cyan-500 rounded-full opacity-10 z-0"></div>
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-10 min-h-[550px]">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">
                            Khôi phục mật khẩu
                        </h2>
                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="relative">
                                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPass.new ? "text" : "password"}
                                    placeholder="Nhập mật khẩu mới ..."
                                    className="w-full pl-12 pr-12 py-4 bg-white/60 border border-slate-200 rounded-full outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                                    onChange={(e) => setData({ ...data, new: e.target.value })}
                                />
                                <button type="button" onClick={() => setShowPass({ ...showPass, new: !showPass.new })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    {showPass.new ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>
                            <div className="relative">
                                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPass.confirm ? "text" : "password"}
                                    placeholder="Nhập lại mật khẩu ..."
                                    className="w-full pl-12 pr-12 py-4 bg-white/60 border border-slate-200 rounded-full outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                                    onChange={(e) => setData({ ...data, confirm: e.target.value })}
                                />
                                <button type="button" onClick={() => setShowPass({ ...showPass, confirm: !showPass.confirm })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    {showPass.confirm ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>

                            <button type="submit" className="px-12 py-3.5 bg-slate-900 text-white font-bold uppercase text-xs tracking-widest rounded-full hover:bg-cyan-600 transition-all shadow-lg active:scale-95">
                                Xác nhận khôi phục
                            </button>
                        </form>
                    </div>
                    <div className="text-center space-y-4 border-l border-slate-100 pl-8 hidden md:block">
                        <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Đăng nhập</h3>
                        <p className="text-slate-400 text-sm font-medium">Đăng nhập nếu bạn đã có tài khoản</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-10 py-3 border-2 border-slate-900 text-slate-900 font-bold uppercase text-xs rounded-full hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                        >
                            Đăng nhập ngay
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}