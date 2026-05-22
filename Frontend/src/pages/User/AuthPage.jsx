import React, { useState } from "react";
import Swal from 'sweetalert2';
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
    ArrowPathIcon,
    CheckBadgeIcon,
    EnvelopeIcon,
    KeyIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    SparklesIcon,
    UserIcon
} from "@heroicons/react/24/outline";
import GoogleLoginButton from '../../components/GoogleLoginButton';
import { decodeJwt } from '../../utils/googleAuth';
import { loginWithGoogle, saveAuthSession } from '../../services/authService';

const modeCopy = {
    LOGIN: {
        badge: "Truy cập hệ thống",
        title: "Đăng nhập",
        desc: "Đăng nhập để sử dụng các dịch vụ LegalAI và quản lý hồ sơ pháp lý của bạn.",
        submit: "Xác nhận truy cập"
    },
    REGISTER: {
        badge: "Tạo tài khoản",
        title: "Đăng ký",
        desc: "Tạo tài khoản mới để lưu trữ, phân tích và theo dõi hồ sơ pháp lý.",
        submit: "Hoàn tất đăng ký"
    },
    FORGOT: {
        badge: "Khôi phục",
        title: "Quên mật khẩu",
        desc: "Nhập email để nhận mã PIN khôi phục mật khẩu.",
        submit: "Gửi email khôi phục"
    },
    RESET: {
        badge: "Cập nhật bảo mật",
        title: "Đặt lại mật khẩu",
        desc: "Nhập mã PIN đã nhận và tạo mật khẩu mới cho tài khoản.",
        submit: "Cập nhật mật khẩu mới"
    }
};

