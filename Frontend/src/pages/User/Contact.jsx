import React, { useState } from 'react';
import axios from 'axios';
import {
    EnvelopeIcon,
    PhoneIcon,
    MapPinIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon,
    PaperAirplaneIcon
} from '@heroicons/react/24/outline';

export default function Contact() {
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", subject: "Tư vấn hợp đồng bằng AI", message: "" });
    const [sending, setSending] = useState(false);
    const [infoMessage, setInfoMessage] = useState("");
    const [errors, setErrors] = useState({});

    const validateEmail = (value) => {
        if (!value) return 'Vui lòng nhập email.';
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(value) ? null : 'Địa chỉ email không hợp lệ.';
    };

    const validatePhone = (value) => {
        if (!value) return 'Vui lòng nhập số điện thoại.';
        const digits = value.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 11) return 'Số điện thoại không hợp lệ.';
        return null;
    };

    const validateName = (value) => {
        if (!value) return 'Vui lòng nhập họ và tên.';
        if (value.trim().length < 2) return 'Tên quá ngắn.';
        return null;
    };

    const validateSubject = (value) => {
        if (!value) return 'Vui lòng chọn chủ đề.';
        return null;
    };

    const validateMessage = (value) => {
        if (!value) return 'Vui lòng nhập nội dung.';
        if (value.trim().length < 10) return 'Nội dung quá ngắn (ít nhất 10 ký tự).';
        return null;
    };

    const validateField = (field, value) => {
        switch (field) {
            case 'name': return validateName(value);
            case 'email': return validateEmail(value);
            case 'phone': return validatePhone(value);
            case 'subject': return validateSubject(value);
            case 'message': return validateMessage(value);
            default: return null;
        }
    };

    const validateAll = () => {
        const next = {};
        next.name = validateName(formData.name);
        next.email = validateEmail(formData.email);
        next.phone = validatePhone(formData.phone);
        next.subject = validateSubject(formData.subject);
        next.message = validateMessage(formData.message);
        Object.keys(next).forEach(k => { if (next[k] === null) delete next[k]; });
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
    };

    const handleBlur = (field) => {
        const err = validateField(field, formData[field]);
        setErrors(prev => ({ ...prev, [field]: err }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validateAll()) {
            return;
        }

        setInfoMessage('LegalAI đã tiếp nhận yêu cầu hỗ trợ.');

        const payload = { ...formData };

        setFormData({ name: "", email: "", phone: "", subject: "Tư vấn hợp đồng bằng AI", message: "" });
        setErrors({});

        setSending(true);
        axios.post("http://localhost:8000/api/support", payload, { headers: { 'Content-Type': 'application/json' } })
            .then(res => {
                console.log('Support request response:', res.data);
            })
            .catch(err => {
                console.error('Support email send error', err);
            })
            .finally(() => setSending(false));
    };

    return (
        // Nền tổng thể sáng
        <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans selection:bg-[#B8985D]/30 relative overflow-x-hidden">

            {/* Hiệu ứng nền Glow - Chỉnh màu sáng hơn */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#B8985D]/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-32 px-6 text-center">
                <div className="max-w-3xl mx-auto space-y-6 animate-fadeInUp">
                    {/* Màu button accent */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B8985D]/30 bg-[#B8985D]/10 text-[#8E6D45] text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                        <ChatBubbleLeftRightIcon className="w-4 h-4" /> Hỗ trợ 24/7
                    </div>
                    {/* Tiêu đề chính */}
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight uppercase italic leading-tight">
                        Liên hệ với <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8985D] to-[#8E6D45]">
                            Chúng tôi
                        </span>
                    </h1>
                    {/* Text phụ */}
                    <p className="text-zinc-600 text-lg font-medium max-w-2xl mx-auto">
                        Đội ngũ luật sư và chuyên gia AI luôn sẵn sàng lắng nghe và hỗ trợ bạn giải quyết mọi vấn đề pháp lý.
                    </p>
                </div>
            </section>

            <main className="max-w-7xl mx-auto px-6 -mt-16 pb-20 relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* CỘT TRÁI: THÔNG TIN */}
                    <aside className="lg:col-span-5 space-y-6">
                        {/* Card nền trắng, border zinc */}
                        <div className="bg-white rounded-3xl border border-zinc-200 p-8 space-y-8 h-full shadow-lg">
                            {/* Tiêu đề sidebar */}
                            <h2 className="text-2xl font-black text-zinc-800 uppercase tracking-tight italic flex items-center gap-2">
                                <span className="w-1 h-8 bg-[#B8985D] rounded-full"></span>
                                Thông tin hỗ trợ
                            </h2>

                            <div className="space-y-6">
                                {/* Item 1: Địa chỉ */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-2xl text-[#8E6D45] group-hover:bg-[#B8985D] group-hover:text-white transition-all duration-300">
                                        <MapPinIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-[#B8985D] transition-colors">Địa chỉ văn phòng</p>
                                        <p className="font-semibold text-zinc-700 leading-relaxed">Thanh Khê Thạc Gián, Quận Thanh Khê, TP. Đà Nẵng</p>
                                    </div>
                                </div>

                                {/* Item 2: Hotline */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-2xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                        <PhoneIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-emerald-600 transition-colors">Hotline tư vấn</p>
                                        <p className="font-bold text-zinc-800 text-lg tracking-wide">033 444 5555</p>
                                    </div>
                                </div>

                                {/* Item 3: Email */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-2xl text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                                        <EnvelopeIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-orange-600 transition-colors">Email hỗ trợ</p>
                                        <p className="font-semibold text-zinc-700">support@legalai.vn</p>
                                    </div>
                                </div>

                                {/* Item 4: Giờ làm việc */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-2xl text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                                        <ClockIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-indigo-600 transition-colors">Giờ làm việc</p>
                                        <p className="font-semibold text-zinc-700">Thứ 2 - Thứ 6: 08:00 - 18:00</p>
                                        <p className="text-sm text-[#8E6D45] italic mt-1 font-medium">Hỗ trợ AI 24/7 trên ứng dụng</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bản đồ */}
                        <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden h-64 grayscale hover:grayscale-0 transition-all duration-700 shadow-lg">
                            <iframe
                                title="map"
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3834.110435402535!2d108.20986531416955!3d16.05975803962638!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x314219b4c48979b9%3A0x6e9a6565155601d8!2zVGjhuqFjIEdpw6FuLCBUaGFuaCBLaMOqLCBEYSBOYW5nLCBWaWV0bmFt!5e0!3m2!1sen!2s!4v1645500000000!5m2!1sen!2s"
                                width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"
                                className="opacity-80 hover:opacity-100 transition-opacity"
                            ></iframe>
                        </div>
                    </aside>

                    {/* CỘT PHẢI: FORM */}
                    <section className="lg:col-span-7 bg-white rounded-[2rem] border border-zinc-200 p-8 md:p-12 shadow-lg">
                        <div className="flex items-center gap-4 mb-10">
                            {/* Icon gradient accent */}
                            <div className="p-3 bg-gradient-to-br from-[#B8985D] to-[#8E6D45] rounded-xl text-white shadow-lg shadow-[#B8985D]/20">
                                <PaperAirplaneIcon className="w-6 h-6 -rotate-45 translate-x-0.5 -translate-y-0.5" />
                            </div>
                            <h2 className="text-3xl font-black text-zinc-800 uppercase tracking-tight italic">Gửi yêu cầu hỗ trợ</h2>
                        </div>

                        {infoMessage && (
                            <div className="mb-6 p-4 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-between">
                                <div className="text-sm">{infoMessage}</div>
                                <button type="button" onClick={() => setInfoMessage('')} className="ml-4 px-3 py-1 bg-emerald-500 text-white rounded">Đóng</button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B8985D] transition-colors">Họ và tên</label>
                                    <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => handleChange('name', e.target.value)}
                                            onBlur={() => handleBlur('name')}
                                            className={`w-full px-5 py-4 bg-zinc-50 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all ${errors.name ? 'border-rose-500' : 'border border-zinc-200'}`}
                                            placeholder="Nguyễn Văn A"
                                        />
                                        {errors.name && <p className="text-rose-600 text-sm mt-1">{errors.name}</p>}
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B8985D] transition-colors">Địa chỉ Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        onBlur={() => handleBlur('email')}
                                        className={`w-full px-5 py-4 bg-zinc-50 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all ${errors.email ? 'border-rose-500' : 'border border-zinc-200'}`}
                                        placeholder="example@gmail.com"
                                    />
                                    {errors.email && <p className="text-rose-600 text-sm mt-1">{errors.email}</p>}
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B8985D] transition-colors">Số điện thoại</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        onBlur={() => handleBlur('phone')}
                                        className={`w-full px-5 py-4 bg-zinc-50 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all ${errors.phone ? 'border-rose-500' : 'border border-zinc-200'}`}
                                        placeholder="0912xxxxxx"
                                    />
                                    {errors.phone && <p className="text-rose-600 text-sm mt-1">{errors.phone}</p>}
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B8985D] transition-colors">Chủ đề cần hỗ trợ</label>
                                <div className="relative">
                                    <select
                                        value={formData.subject}
                                        className={`w-full px-5 py-4 bg-zinc-50 rounded-xl text-zinc-800 focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all appearance-none cursor-pointer hover:bg-zinc-100 ${errors.subject ? 'border-rose-500' : 'border border-zinc-200'}`}
                                        onChange={(e) => handleChange('subject', e.target.value)}
                                        onBlur={() => handleBlur('subject')}
                                    >
                                        <option className="bg-white text-zinc-800">Tư vấn hợp đồng bằng AI</option>
                                        <option className="bg-white text-zinc-800">Đặt lịch hẹn với luật sư</option>
                                        <option className="bg-white text-zinc-800">Hỗ trợ kỹ thuật tài khoản</option>
                                        <option className="bg-white text-zinc-800">Khác</option>
                                    </select>
                                    {errors.subject && <p className="text-rose-600 text-sm mt-1">{errors.subject}</p>}
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B8985D] transition-colors">Nội dung tin nhắn</label>
                                <textarea
                                    rows="6"
                                    required
                                    value={formData.message}
                                    onChange={(e) => handleChange('message', e.target.value)}
                                    onBlur={() => handleBlur('message')}
                                    className={`w-full px-5 py-4 bg-zinc-50 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all resize-none ${errors.message ? 'border-rose-500' : 'border border-zinc-200'}`}
                                    placeholder="Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải..."
                                ></textarea>
                                {errors.message && <p className="text-rose-600 text-sm mt-1">{errors.message}</p>}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-[#B8985D] to-[#8E6D45] text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] hover:scale-[1.01] hover:shadow-lg hover:shadow-[#B8985D]/25 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group"
                            >
                                <PaperAirplaneIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                Gửi thông tin ngay
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </div>
    );
}