import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

export default function LawyerCard() {
    const [lawyer, setLawyer] = useState(null);

    useEffect(() => {
        // Tự động gọi API lấy 1 luật sư ngẫu nhiên từ Database
        axios.get(`${API_URL}/ai/lawyers/random`)
            .then(res => {
                if (res.data.success) {
                    setLawyer(res.data.data);
                }
            })
            .catch(err => console.error("Lỗi khi lấy thông tin luật sư:", err));
    }, []);

    // Nếu chưa load được data thì không hiển thị gì để tránh làm xấu giao diện Chatbot
    if (!lawyer) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center my-2 max-w-[300px] mx-auto animate-in fade-in zoom-in duration-300">
            {/* Tên Luật Sư */}
            <h4 className="font-bold text-slate-900 text-lg mb-1">
                {lawyer.FullName}
            </h4>
            
            {/* Chuyên môn - Sử dụng màu Vàng Đồng LegAI */}
            <p className="text-[10px] text-[#B8985D] uppercase font-black tracking-[0.15em] mb-4">
                {lawyer.Specialty}
            </p>
            
            {/* Box Số điện thoại nổi bật */}
            <div className="py-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 group hover:bg-amber-50 hover:border-amber-200 transition-colors">
                <p className="text-sm font-black text-slate-700 group-hover:text-[#8E6D45]">
                    <span className="mr-2 opacity-70">📞</span>
                    {lawyer.Phone}
                </p>
            </div>
            
            {/* Nút Liên hệ */}
            <button className="w-full py-2.5 bg-[#1A2530] text-white text-[11px] font-black rounded-xl hover:bg-[#B8985D] transition-all uppercase tracking-widest shadow-md active:scale-95">
                Liên Hệ Tư Vấn
            </button>
            
            {/* Chú thích nhỏ */}
            <p className="text-[9px] text-slate-400 mt-3 italic leading-relaxed">
                * Kết nối trực tiếp với chuyên gia để xử lý các vấn đề pháp lý phức tạp
            </p>
        </div>
    );
}