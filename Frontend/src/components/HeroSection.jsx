import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroVideo from '../assets/videos/VideoProject2.mp4';

import {
    CpuChipIcon,
    CheckBadgeIcon,
    ClockIcon,
    UserGroupIcon,
    SparklesIcon,
    DocumentTextIcon,
    DocumentPlusIcon,
    PresentationChartLineIcon,
    ArrowDownIcon,
    MagnifyingGlassIcon,
    ArrowUpIcon,
    VideoCameraIcon,
    ChartBarIcon,
    ShieldExclamationIcon
} from '@heroicons/react/24/outline';

export default function HeroSection() {
    const navigate = useNavigate();

    const section4Ref = useRef(null);
    const [hideArrow, setHideArrow] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [isVideoReady, setIsVideoReady] = useState(false);

    useEffect(() => {
        const hasSeenIntro = sessionStorage.getItem('legai_intro_seen');
        if (hasSeenIntro) {
            setIsFirstLoad(false);
        } else {
            sessionStorage.setItem('legai_intro_seen', 'true');
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                setHideArrow(entry.isIntersecting);
            },
            {
                root: null,
                threshold: 0.2,
            }
        );

        if (section4Ref.current) {
            observer.observe(section4Ref.current);
        }

        return () => {
            if (section4Ref.current) observer.unobserve(section4Ref.current);
        };
    }, []);





    // --- DATA ---
    const stats = [
        { id: 1, label: "Hợp đồng phân tích", value: "1000+", icon: CpuChipIcon },
        { id: 2, label: "Độ chính xác AI", value: "98%", icon: CheckBadgeIcon },
        { id: 3, label: "Thời gian xử lý ", value: "< 10s", icon: ClockIcon },
        { id: 4, label: "Doanh nghiệp tin dùng", value: "100+", icon: UserGroupIcon },
    ];

    const features = [
        { title: "Rà soát Hợp đồng AI", desc: "Tự động phát hiện rủi ro, phân tích điều khoản và đối chiếu luật pháp Việt Nam hiện hành trong vài giây.", icon: DocumentTextIcon, color: "from-blue-500 to-cyan-400" },
        { title: "Tạo Biểu mẫu AI", desc: "Sử dụng công nghệ RAG để tự động khởi tạo văn bản pháp lý chuẩn xác theo yêu cầu riêng biệt của bạn.", icon: DocumentPlusIcon, color: "from-pink-500 to-rose-400" },
        { title: "Lập Kế hoạch AI", desc: "Agentic Workflow biến dữ liệu thô thành lộ trình chi tiết, đồng thời hỗ trợ xuất trực tiếp ra Slide thuyết trình.", icon: PresentationChartLineIcon, color: "from-purple-500 to-indigo-400" },
        { title: "Hồ sơ Pháp lý", desc: "Kho lưu trữ thông minh cho mọi văn bản, lịch sử phân tích và kết quả trò chuyện với AI của riêng bạn.", icon: UserGroupIcon, color: "from-emerald-500 to-teal-400" },
        { title: "Tra cứu Văn bản", desc: "Thư viện luật số hóa, giúp bạn truy xuất nhanh các điều khoản mà không cần tìm kiếm rời rạc trên Google.", icon: CpuChipIcon, color: "from-orange-500 to-amber-400" },
        { title: "Chatbot Tư vấn AI", desc: "Trò chuyện pháp luật với ngôn ngữ gần gũi như một cộng sự thực thụ, hỗ trợ giải đáp thắc mắc 24/7.", icon: SparklesIcon, color: "from-red-500 to-orange-400" },
        { title: "Xác thực Video", desc: "Tự động phân tích, tóm tắt và trích xuất nội dung pháp lý từ các clip short video trên YouTube.", icon: VideoCameraIcon, color: "from-violet-500 to-fuchsia-400" }

    ];

    // --- FRAMER MOTION VARIANTS (TỐI ƯU THEO SESSION) ---
    const animationState = (!isFirstLoad || isVideoReady) ? "visible" : "hidden"

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: isFirstLoad ? 0.2 : 0,
                delayChildren: isFirstLoad ? 0.3 : 0
            }
        }
    };

    const fadeUpItem = {
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 70,
                damping: 15,
                duration: isFirstLoad ? 0.8 : 0
            }
        }
    };


    return (
        <div className="w-full relative flex flex-col items-center selection:bg-cyan-500/30 overflow-x-hidden pb-20">
            <style>
                {`
                    @keyframes shinyFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
                    .text-glow-pink { filter: drop-shadow(0 0 15px rgba(255, 117, 140, 0.5)); }
                    .text-shadow-deep { filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.9)); }
                `}
            </style>


            {/* ==========================================================
    SECTION 1: HERO SPLIT-SCREEN (Lawyer Agency Edition)
========================================================== */}
            {/* CẬP NHẬT: Thêm min-h-screen và snap-start để đồng bộ cuộn */}
            <section className="relative w-full min-h-screen snap-start bg-[#f8f9fa] overflow-hidden z-20">

                {/* 1. VÙNG VIDEO (CHIẾM 60%) */}
                <div
                    className="absolute inset-y-0 left-0 w-[60%] z-0"
                    style={{
                        // Đường cắt sắc lẹm tạo tỷ lệ 6/4
                        clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)'
                    }}
                >
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto" // Ép trình duyệt ưu tiên tải video này ngay lập tức
                        onLoadedData={() => setIsVideoReady(true)} // Báo hiệu video đã sẵn sàng
                        className="w-full h-full object-cover transition-opacity duration-700"
                        // Hiệu ứng fade-in mượt mà cho chính cái video khi nó load xong
                        style={{ opacity: isVideoReady ? 1 : 0 }}
                    >
                        <source src={heroVideo} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-black/15"></div>
                </div>

                {/* 2. ĐƯỜNG VIỀN VÀNG ĐỒNG (Bronze Line) */}
                <div
                    className="absolute inset-y-0 left-0 w-[60.5%] z-[5] pointer-events-none hidden lg:block"
                    style={{
                        clipPath: 'polygon(100% 0, 100% 0, 85% 100%, 84.5% 100%)',
                        backgroundColor: '#B8985D'
                    }}
                ></div>

                {/* 3. VÙNG TEXT BÊN PHẢI (CHIẾM 40%) */}
                <div className="absolute inset-y-0 right-0 w-[40%] flex items-center justify-end z-10 pr-10 md:pr-16 lg:pr-24">
                    <motion.div
                        // CẬP NHẬT: Sử dụng biến animationState để tối ưu load 1 lần
                        initial={animationState}
                        animate="visible"
                        variants={staggerContainer}
                        className="text-right flex flex-col items-end"
                    >
                        {/* Dòng 1: WELCOME TO - Đổi sang font-semibold cho thanh thoát */}
                        <motion.span
                            variants={fadeUpItem}
                            className="text-2xl md:text-4xl font-semibold tracking-[0.3em] text-[#1A2530] mb-2 uppercase"
                        >
                            WELCOME TO
                        </motion.span>

                        {/* Dòng 2: LEGAL - Font Serif sang trọng + Màu vàng đồng Gold Agency */}
                        <motion.h1
                            variants={fadeUpItem}
                            style={{ fontFamily: "'Playfair Display', serif" }} // Dùng font có chân cho chữ LEGAL
                            className="text-6xl md:text-8xl lg:text-[9vw] font-semibold tracking-tighter leading-none"
                        >
                            <span
                                className="inline-block"
                                style={{
                                    background: 'linear-gradient(to bottom, #C5A880 0%, #B8985D 50%, #8E6D45 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                }}
                            >
                                LEGAL
                            </span>
                        </motion.h1>
                    </motion.div>
                </div>
            </section>
            {/* ==========================================================
                SECTION 2: GIỚI THIỆU HỆ THỐNG
            ========================================================== */}
            {/* CẬP NHẬT: Thêm min-h-screen, snap-start và overflow-hidden */}
            <section className="relative w-full min-h-screen snap-start bg-[#f8f9fa] flex flex-col justify-center overflow-hidden z-30">
                <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
                    <motion.div
                        className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-end"
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                    >
                        <div className="lg:col-span-7">
                            <motion.p
                                variants={fadeUpItem}
                                className="text-[18px] md:text-lg font-semibold uppercase tracking-[0.26em] text-[#B8985D]"
                            >
                                Giải pháp Legal Tech
                            </motion.p>
                            {/* Nhớ đảm bảo bạn đã có keyframes shinyFlow trong file CSS, hoặc thêm trực tiếp thẻ <style> này vào component */}
                            <style>{`
        @keyframes shinyFlow {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
        }
    `}</style>
                            <motion.h2
                                variants={fadeUpItem}
                                className="mt-5 text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[1.05] text-[#1A2530]"
                            >
                                {/* Dòng 1: Giữ nguyên cấu trúc inline-block */}
                                <span className="inline-block uppercase">HỆ THỐNG HỖ TRỢ PHÁP LÝ </span>

                                {/* Dòng 2: Rớt xuống tự nhiên, chữ nối tiếp nhau */}
                                <span className="block mt-1 md:mt-2">
                                    <span
                                        className="font-black"
                                        style={{
                                            background: 'linear-gradient(to right, #B8985D 0%, #fef08a 25%, #B8985D 50%, #fef08a 75%, #B8985D 100%)',
                                            backgroundSize: '200% auto',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            animation: 'shinyFlow 4s linear infinite',
                                            willChange: 'background-position',
                                        }}
                                    >
                                        TÍCH HỢP AI
                                    </span>
                                    {" "}rà soát hợp đồng
                                </span>
                            </motion.h2>
                        </div>

                        <div className="lg:col-span-5 lg:pb-1">
                            <motion.p
                                variants={fadeUpItem}
                                className="max-w-[62ch] text-base md:text-lg leading-relaxed text-zinc-600"
                            >
                                LegalBot kết hợp tra cứu theo ngữ nghĩa và phân tích điều khoản để bạn đi từ câu hỏi đến căn cứ nhanh hơn, nhưng vẫn giữ được khả năng rà soát và đối chiếu độc lập.
                            </motion.p>
                            <motion.p
                                variants={fadeUpItem}
                                className="mt-5 max-w-[62ch] text-base md:text-lg leading-relaxed text-zinc-600"
                            >
                                Trích dẫn, thuật ngữ, và ngữ cảnh được trình bày theo mạch đọc, giúp quyết định có cơ sở và dễ bàn giao trong nhóm.
                            </motion.p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ==========================================================
                SECTION 3: TÍNH NĂNG (Full 3D Ecosystem - Light Mode)
            ========================================================== */}
            {/* CẬP NHẬT: Thêm min-h-screen, snap-start và overflow-hidden */}
            <section className="relative w-full min-h-screen snap-start bg-[#f8f9fa] flex flex-col justify-center overflow-hidden z-20">

                {/* ================= STYLES ================= */}
                <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 7s ease-in-out infinite; }
        
        /* Viền chữ mờ (Hollow Watermark) */
        .text-hollow-agency {
            color: transparent;
            -webkit-text-stroke: 2px rgba(26, 37, 48, 0.05); 
        }
    `}</style>

                {/* ================= LAYER 0: NỀN TYPOGRAPHY (Z-0) ================= */}
                <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute top-[5%] md:top-[10%] left-0 w-full flex flex-col items-center justify-center text-center"
                    >
                        <h1
                            className="text-[28vw] md:text-[16vw] font-semibold tracking-tighter leading-none select-none uppercase"
                            style={{
                                background: 'linear-gradient(to bottom, #C5A880 0%, #B8985D 50%, #8E6D45 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                opacity: 1
                            }}
                        >
                            SYSTEM
                        </h1>
                    </motion.div>
                </div>

                {/* ================= LAYER 1: CÁC KHỐI LƠ LỬNG (Z-20) ================= */}
                {/* Đã sửa màu nền các khối nổi thành Trắng/Sáng để hợp Light Mode */}
                <div className="absolute inset-0 w-full max-w-7xl mx-auto pointer-events-none z-20 hidden lg:block">

                    {/* --- WIDGET TO TRÁI (Database) --- */}
                    <div className="absolute left-6 top-[32%] animate-float pointer-events-auto">
                        <div className="bg-white/80 backdrop-blur-xl border border-amber-500/30 p-5 rounded-[2rem] shadow-[0_15px_40px_rgba(245,158,11,0.1)] w-48 hover:bg-white hover:border-amber-400 transition-all cursor-default">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                                    <ChartBarIcon className="w-5 h-5 text-amber-500" />
                                </div>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Database</span>
                            </div>
                            <h4 className="text-2xl font-semibold text-[#1A2530] leading-none">14,203</h4>
                            <p className="text-[10px] text-zinc-400 mt-1 font-medium">Hợp đồng đã quét</p>
                            <div className="mt-4 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 w-[75%] shadow-[0_0_10px_#f59e0b]"></div>
                            </div>
                        </div>
                    </div>

                    {/* --- WIDGET TO PHẢI (Cảnh báo rủi ro) --- */}
                    <div className="absolute right-6 top-[28%] animate-float-slow pointer-events-auto">
                        <div className="bg-white/80 backdrop-blur-xl border border-rose-500/30 p-5 rounded-[2rem] shadow-[0_15px_40px_rgba(244,63,94,0.1)] w-56 hover:bg-white hover:border-rose-400 transition-all cursor-default">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-rose-500 blur-md opacity-30 animate-pulse"></div>
                                    <ShieldExclamationIcon className="w-5 h-5 text-rose-500 relative z-10" />
                                </div>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Cảnh báo rủi ro</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="border-l-2 border-rose-500 pl-3 relative group">
                                    <p className="text-[10px] text-[#1A2530] font-bold leading-tight">Điều khoản bảo mật</p>
                                    <p className="text-[9px] text-rose-500/80">Thiếu cam kết 2 chiều</p>
                                </div>
                                <div className="border-l-2 border-orange-400 pl-3 opacity-80">
                                    <p className="text-[10px] text-[#1A2530] font-bold leading-tight">Tranh chấp tài phán</p>
                                    <p className="text-[9px] text-zinc-400">Chưa rõ cơ quan</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- WIDGET MINI TRÁI (AI Confidence) --- */}
                    <motion.div animate={{ y: [0, -15, 0], rotate: [0, 2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[12%] left-[8%] md:left-[12%] bg-white/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-3 shadow-[0_10px_30px_rgba(16,185,129,0.15)] flex items-center gap-3 pointer-events-auto">
                        <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                            <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">AI Confidence</p>
                            <p className="text-sm font-semibold text-emerald-600">99.8%</p>
                        </div>
                    </motion.div>

                    {/* --- WIDGET MINI PHẢI (Tốc độ quét) --- */}
                    <motion.div animate={{ y: [0, 15, 0], rotate: [0, -2, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-[10%] right-[8%] md:right-[12%] bg-white/90 backdrop-blur-md border border-fuchsia-500/40 rounded-2xl p-3 shadow-[0_10px_30px_rgba(217,70,239,0.15)] flex items-center gap-3 pointer-events-auto">
                        <div className="p-1.5 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                            <ClockIcon className="w-4 h-4 text-fuchsia-600" />
                        </div>
                        <div>
                            <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Tốc độ quét</p>
                            <p className="text-sm font-semibold text-fuchsia-600">1.2s / Trang</p>
                        </div>
                    </motion.div>

                </div>

                {/* ================= LAYER 2: INTERACTIVE DOCK & HEADER (Z-50) ================= */}
                <div className="relative z-50 flex flex-col w-full h-full justify-between mt-10">
                    {/* DOCK WRAPPER */}
                    <div className="w-full flex justify-center pt-40 pb-10">
                        {/* Đổi màu Dock thành nền trắng kính mờ */}
                        <motion.div variants={fadeUpItem} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="relative inline-flex flex-wrap justify-center items-end gap-3 md:gap-6 bg-white/60 border border-zinc-200 rounded-[2.5rem] px-6 md:px-10 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.05)] backdrop-blur-xl">
                            {features.map((item, idx) => (
                                <div key={idx} className="relative group flex flex-col items-center justify-end cursor-pointer">

                                    {/* TOOLTIP ĐỔI SANG LIGHT MODE */}
                                    <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-[260px] opacity-0 translate-y-8 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out z-[60]">
                                        <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col items-start text-left relative">
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-zinc-200 rotate-45"></div>
                                            <h3 className="text-base font-semibold text-[#1A2530] mb-2 uppercase tracking-tight group-hover:text-[#B8985D] transition-colors">{item.title}</h3>
                                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">{item.desc}</p>
                                        </div>
                                    </div>

                                    {/* ICON - Giữ nguyên mảng màu gradient nhưng bỏ border trắng */}
                                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[1.2rem] flex items-center justify-center bg-gradient-to-br ${item.color} shadow-lg transition-transform duration-300 ease-out origin-bottom group-hover:scale-[1.4] group-hover:-translate-y-4 group-hover:shadow-xl`}>
                                        <item.icon className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-sm" />
                                    </div>
                                    {/* Chấm vàng thay vì chấm xanh */}
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#B8985D] opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-[0_0_8px_#B8985D]"></div>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>
            {/* ==========================================================
                SECTION 4: GIỚI THIỆU & THỐNG KÊ (Snap & Responsive)
            ========================================================== */}
            {/* CẬP NHẬT: Thêm min-h-screen, snap-start, flex căn giữa và bg */}
            <section className="relative w-full min-h-screen snap-start bg-[#f8f9fa] flex flex-col justify-center py-20 z-20 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-20 items-start">
                        {/* CỘT TRÁI: Dính (Sticky) */}
                        <motion.div
                            className="lg:col-span-5 lg:sticky lg:top-40"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.1, margin: "-100px" }}
                            variants={staggerContainer}
                        >
                            <div className="relative pl-6">
                                <div className="absolute left-0 top-1 bottom-1 w-px bg-[linear-gradient(180deg,rgba(184,152,93,0.95),rgba(26,37,48,0.25),transparent)] opacity-70"></div>

                                <motion.p
                                    variants={fadeUpItem}
                                    className="text-[18px] uppercase tracking-[0.26em] text-[#B8985D] font-bold"
                                >
                                    Về LegalBot
                                </motion.p>

                                <motion.h2
                                    variants={fadeUpItem}
                                    className="mt-5 text-3xl md:text-5xl font-semibold  tracking-[-0.04em] leading-[1.08] text-[#1A2530]"
                                >
                                    Trợ lý pháp lý cho quyết định nhanh, có căn cứ.
                                </motion.h2>

                                <motion.p
                                    variants={fadeUpItem}
                                    className="mt-6 max-w-[62ch] text-base md:text-lg leading-relaxed text-zinc-600 font-medium"
                                >
                                    LegalBot ưu tiên sự minh bạch: kết quả đi kèm ngữ cảnh và trích dẫn, để bạn kiểm tra lại nhanh, thảo luận trong nhóm, và lưu vết ra quyết định một cách nhất quán.
                                </motion.p>

                                <motion.ul
                                    variants={fadeUpItem}
                                    className="mt-8 max-w-[62ch] list-disc pl-5 space-y-3 text-sm md:text-base leading-relaxed text-zinc-600 font-medium marker:text-[#B8985D]"
                                >
                                    <li>Tìm điều khoản theo ngữ nghĩa, không phụ thuộc từ khóa chính xác.</li>
                                    <li>Đối chiếu theo ngữ cảnh, giảm bỏ sót khi rà soát nhanh.</li>
                                    <li>Lưu lịch sử phân tích theo hồ sơ, thuận tiện bàn giao và kiểm toán nội bộ.</li>
                                </motion.ul>
                            </div>
                        </motion.div>

                        {/* CỘT PHẢI: Thống kê (Typography-first) */}
                        <motion.div
                            className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12 mt-10 lg:mt-0"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.1 }}
                            variants={staggerContainer}
                        >
                            {stats.map((stat, idx) => (
                                <motion.div
                                    key={stat.id}
                                    variants={fadeUpItem}
                                    className={`relative pl-7 pr-2 ${idx % 2 !== 0 ? 'md:pt-10' : ''}`}
                                >
                                    <div className="absolute left-0 top-2.5 h-2 w-2 rounded-full bg-[#B8985D] opacity-90"></div>
                                    <div className="flex items-start justify-between gap-6">
                                        <p className="text-[11px] md:text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                                            {stat.label}
                                        </p>
                                        <stat.icon className="w-5 h-5 text-[#B8985D] opacity-80 stroke-[2px]" />
                                    </div>
                                    <p className="mt-3 text-5xl md:text-6xl font-semibold tracking-[-0.04em] leading-none text-[#1A2530] tabular-nums">
                                        {stat.value}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

           {/* ==========================================================
                SECTION 5: IMMERSIVE CTA (Snap & Background Fixed)
            ========================================================== */}
            <section ref={section4Ref} className="relative w-full min-h-screen snap-start bg-[#f8f9fa] flex flex-col justify-center items-center overflow-hidden z-20 py-10">
                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUpItem}
                    
                    className="relative w-full max-w-7xl mx-auto px-6 md:px-12 py-20 text-left bg-white border border-[#B8985D] rounded-[2.5rem] shadow-[0_20px_60px_rgba(184,152,93,0.15)] overflow-hidden"
                >
                    
                    <div className="absolute inset-0 -z-10 pointer-events-none">
                      
                        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_20%,rgba(184,152,93,0.25),transparent_60%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_40%,rgba(26,37,48,0.03),transparent_55%)]"></div>
                        
                     
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#B8985D] to-transparent opacity-80"></div>
                    </div>
                    
                  

                    {/* Sử dụng CSS Grid để chia 2 cột */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">

                        {/* CỘT TRÁI: Tiêu đề & Form Đăng ký */}
                        <div className="flex flex-col items-start">
                            <p className="text-[11px] md:text-xs font-bold uppercase tracking-[0.26em] text-[#B8985D]">
                                Dùng thử sớm
                            </p>
                            <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold text-[#1A2530] tracking-[-0.04em] mb-6 leading-[1.08]">
                                Nhận lịch mời trải nghiệm
                                <br className="hidden md:block" />
                                <span className="text-[#B8985D]"> LegalBot</span>
                            </h2>

                            <p className="text-zinc-600 text-base md:text-lg font-medium leading-relaxed mb-10 max-w-[62ch]">
                                Để lại email để nhận cập nhật lộ trình và ưu tiên mời dùng thử theo đợt. Chúng tôi gửi thông tin ngắn gọn, tập trung vào thay đổi quan trọng.
                            </p>

                            {/* Form Đăng ký (Pill Input)  */}
                            <form className="w-full max-w-md flex items-center rounded-full bg-[#B8985D]/20 p-1.5 border border-[#B8985D]/40 shadow-sm transition-all duration-300 focus-within:bg-white focus-within:border-[#B8985D] focus-within:ring-1 focus-within:ring-[#B8985D] focus-within:shadow-[0_0_20px_rgba(184,152,93,0.3)]">
                                <input
                                    type="email"
                                    placeholder="Email công việc"
                                    required
                                    className="flex-1 bg-transparent px-5 py-3 text-[#1A2530] text-sm md:text-base font-medium focus:outline-none placeholder:text-zinc-500 w-full"
                                />
                                <button
                                    type="submit"
                                    className="bg-[#1A2530] text-white px-6 py-3 rounded-full font-bold text-sm md:text-base flex items-center gap-2 hover:bg-[#B8985D] transition-colors duration-300 shrink-0 shadow-md"
                                >
                                    Nhận truy cập sớm <span aria-hidden="true">✦</span>
                                </button>
                            </form>
                        </div>

                        {/* CỘT PHẢI: 3 điểm chính (đánh số) */}
                        <ol className="flex flex-col space-y-10">

                            {/* Dòng 1 */}
                            <li className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 items-start group">
                                <div className="text-lg md:text-xl font-black tracking-[0.1em] text-zinc-400 group-hover:text-[#B8985D] transition-colors duration-300 tabular-nums pt-0.5">
                                    01
                                </div>
                                <p className="text-zinc-600 text-sm md:text-base leading-relaxed font-medium group-hover:text-[#1A2530] transition-colors duration-300">
                                    Ưu tiên mời dùng thử Agentic Workflow và RAG đa nguồn theo nhóm nhỏ, tập trung đúng nghiệp vụ.
                                </p>
                            </li>

                            {/* Dòng 2 */}
                            <li className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 items-start group">
                                <div className="text-lg md:text-xl font-black tracking-[0.1em] text-zinc-400 group-hover:text-[#B8985D] transition-colors duration-300 tabular-nums pt-0.5">
                                    02
                                </div>
                                <p className="text-zinc-600 text-sm md:text-base leading-relaxed font-medium group-hover:text-[#1A2530] transition-colors duration-300">
                                    Nhận tài liệu cập nhật ngắn gọn, giúp bạn đánh giá khả năng áp dụng vào quy trình hiện tại.
                                </p>
                            </li>

                            {/* Dòng 3 */}
                            <li className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 items-start group">
                                <div className="text-lg md:text-xl font-black tracking-[0.1em] text-zinc-400 group-hover:text-[#B8985D] transition-colors duration-300 tabular-nums pt-0.5">
                                    03
                                </div>
                                <p className="text-zinc-600 text-sm md:text-base leading-relaxed font-medium group-hover:text-[#1A2530] transition-colors duration-300">
                                    Gửi phản hồi để chúng tôi tinh chỉnh cách trình bày trích dẫn và ngữ cảnh, tăng độ tin cậy khi sử dụng.
                                </p>
                            </li>
                        </ol>
                    </div>
                </motion.div>
            </section>
            {/* ==========================================================
                MŨI TÊN CUỘN 
            ========================================================== */}
            <div
                onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
                className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 z-50 cursor-pointer hover:text-cyan-400 hover:scale-110 ${hideArrow ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 animate-bounce'}`}
            >
                <ArrowDownIcon className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] bg-black/30 p-1.5 rounded-full backdrop-blur-md border border-white/10" />
            </div>
        </div>
    );
}
