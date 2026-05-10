import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    CpuChipIcon,
    SparklesIcon,
    UserIcon,
    ArrowPathIcon,
    CloudArrowUpIcon,
    CheckBadgeIcon
} from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';
import LawyerCard from './LawyerCard';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState('ai');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Khởi tạo tin nhắn chào mừng
    useEffect(() => {
        setIsSaved(false);
        
        // Dùng 'prev' để kiểm tra trạng thái hiện tại trước khi hành động
        setMessages(prev => {
         
            // TUYỆT ĐỐI KHÔNG được reset mảng. Giữ nguyên đoạn chat!
            if (prev && prev.length > 1) {
                return prev;
            }

            // Nếu mảng đang trống (hoặc chỉ mới có câu chào cũ), thì mới khởi tạo
            if (chatMode === 'ai') {
                return [
                    { id: 'ai-init', text: "Chào bạn! Tôi là LegalAI. Bạn cần thẩm định hay tư vấn điều khoản nào?", isBot: true }
                ];
            } else {
                return [
                    { id: 'human-init', text: "Chào bạn! Bạn đã kết nối với chế độ Luật sư. Vui lòng mô tả vấn đề của bạn.", isBot: true }
                ];
            }
        });
    }, [chatMode]);

    // Tự động cuộn xuống tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Tự động giãn Textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // --- HÀM LƯU HỘI THOẠI VÀO SQL ---
    const handleSaveChat = async () => {
        if (messages.length < 2) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 };
            const userId = user.id ?? user.Id ?? user.ID;

            // Lấy tin nhắn đầu tiên của User làm tiêu đề
            const firstUserMsg = messages.find(m => !m.isBot)?.text || "Cuộc trò chuyện mới";
            const displayTitle = firstUserMsg.length > 35 ? firstUserMsg.substring(0, 35) + "..." : firstUserMsg;

            const payload = {
                userId: userId,
                fileName: `Chat_${Date.now()}.json`,
                title: `Thảo luận: ${displayTitle}`,
                recordType: 'CHAT', // Nhãn để hiện Icon bóng thoại xanh lá
                riskScore: null,
                content: JSON.stringify(messages) // Lưu toàn bộ mảng tin nhắn
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
            }
        } catch (err) {
            console.error("Lỗi lưu Chat:", err);
            alert("❌ Không thể lưu hội thoại. Vui lòng kiểm tra đăng nhập.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), text: input, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        const question = input;
        setInput("");
        setIsLoading(true);
        setIsSaved(false);

        try {
            if (chatMode === 'ai') {
                const res = await aiClient.ask(question);
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: res.answer || "Tôi đang học hỏi thêm về vấn đề này, bạn có thể nói rõ hơn không?",
                    isBot: true
                }]);
            } else {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        text: "🔔 Đã gửi yêu cầu đến Luật sư trực. Vui lòng giữ kết nối trong ít phút.",
                        isBot: true
                    }]);
                    setIsLoading(false);
                }, 1500);
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Server LegAI đang bận, thử lại sau nhé bạn.", isBot: true }]);
        } finally {
            if (chatMode === 'ai') setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;
   // =========================================================================
    // HÀM  Xử lý mọi cấu trúc JSON từ Gemini trả về
    // =========================================================================
    const formatAIMessage = (text) => {
        if (!text) return "";
        
        try {
            const parsed = JSON.parse(text);
            
            // 1. CHẶN NGAY LỖI CHỮ "C": Nếu JSON trả về là mảng chuỗi ["Chào bạn..."] 
            // hoặc chuỗi trực tiếp "Chào bạn...", thì nối lại và trả về luôn.
            if (typeof parsed === 'string') return parsed;
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                return parsed.join('\n');
            }

            const data = Array.isArray(parsed) ? parsed[0] : parsed;

            // Đảm bảo data là một Object thì mới bắt đầu trích xuất Key
            if (typeof data !== 'object' || data === null) {
                return String(data);
            }

            // 2. KIỂM TRA TRƯỜNG HỢP CÂU HỎI PHÁP LÝ (Có các key chuẩn)
            const ketLuan = data["Kết luận"] || data["ket_luan"] || data["ketLuan"] || "";
            const phanTich = data["Phân tích"] || data["phan_tich"] || data["phanTich"] || "";
            const coSo = data["Cơ sở pháp lý"] || data["co_so_phap_ly"] || data["coSoPhapLy"] || "";
            const loiKhuyen = data["Lời khuyên"] || data["loi_khuyen"] || data["loiKhuyen"] || "";

            if (ketLuan || phanTich || coSo || loiKhuyen) {
                let mdText = "";
                if (ketLuan) mdText += `⚖️ **Kết luận:**\n${ketLuan}\n\n`;
                if (phanTich) mdText += `🔍 **Phân tích:**\n${phanTich}\n\n`;
                
                if (coSo) {
                    mdText += `📚 **Cơ sở pháp lý:**\n`;
                    if (Array.isArray(coSo)) {
                        coSo.forEach(item => mdText += `- ${item}\n`);
                    } else {
                        mdText += `${coSo}\n`;
                    }
                    mdText += `\n`;
                }
                
                if (loiKhuyen) mdText += `💡 **Lời khuyên:**\n${loiKhuyen}\n\n`;
                
                return mdText.trim();
            }

            // 3. KIỂM TRA TRƯỜNG HỢP GIAO TIẾP THÔNG THƯỜNG BỊ BỌC JSON LẠ
            // AI bị ép trả JSON nên sẽ tự bịa ra các key 
            const fallbackText = data["text"] || data["message"] || data["response"] || data["reply"] || data["câu_trả_lời"] || data["phản_hồi"] || data["Phản hồi"];
            if (fallbackText) return fallbackText;

            // Nếu nó tạo ra key lạ, lôi ra Value là String đầu tiên (tránh lấy nhầm Array/Object)
            const firstStringValue = Object.values(data).find(val => typeof val === 'string' && val.trim() !== '');
            if (firstStringValue) return firstStringValue;

            // Bí quá không bóc được thì in nguyên gốc
            return text;

        } catch (e) {
            // Nếu JSON.parse báo lỗi -> Nghĩa là AI trả về text/markdown bình thường.
            return text;
        }
    };
    return (
    <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
      
        className="fixed bottom-24 right-4 md:right-8 w-[95vw] md:w-[420px] h-[min(600px,75vh)] z-[101] flex flex-col pointer-events-auto"
    >
        <div className="flex-grow flex flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/95 backdrop-blur-3xl shadow-[0_20px_40px_rgba(15,23,42,0.08)]">

            {/* HEADER  */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/15">
                            <CpuChipIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-900 tracking-[0.3em] uppercase">LegAI Assistant</h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {messages.length > 1 && (
                            <button 
                                onClick={handleSaveChat}
                                className="p-2 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-slate-100 transition-all"
                            >
                                <CloudArrowUpIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* SWITCHER */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 relative h-10">
                    <button className="flex-1 flex items-center justify-center gap-2 text-[10px] font-black text-sky-600 z-10">
                        <SparklesIcon className="w-3.5 h-3.5" /> AI CONSULTANT
                    </button>
                </div>
            </div>

            {/* CHAT BODY - Vùng này sẽ tự cuộn độc lập */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50 overscroll-contain">
                <AnimatePresence mode='popLayout'>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                msg.isBot 
                                ? 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200' 
                                : 'bg-gradient-to-br from-sky-600 to-blue-600 text-white rounded-tr-none shadow-lg shadow-sky-200/40'
                            }`}>
                               
                                {msg.isBot ? (
                                    msg.text.replace(/"/g, '').trim() === "[CONTACT_LAWYER]" ? (
                                        <LawyerCard />
                                    ) : (
                                        <div className="prose max-w-none text-sm break-words markdown-chat">
                                            <ReactMarkdown>
                                                {formatAIMessage(msg.text)}
                                            </ReactMarkdown>
                                        </div>
                                    )
                                ) : (
                                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {isLoading && <div className="text-[10px] text-sky-600/70 font-black animate-pulse px-2 uppercase">Processing...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <form onSubmit={handleSend} className="p-5 bg-slate-50 border-t border-slate-200 shrink-0">
                <div className="relative flex items-end gap-2 bg-white border border-slate-200 rounded-3xl px-4 py-2 focus-within:border-sky-500/40 transition-all">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Hỏi LegAI..."
                        className="flex-grow py-3 bg-transparent text-sm text-slate-900 outline-none resize-none scrollbar-hide max-h-[100px]"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className={`mb-2 p-2 rounded-xl transition-all ${!input.trim() || isLoading ? 'text-slate-400' : 'text-sky-600'}`}
                    >
                        <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                    </button>
                </div>
            </form>
        </div>
    </motion.div>
);
}