export default function AuthPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [mode, setMode] = useState("LOGIN");
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        password: "",
        pin: "",
        newPassword: ""
    });

    React.useEffect(() => {
        if (location.state?.mode === "register") setMode("REGISTER");
        if (location.state?.mode === "forgot") setMode("FORGOT");
    }, [location]);

    const currentCopy = modeCopy[mode] || modeCopy.LOGIN;
    const backendBase = "http://localhost:8000/api";
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    const onChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const switchMode = (nextMode) => {
        setMode(nextMode);
    };

    const validatePassword = (pwd) => {
        if (!pwd || typeof pwd !== 'string') return false;
        const re = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\?]).{6,}$/;
        return re.test(pwd);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (mode === "LOGIN") {
                const { email, password } = form;
                if (!email || !password) {
                    await Swal.fire({ icon: 'warning', title: 'Vui lòng nhập email và mật khẩu.', confirmButtonColor: '#B8985D' });
                    return;
                }

                const res = await axios.post(`${backendBase}/auth/login`, { email, password });
                if (res.data?.user) {
                    const token = res.data.token || res.data.accessToken;
                    if (token) {
                        localStorage.setItem("token", token);
                        localStorage.setItem("accessToken", token);
                    }

                    localStorage.setItem("user", JSON.stringify(res.data.user));
                    localStorage.setItem("isLoggedIn", "true");

                    const userRole = res.data.user.role;
                    if (userRole) localStorage.setItem("userRole", userRole);

                    window.dispatchEvent(new Event('user:update'));

                    await Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Đăng nhập thành công',
                        showConfirmButton: false,
                        timer: 1500,
                        background: '#B8985D',
                        color: '#ffffff',
                        iconColor: '#ffffff'
                    });

                    const params = new URLSearchParams(window.location.search);
                    const redirectPath = params.get("redirect");

                    if (userRole === "ADMIN") {
                        navigate('/admin/dashboard');
                    } else if (redirectPath) {
                        navigate(decodeURIComponent(redirectPath));
                    } else {
                        navigate('/');
                    }
                } else {
                    await Swal.fire({ icon: 'error', title: res.data?.message || 'Đăng nhập thất bại.', confirmButtonColor: '#B8985D' });
                }
            } else if (mode === "REGISTER") {
                const { fullName, email, password } = form;
                if (!fullName || !email || !password) {
                    await Swal.fire({ icon: 'warning', title: 'Vui lòng điền đầy đủ thông tin.', confirmButtonColor: '#B8985D' });
                    return;
                }

                if (!validatePassword(password)) {
                    await Swal.fire({ icon: 'warning', title: 'Mật khẩu phải từ 6 ký tự trở lên, bao gồm ít nhất một chữ số và một ký tự đặc biệt!', confirmButtonColor: '#B8985D' });
                    return;
                }

                const res = await axios.post(`${backendBase}/auth/register`, { fullName, email, password });
                if (res.data?.user) {
                    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Đăng ký thành công', showConfirmButton: false, timer: 2000 });
                    setMode("LOGIN");
                    setForm({ fullName: "", email: "", password: "", pin: "", newPassword: "" });
                } else {
                    await Swal.fire({ icon: 'error', title: res.data?.message || 'Đăng ký thất bại.', confirmButtonColor: '#B8985D' });
                }
            } else if (mode === "FORGOT") {
                const { email } = form;
                if (!email) {
                    await Swal.fire({ icon: 'warning', title: 'Vui lòng nhập email.', confirmButtonColor: '#B8985D' });
                    return;
                }

                const res = await axios.post(`${backendBase}/auth/forgot-password`, { email });
                if (res.data.success) {
                    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: res.data.message || 'Mã PIN đã được gửi tới email của bạn.', showConfirmButton: false, timer: 2000 });
                    setMode("RESET");
                } else {
                    await Swal.fire({ icon: 'error', title: res.data.message || 'Không thể thực hiện yêu cầu.', confirmButtonColor: '#B8985D' });
                }
            } else if (mode === "RESET") {
                const { email, pin, newPassword } = form;
                if (!email || !pin || !newPassword) {
                    await Swal.fire({ icon: 'warning', title: 'Vui lòng nhập email, mã PIN và mật khẩu mới.', confirmButtonColor: '#B8985D' });
                    return;
                }

                if (!validatePassword(newPassword)) {
                    await Swal.fire({ icon: 'warning', title: 'Mật khẩu phải từ 6 ký tự trở lên, bao gồm ít nhất một chữ số và một ký tự đặc biệt!', confirmButtonColor: '#B8985D' });
                    return;
                }

                const res = await axios.post(`${backendBase}/auth/reset-password`, { email, pin, newPassword });
                if (res.data.success) {
                    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Đổi mật khẩu thành công', showConfirmButton: false, timer: 2000 });
                    setMode("LOGIN");
                    setForm({ ...form, password: "", pin: "", newPassword: "" });
                } else {
                    await Swal.fire({ icon: 'error', title: res.data.message || 'Mã PIN không chính xác hoặc đã hết hạn.', confirmButtonColor: '#B8985D' });
                }
            }
        } catch (err) {
            console.error(err);
            await Swal.fire({ icon: 'error', title: err.response?.data?.message || err.message || 'Lỗi server.', confirmButtonColor: '#B8985D' });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credential) => {
        setLoading(true);
        try {
            const payload = decodeJwt(credential);
            if (!payload) throw new Error('Invalid credential');

            // Send Google ID Token to backend for verification and receive a system JWT
            const response = await loginWithGoogle(credential);

            const user = response.user || {
                id: payload.sub || payload.sid || payload.email,
                name: payload.name || payload.given_name || '',
                email: payload.email,
                picture: payload.picture
            };
            const token = response.token || response.accessToken || credential;

            saveAuthSession(user, token);

            await Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Đăng nhập bằng Google thành công',
                showConfirmButton: false,
                timer: 1500,
                background: '#B8985D',
                color: '#ffffff',
                iconColor: '#ffffff'
            });

            const params = new URLSearchParams(window.location.search);
            const redirectPath = params.get("redirect");
            if (redirectPath) navigate(decodeURIComponent(redirectPath));
            else navigate('/');

        } catch (err) {
            console.error('Google sign-in error', err);
            await Swal.fire({ icon: 'error', title: err.response?.data?.message || 'Không thể đăng nhập bằng Google', confirmButtonColor: '#B8985D' });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = (err) => {
        console.error('Google Sign-in error', err);
    };

    const inputClass = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-semibold text-[#1A2530] outline-none transition placeholder:text-zinc-400 focus:border-[#B8985D] focus:bg-white focus:ring-4 focus:ring-[#B8985D]/10";
    const labelClass = "mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500";

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
            <div className="absolute top-[-10%] left-[-10%] h-[520px] w-[520px] rounded-full bg-[#B8985D]/10 blur-[120px]"></div>
            <div className="absolute bottom-[-12%] right-[-8%] h-[440px] w-[440px] rounded-full bg-blue-900/5 blur-[100px]"></div>

            <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-12 lg:py-24">
                <section className="hidden lg:col-span-7 lg:block">
                    <div className="max-w-2xl">
                        <p className="text-[18px] font-semibold uppercase tracking-[0.26em] text-[#B8985D]">
                            Legal Tech Platform
                        </p>
                        <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight text-[#1A2530] xl:text-6xl">
                            Quản lý truy cập
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C5A880] to-[#8E6D45]">
                                an toàn và liền mạch
                            </span>
                        </h1>
                        <p className="mt-6 max-w-[58ch] text-base font-medium leading-8 text-zinc-600">
                            Một tài khoản cho phân tích hợp đồng, tạo biểu mẫu, lập kế hoạch AI và kho hồ sơ pháp lý cá nhân.
                        </p>

                        <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4">
                            {[
                                { icon: ShieldCheckIcon, title: "Bảo mật", desc: "Token đăng nhập" },
                                { icon: CheckBadgeIcon, title: "Đồng bộ", desc: "Hồ sơ pháp lý" },
                                { icon: SparklesIcon, title: "AI", desc: "Trợ lý pháp luật" }
                            ].map((item) => (
                                <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-[0_15px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
                                    <div className="mb-4 inline-flex rounded-xl border border-[#B8985D]/20 bg-[#B8985D]/10 p-2">
                                        <item.icon className="h-5 w-5 text-[#B8985D] stroke-2" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-wide text-[#1A2530]">{item.title}</h3>
                                    <p className="mt-1 text-xs font-medium text-zinc-500">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="lg:col-span-5">
                    <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/85 shadow-[0_20px_60px_rgba(26,37,48,0.08)] backdrop-blur-xl">
                        <div className="border-b border-zinc-100 px-6 py-7 sm:px-8">
                            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#B8985D]/30 bg-[#B8985D]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#8E6D45]">
                                <LockClosedIcon className="h-4 w-4 stroke-2" /> {currentCopy.badge}
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-wide text-[#1A2530]">
                                {currentCopy.title}
                            </h2>
                            <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">{currentCopy.desc}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-7 sm:px-8">
                            {mode === "REGISTER" && (
                                <div>
                                    <label className={labelClass}>Họ và tên</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 stroke-2" />
                                        <input name="fullName" value={form.fullName} onChange={onChange} className={`${inputClass} pl-12`} placeholder="Nguyễn Văn A" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={labelClass}>Email</label>
                                <div className="relative">
                                    <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 stroke-2" />
                                    <input name="email" type="email" value={form.email} onChange={onChange} className={`${inputClass} pl-12`} placeholder="email@domain.com" />
                                </div>
                            </div>

                            {(mode === "LOGIN" || mode === "REGISTER") && (
                                <div>
                                    <label className={labelClass}>Mật khẩu</label>
                                    <div className="relative">
                                        <KeyIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 stroke-2" />
                                        <input name="password" type="password" value={form.password} onChange={onChange} className={`${inputClass} pl-12`} placeholder="Mật khẩu" />
                                    </div>
                                </div>
                            )}

                            {mode === "RESET" && (
                                <div className="space-y-5">
                                    <div>
                                        <label className={labelClass}>Mã PIN</label>
                                        <input
                                            name="pin"
                                            value={form.pin}
                                            onChange={onChange}
                                            className={`${inputClass} text-center text-2xl font-black tracking-[0.45em]`}
                                            placeholder="000000"
                                            maxLength={6}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Mật khẩu mới</label>
                                        <div className="relative">
                                            <KeyIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 stroke-2" />
                                            <input name="newPassword" type="password" value={form.newPassword} onChange={onChange} className={`${inputClass} pl-12`} placeholder="Nhập mật khẩu mới" />
                                        </div>
                                    </div>
                                </div>
                            )}



                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-xl border border-[#1A2530] bg-[#1A2530] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-md transition hover:bg-[#B8985D] hover:border-[#B8985D] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loading ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <ArrowPathIcon className="h-4 w-4 animate-spin stroke-2" /> Đang xử lý...
                                    </span>
                                ) : currentCopy.submit}
                            </button>

                            {mode === "LOGIN" && googleClientId && (
                                <div className="mt-6">
                                    <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-400">
                                        <span className="h-px flex-1 bg-zinc-200"></span>
                                        <span>Hoặc</span>
                                        <span className="h-px flex-1 bg-zinc-200"></span>
                                    </div>
                                    <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
                                </div>
                            )}
                        </form>

                        <div className="border-t border-zinc-100 bg-zinc-50/70 px-6 py-5 text-center text-sm font-semibold text-zinc-500 sm:px-8">
                            {mode === "LOGIN" && (
                                <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
                                    <span>Người dùng mới?</span>
                                    <button className="font-black text-[#B8985D] hover:text-[#8E6D45]" onClick={() => switchMode("REGISTER")}>Đăng ký</button>
                                    <span className="hidden text-zinc-300 sm:inline">|</span>
                                    <button className="font-black text-[#1A2530] hover:text-[#B8985D]" onClick={() => switchMode("FORGOT")}>Quên mật khẩu?</button>
                                </div>
                            )}

                            {mode === "REGISTER" && (
                                <p>
                                    Đã có tài khoản?{" "}
                                    <button className="font-black text-[#B8985D] hover:text-[#8E6D45]" onClick={() => switchMode("LOGIN")}>Đăng nhập</button>
                                </p>
                            )}

                            {(mode === "FORGOT" || mode === "RESET") && (
                                <p>
                                    <button className="font-black text-[#B8985D] hover:text-[#8E6D45]" onClick={() => switchMode("LOGIN")}>Quay lại đăng nhập</button>
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
