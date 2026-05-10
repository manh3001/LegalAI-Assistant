import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import usePersistedState from '../hooks/usePersistedState';
import {
    PaperAirplaneIcon,
    DocumentArrowDownIcon,
    PrinterIcon,
    SparklesIcon,
    ChatBubbleLeftEllipsisIcon,
    DocumentMagnifyingGlassIcon,
    ArrowPathIcon,
    CheckBadgeIcon
} from '@heroicons/react/24/outline';
import aiClient from "../api/aiClient";

export default function FormGeneration() {
    // 1. STATE QUẢN LÝ CHAT & LƯU TRỮ
    const [messages, setMessages] = usePersistedState('formMessages', [
        { id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegAI. Bạn cần tạo hợp đồng gì? (VD: Soạn hợp đồng dịch vụ tư vấn pháp lý, tôi là Công ty A, MST 12345, phí dịch vụ 50 triệu...)' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    //  REF CHO TEXTAREA (nếu cần thao tác trực tiếp)
    const textAreaRef = useRef(null);
    // điều khiển ô nhập liệu ở đây
    useEffect(() => {
        const el = textAreaRef.current;
        if (el) {
            el.style.height = 'auto'; // Reset chiều cao
            el.style.height = el.scrollHeight + 'px'; // Nở ra theo nội dung
        }
    }, [inputValue]);

    // 2. STATE QUẢN LÝ BIỂU MẪU
    const [currentTemplate, setCurrentTemplate] = usePersistedState('currentFormTemplate', 'none'); // none, service_contract, labor_contract, lease_contract, blank
    const [formData, setFormData] = usePersistedState('formData', {
        ten_hop_dong: 'HỢP ĐỒNG DỊCH VỤ',
        can_cu_luat: [],
        benA_name: '', benA_id: '', benA_address: '', benA_phone: '', benA_rep: '',
        benB_name: '', benB_id: '', benB_address: '', benB_phone: '', benB_rep: '',
        noi_dung_chinh: '', gia_tri_hop_dong: '', thoi_han: ''
    });

    const handleFormChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            // Lấy tên hợp đồng từ extracted_data hoặc root, fallback về prev
            ten_hop_dong: aiData.extracted_data?.ten_hop_dong || aiData.ten_hop_dong || prev.ten_hop_dong,

            //  (Role)
            benA_role: aiData.extracted_data?.benA_role || 'BÊN A',
            benB_role: aiData.extracted_data?.benB_role || 'BÊN B',
            can_cu_luat: aiData.extracted_data?.can_cu_luat || [],

            // Gán trực tiếp từng trường, chấp nhận chuỗi rỗng "" để reset data cũ
            benA_name: aiData.extracted_data?.benA_name || '',
            benA_id: aiData.extracted_data?.benA_id || '',
            benA_address: aiData.extracted_data?.benA_address || '',
            benA_phone: aiData.extracted_data?.benA_phone || '',
            benA_rep: aiData.extracted_data?.benA_rep || '',

            benB_name: aiData.extracted_data?.benB_name || '',
            benB_id: aiData.extracted_data?.benB_id || '',
            benB_address: aiData.extracted_data?.benB_address || '',
            benB_phone: aiData.extracted_data?.benB_phone || '',
            benB_rep: aiData.extracted_data?.benB_rep || '',

            // Kéo thẳng mảng sections vào state
            sections: aiData.extracted_data?.sections || []
        }));
        setIsSaved(false); // Khi sửa tay thì cho phép lưu lại bản mới
    };

    // 3. HÀM GỬI TIN NHẮN & GỌI AI
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newUserMsg = { id: Date.now(), sender: 'user', text: inputValue };
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue('');
        setIsTyping(true);
        setIsSaved(false); // Reset trạng thái lưu khi bắt đầu hội thoại mới

        try {
            const chatHistory = messages.map(m => ({ role: m.sender, content: m.text }));
            const response = await aiClient.generateForm({
                text: inputValue,
                history: chatHistory
            });
            // tránh data bị undefined nếu API lỗi hoặc trả về không đúng
            const aiData = response?.data || response;

            // Kiểm tra log ngay tại đây để xem cấu thực tế
            console.log("Dữ liệu AI trả về:", aiData);

            if (!aiData || Object.keys(aiData).length === 0) {
                throw new Error("Dữ liệu AI trống");
            }

            setCurrentTemplate(aiData?.template_type ?? 'none');

            setFormData(prev => {
                const newData = { ...prev };
                if (aiData.ten_hop_dong) newData.ten_hop_dong = aiData.ten_hop_dong;
                for (const key in aiData.extracted_data) {
                    if (aiData.extracted_data[key] && aiData.extracted_data[key].length > 0) {
                        newData[key] = aiData.extracted_data[key];
                    }
                }
                return newData;
            });

            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiData.chat_reply }]);
        } catch (error) {
            console.error("Lỗi AI Form:", error);
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'Hệ thống AI đang bận. Duy có thể điền tay vào biểu mẫu bên phải nhé!' }]);
        } finally {
            setIsTyping(false);
        }
    };

    // 4. HÀM LƯU VÀO SQL SERVER
    const handleSaveToHistory = async () => {
        if (currentTemplate === 'none') {
            alert("Vui lòng nhập thông tin để AI tạo biểu mẫu trước khi lưu.");
            return;


        }
        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            let userId = 1;
            try {
                const user = userStr ? JSON.parse(userStr) : null;
                userId = user?.id ?? user?.Id ?? user?.ID ?? 1;
            } catch (pErr) {
                console.error("Lỗi parse user data:", pErr);
            }

            const payload = {
                userId: userId,
                fileName: `${formData.ten_hop_dong || 'Bieu_mau'}.docx`,
                title: `Biểu mẫu: ${formData.ten_hop_dong}`,
                recordType: 'FORM',
                riskScore: null,
                content: JSON.stringify(formData)
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                alert(" Đã lưu biểu mẫu vào Kho lưu trữ số thành công!");
            }
        } catch (err) {
            console.error("Lỗi lưu Form:", err);
            alert(" Lỗi: " + (err.response?.status === 401 ? "Hết hạn phiên làm việc!" : "Không thể lưu."));
        } finally {
            setIsSaving(false);
        }
    };
    // hàm tạo mới chat và reset form về mặc định
    const handleNewChat = () => {
        if (window.confirm("Bản thảo hiện tại sẽ bị xóa (nếu chưa Lưu hồ sơ). Bạn có chắc muốn tạo mới?")) {
            // Reset về giá trị mặc định ban đầu
            setMessages([{ id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegAI. Bạn cần tạo hợp đồng gì?' }]);
            setCurrentTemplate('none');
            setFormData({
                ten_hop_dong: 'HỢP ĐỒNG DỊCH VỤ', can_cu_luat: [],
                benA_name: '', benA_id: '', benA_address: '', benA_phone: '', benA_rep: '',
                benB_name: '', benB_id: '', benB_address: '', benB_phone: '', benB_rep: '',
                sections: []
            });
            setInputValue('');
            setIsSaved(false);
        }
    };
    const handlePrint = () => window.print();
    const glassPanel = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl";

    const FieldInput = ({ label, field, placeholder }) => (
        <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-800 text-[13px] print:text-black min-w-[120px]">- {label}:</span>
            <input
                type="text"
                value={formData[field]}
                onChange={(e) => handleFormChange(field, e.target.value)}
                placeholder={placeholder}
                className="flex-1 border-b border-dashed border-gray-400 bg-transparent py-0.5 focus:outline-none focus:border-cyan-600 transition-colors font-medium text-[14px]"
            />
        </div>
    );

    return (

        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col md:flex-row gap-6 text-[#1A2530]">

            {/* ========================================================= */}
            {/* CỘT TRÁI: CHAT AI */}
            {/* ========================================================= */}

            <div className={`w-full md:w-[400px] lg:w-[450px] flex flex-col h-full bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl overflow-hidden flex-shrink-0`}>

                {/* Header Chat */}
                <div className="p-5 border-b border-zinc-200 bg-zinc-50 flex items-center gap-3">
                    <div className="p-2 bg-[#B8985D]/10 rounded-xl border border-[#B8985D]/20">
                        <SparklesIcon className="w-6 h-6 text-[#8E6D45] stroke-2" />
                    </div>
                    <div>
                        <h2 className="font-black text-lg text-[#1A2530]">Trợ lý Biểu mẫu</h2>
                        <p className="text-xs text-zinc-500 font-medium">Tự động điền Hợp đồng chuẩn</p>
                    </div>
                </div>
                <button
                    onClick={handleNewChat}
                    title="Bắt đầu hợp đồng mới"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-[#B8985D] hover:bg-[#B8985D]/10 transition-colors"
                >
                    <ArrowPathIcon className="w-4 h-4 stroke-2" />
                    TẠO MỚI
                </button>
                {/* Khung tin nhắn */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-zinc-50/50">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm font-medium leading-relaxed ${msg.sender === 'user'
                                ? 'bg-[#1A2530] text-white rounded-tr-none' // User: Đen than
                                : 'bg-white text-zinc-700 border border-zinc-200 rounded-tl-none'
                                }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {/* Hiệu ứng gõ chữ  */}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-none p-4 flex gap-1.5 shadow-sm">
                                <div className="w-2 h-2 bg-[#B8985D] rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-[#B8985D] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-[#B8985D] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Chat */}
                <div className="p-4 border-t border-zinc-200 bg-white">
                    <form onSubmit={handleSendMessage} className="relative flex items-end">
                        <textarea
                            ref={textAreaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Yêu cầu soạn hợp đồng..."
                            rows={1}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 pl-5 pr-14 text-sm font-medium focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 resize-none transition-all duration-200 custom-scrollbar placeholder:text-zinc-400 text-[#1A2530]"
                            style={{
                                minHeight: '56px',
                                maxHeight: '200px'
                            }}
                        />

                        <button type="submit" disabled={isTyping || !inputValue.trim()} className="absolute right-2 bottom-2 h-[40px] w-[40px] flex items-center justify-center rounded-xl bg-[#1A2530] hover:bg-[#B8985D] text-white disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors shadow-sm">
                            <PaperAirplaneIcon className="w-5 h-5 stroke-2" />
                        </button>
                    </form>
                </div>
            </div>

            {/* ========================================================= */}
            {/* CỘT PHẢI: TỜ A4 SOẠN THẢO */}
            {/* ========================================================= */}
            <div className={`flex-1 flex flex-col h-full bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl overflow-hidden relative print:bg-white print:text-black print:border-none print:shadow-none`}>

                {/* Header thanh công cụ */}
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center px-6 print:hidden">
                    <div className="flex items-center gap-2 text-[#1A2530]">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-[#B8985D] stroke-2" />
                        <span className="text-sm font-black uppercase tracking-widest">
                            {currentTemplate === 'none' ? 'Khu vực soạn thảo' : 'Bản thảo: Hợp Đồng'}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        {currentTemplate !== 'none' && (
                            <button onClick={handleSaveToHistory} disabled={isSaving || isSaved} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isSaved
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-[#1A2530] hover:bg-[#B8985D] text-white border border-transparent'
                                }`}>
                                {isSaving ? <ArrowPathIcon className="w-4 h-4 animate-spin stroke-2" /> : <CheckBadgeIcon className="w-4 h-4 stroke-2" />}
                                {isSaving ? "ĐANG LƯU..." : isSaved ? "ĐÃ LƯU" : "LƯU HỒ SƠ"}
                            </button>
                        )}
                        {/* Nút In/PDF */}
                        <button onClick={handlePrint} disabled={currentTemplate === 'none'} className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-[#B8985D] hover:text-[#B8985D] rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-sm">
                            <PrinterIcon className="w-4 h-4 stroke-2" /> In / PDF
                        </button>
                    </div>
                </div>

                {/* Nền đặt tờ A4 */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-zinc-100/80 print:bg-white custom-scrollbar">
                    {currentTemplate === 'none' ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                            <DocumentMagnifyingGlassIcon className="w-24 h-24 mb-4 stroke-1 opacity-50" />
                            <p className="text-lg font-semibold text-zinc-500">Trò chuyện với AI để sinh hợp đồng</p>
                        </div>
                    ) : (
                        // Tờ giấy A4
                        <div className="max-w-[210mm] mx-auto min-h-[297mm] bg-white text-gray-900 p-12 md:p-16 shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            <div className="text-center mb-8">
                                <h3 className="font-bold text-[15px] uppercase">Cộng hòa Xã hội Chủ nghĩa Việt Nam</h3>
                                <h4 className="font-bold text-[15px] underline mb-2">Độc lập - Tự do - Hạnh phúc</h4>
                                <p className="text-sm italic text-gray-600">------o0o------</p>
                            </div>
                            <div className="text-center mb-6">
                                <h1 className="text-xl font-black uppercase mb-1">
                                    <input type="text" value={formData.ten_hop_dong || ''} onChange={(e) => handleFormChange('ten_hop_dong', e.target.value)} className="w-full text-center bg-transparent focus:outline-none focus:bg-zinc-50 transition-colors" />
                                </h1>
                                <p className="text-sm text-gray-600 italic">Hôm nay, tại ........................................</p>
                            </div>

                            <div className="space-y-6 text-justify">
                                {formData.can_cu_luat && formData.can_cu_luat.length > 0 && (
                                    <div className="italic text-sm space-y-1 mb-4">
                                        <p className="font-semibold">- Căn cứ theo:</p>
                                        {formData.can_cu_luat.map((luat, idx) => (
                                            <p key={idx} className="ml-4">- {luat}</p>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <h2 className="font-bold uppercase mb-2">BÊN A ({formData.benA_role || 'BÊN THUÊ'}):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benA_name" />
                                            <FieldInput label="MST / CCCD" field="benA_id" />
                                            <FieldInput label="Địa chỉ" field="benA_address" />
                                            <FieldInput label="Điện thoại" field="benA_phone" />
                                            <FieldInput label="Đại diện" field="benA_rep" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="font-bold uppercase mb-2">BÊN B ({formData.benB_role || 'BÊN CUNG CẤP'}):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benB_name" />
                                            <FieldInput label="MST / CCCD" field="benB_id" />
                                            <FieldInput label="Địa chỉ" field="benB_address" />
                                            <FieldInput label="Điện thoại" field="benB_phone" />
                                            <FieldInput label="Đại diện" field="benB_rep" />
                                        </div>
                                    </div>
                                </div>

                                {/* RENDER MẢNG SECTIONS ĐỘNG */}
                                <div className="space-y-6 pt-4">
                                    {formData.sections && formData.sections.length > 0 ? (
                                        formData.sections.map((section, index) => (
                                            <div key={index} className="space-y-2">
                                                <h2 className="font-bold uppercase text-[15px]">{section.title}</h2>
                                                <textarea
                                                    value={section.content}
                                                    onChange={(e) => {
                                                        const newSections = [...formData.sections];
                                                        newSections[index].content = e.target.value;
                                                        handleFormChange('sections', newSections);
                                                    }}
                                                    className="w-full bg-transparent border-none hover:bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-[#B8985D]/50 rounded resize-none overflow-hidden leading-relaxed whitespace-pre-wrap transition-colors"
                                                    // Đếm số dấu xuống dòng (\n) để tính số hàng (rows) mặc định
                                                    rows={section.content ? section.content.split('\n').length + 1 : 3}
                                                    onInput={(e) => {
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-zinc-400 italic text-center py-10 font-medium">
                                            AI đang xử lý và phân tích các điều khoản hợp đồng...
                                        </div>
                                    )}
                                </div>

                                <div className="pt-16 pb-10 grid grid-cols-2 gap-8 text-center break-inside-avoid">
                                    <div>
                                        <h3 className="font-bold uppercase mb-1">Bên A</h3>
                                        <p className="text-[12px] italic text-gray-500 mb-20">(Ký và ghi rõ họ tên)</p>
                                        <p className="font-bold uppercase">{formData.benA_rep || formData.benA_name || '........................'}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold uppercase mb-1">Bên B</h3>
                                        <p className="text-[12px] italic text-gray-500 mb-20">(Ký và ghi rõ họ tên)</p>
                                        <p className="font-bold uppercase">{formData.benB_rep || formData.benB_name || '........................'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>
                {`
                    /* Thay đổi màu thanh cuộn sang tone Vàng Đồng / Xám */
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(184, 152, 93, 0.3); border-radius: 20px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(184, 152, 93, 0.6); }
                    @media print { body { background: white; } .print\\:hidden { display: none !important; } }
                `}
            </style>
        </div>
    );
}