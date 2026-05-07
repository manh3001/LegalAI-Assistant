import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    SparklesIcon,
    CloudArrowUpIcon,
    CheckBadgeIcon,
    PlusIcon // Icon tạo cuộc trò chuyện mới
} from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Khởi tạo tin nhắn chào mừng (Chỉ còn AI)
    useEffect(() => {
        setIsSaved(false);
        setMessages([
            { id: 'ai-init', text: "Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?", isBot: true }
        ]);
    }, []);

    // Tự động cuộn
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

    // --- HÀM TẠO CUỘC TRÒ CHUYỆN MỚI ---
    const handleNewChat = () => {
        // Cảnh báo nếu có data mà chưa lưu
        if (messages.length > 1 && !isSaved) {
            const confirm = window.confirm("Phiên chat hiện tại chưa được lưu vào Hồ sơ. Bạn có chắc chắn muốn tạo cuộc trò chuyện mới?");
            if (!confirm) return;
        }

        setMessages([
            { id: 'ai-init', text: "Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?", isBot: true }
        ]);
        setInput("");
        setIsSaved(false);
        setIsLoading(false);
    };

    // --- HÀM LƯU HỘI THOẠI VÀO SQL ---
    const handleSaveChat = async () => {
        if (messages.length < 2) return;

        if (isSaved) {
            toast.error("Phiên chat này đã được lưu rồi!");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 };
            const userId = user.id ?? user.Id ?? user.ID;

            const firstUserMsg = messages.find(m => !m.isBot)?.text || "Cuộc trò chuyện mới";
            const displayTitle = firstUserMsg.length > 35 ? firstUserMsg.substring(0, 35) + "..." : firstUserMsg;

            const payload = {
                userId: userId,
                fileName: `Chat_${Date.now()}.json`,
                title: `Thảo luận: ${displayTitle}`,
                recordType: 'CHAT',
                riskScore: null,
                content: JSON.stringify(messages)
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                toast.success("Đã lưu phiên trò chuyện!");
            }
        } catch (err) {
            console.error("Lỗi lưu Chat:", err);
            toast.error("Không thể lưu hội thoại. Vui lòng thử lại sau.");
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
            const res = await aiClient.ask(question);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: res.answer || "Tôi đang học hỏi thêm về vấn đề này, bạn có thể nói rõ hơn không?",
                isBot: true
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Server LegAI đang bận, thử lại sau nhé bạn.", isBot: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

   const formatAIMessage = (text) => {
        if (!text) return "";
        let content = text;

        // BƯỚC 1: BÓC VỎ JSON (Xử lý mọi biến thể JSON AI có thể trả về)
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'string') {
                content = parsed;
            } else if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                content = parsed.join('\n');
            } else if (typeof parsed === 'object' && parsed !== null) {
                // Kiểm tra xem nó có chia thành các key JSON rời rạc không
                const ketLuan = parsed["Kết luận"] || parsed["ket_luan"] || parsed["ketLuan"] || "";
                const phanTich = parsed["Phân tích"] || parsed["phan_tich"] || parsed["phanTich"] || "";
                const coSo = parsed["Cơ sở pháp lý"] || parsed["co_so_phap_ly"] || parsed["coSoPhapLy"] || "";
                const loiKhuyen = parsed["Lời khuyên"] || parsed["loi_khuyen"] || parsed["loiKhuyen"] || "";

                if (ketLuan || phanTich || coSo || loiKhuyen) {
                    let mdText = "";
                    if (ketLuan) mdText += `**Kết luận:**\n${ketLuan}\n\n`;
                    if (phanTich) mdText += `**Phân tích:**\n${phanTich}\n\n`;
                    if (coSo) {
                        mdText += `**Cơ sở pháp lý:**\n`;
                        if (Array.isArray(coSo)) coSo.forEach(item => mdText += `- ${item}\n`);
                        else mdText += `${coSo}\n`;
                        mdText += `\n`;
                    }
                    if (loiKhuyen) mdText += `**Lời khuyên:**\n${loiKhuyen}\n\n`;
                    content = mdText.trim();
                } else {
                    // NẾU LÀ DẠNG { "answer": "Nội dung..." } -> Bóc lấy nội dung bên trong
                    content = parsed.answer || parsed.text || parsed.message || parsed.response || Object.values(parsed)[0] || text;
                }
            }
        } catch (e) {
            // Nếu không phải JSON (AI trả về Text thuần), giữ nguyên để xử lý tiếp
            content = text;
        }

        // Đảm bảo dữ liệu đầu ra là chuỗi String
        if (typeof content !== 'string') content = String(content);

        // BƯỚC 2: TỰ ĐỘNG ÉP ĐỊNH DẠNG TIÊU ĐỀ (Xử lý cả text thô và icon cũ)
       const titles = [
            { key: 'Kết luận', icon: '⚖️' },
            { key: 'Phân tích', icon: '🔍' },
            { key: 'Cơ sở pháp lý', icon: '📚' },
            { key: 'Lời khuyên', icon: '💡' }
        ];

        titles.forEach(item => {
            // Regex này quét sạch icon cũ (nếu có) và ép về định dạng **Tiêu đề:** xuống dòng
            const regex = new RegExp(`^(\\s*|[⚖️🔍📚💡]\\s*|\\*\\*)*${item.key}(:?\\s*|:?\\*\\*\\s*)?`, 'gmi');
            content = content.replace(regex, `**${item.key}:**\n`); 
        });
        // BƯỚC 3: XỬ LÝ MIỄN TRỪ TRÁCH NHIỆM (Disclaimer)
        content = content.replace(/Nội dung do LegAI cung cấp.*/gi, (match) => `\n\n---\n*${match}*`);

        // BƯỚC 4: DỌN DẸP KHOẢNG TRẮNG THỪA (Tối đa 2 lần xuống dòng để tránh giãn quá rộng)
        content = content.replace(/\n{3,}/g, '\n\n').trim();

        return content;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 md:right-8 w-[95vw] md:w-[420px] h-[min(600px,75vh)] z-[101] flex flex-col pointer-events-auto"
        >

            <div className="flex-grow flex flex-col overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)]">

                {/* HEADER */}
                <div className="p-5 border-b border-zinc-100 bg-zinc-50/80 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[#B8985D]/10 border border-[#B8985D]/20">
                                <SparklesIcon className="w-5 h-5 text-[#8E6D45]" />
                            </div>
                            <h3 className="text-[11px] font-black text-[#1A2530] tracking-[0.2em] uppercase">AI Assistant</h3>
                        </div>

                        <div className="flex items-center gap-1">
                            {/* NÚT NEW CHAT */}
                            <button
                                onClick={handleNewChat}
                                title="Tạo cuộc trò chuyện mới"
                                className="p-2 rounded-xl text-zinc-400 hover:text-[#B8985D] hover:bg-[#B8985D]/10 transition-colors"
                            >
                                <PlusIcon className="w-5 h-5 stroke-2" />
                            </button>

                            {messages.length > 1 && (
                                <button
                                    onClick={handleSaveChat}
                                    disabled={isSaving || isSaved}
                                    title={isSaved ? "Đã lưu" : "Lưu phiên chat"}
                                    className={`p-2 rounded-xl transition-all ${isSaved
                                        ? 'text-emerald-500 bg-emerald-50 cursor-not-allowed'
                                        : 'text-zinc-400 hover:text-[#B8985D] hover:bg-[#B8985D]/10'
                                        }`}
                                >
                                    {isSaved ? <CheckBadgeIcon className="w-5 h-5 stroke-2" /> : <CloudArrowUpIcon className="w-5 h-5 stroke-2" />}
                                </button>
                            )}
                            <button onClick={onClose} title="Đóng" className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl text-zinc-400 transition-colors">
                                <XMarkIcon className="w-5 h-5 stroke-2" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* CHAT BODY */}
                <div className="flex-1 p-5 overflow-y-auto space-y-5 custom-scrollbar bg-zinc-50/50 overscroll-contain">
                    <AnimatePresence mode='popLayout'>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed font-medium shadow-sm ${msg.isBot
                                    ? 'bg-white text-zinc-700 border border-zinc-200 rounded-tl-none'
                                    : 'bg-[#1A2530] text-white rounded-tr-none'
                                    }`}>

                                    {msg.isBot ? (

                                        <div className="prose prose-sm max-w-none text-zinc-700 break-words prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1.5 prose-hr:my-3">
                                            <ReactMarkdown>
                                                {formatAIMessage(msg.text)}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* HIỆU ỨNG LOADING  */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-none p-4 flex gap-1.5 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-[#B8985D] rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-[#B8985D] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-[#B8985D] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT AREA */}
                <div className="p-4 bg-white border-t border-zinc-200 shrink-0 rounded-b-[2.5rem]">
                    <form onSubmit={handleSend} className="relative flex items-end">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập câu hỏi pháp lý..."
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 pl-4 pr-12 text-sm font-medium focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 resize-none transition-all duration-200 custom-scrollbar placeholder:text-zinc-400 text-[#1A2530]"
                            style={{ minHeight: '48px' }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={`absolute right-1.5 bottom-1.5 h-[36px] w-[36px] flex items-center justify-center rounded-xl transition-all shadow-sm ${!input.trim() || isLoading
                                ? 'bg-zinc-100 text-zinc-400'
                                : 'bg-[#1A2530] text-white hover:bg-[#B8985D]'
                                }`}
                        >
                            <PaperAirplaneIcon className="w-4 h-4 stroke-2 -rotate-45" />
                        </button>
                    </form>
                </div>
            </div>
        </motion.div>
    );
}