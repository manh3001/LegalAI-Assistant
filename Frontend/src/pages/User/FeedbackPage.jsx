import React, { useState } from 'react';
import {
    BugAntIcon,
    LightBulbIcon,
    HandThumbUpIcon,
    EllipsisHorizontalCircleIcon,
    PaperAirplaneIcon,
    ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';

export default function FeedbackPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        type: "Góp ý",
        rating: 0,
        content: ""
    });
    const [infoMessage, setInfoMessage] = useState("");
    const feedbackTypes = [
        { id: 'Báo lỗi', icon: BugAntIcon },
        { id: 'Góp ý', icon: LightBulbIcon },
        { id: 'Khen ngợi', icon: HandThumbUpIcon },
        { id: 'Khác', icon: EllipsisHorizontalCircleIcon },
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.content) {
            setInfoMessage('Vui lòng điền đầy đủ các trường yêu cầu có dấu *');
            return;
        }
        let msg = '';
        if (formData.type === 'Khác') {
            msg = 'Chúng tôi đã tiếp nhận phản hồi của bạn. Xin cảm ơn.';
        } else {
            msg = `Chúng tôi đã tiếp nhận ${formData.type.toLowerCase()} của bạn. Xin cảm ơn vì đã gửi phản hồi.`;
        }

        setInfoMessage(msg);

        setFormData({ name: "", email: "", type: "Góp ý", rating: 0, content: "" });
    };

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans selection:bg-[#B8985D]/30 relative overflow-x-hidden">

            <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-grow">
                <div className="bg-white rounded-[1.5rem] border border-zinc-200 shadow-lg overflow-hidden">
                    {/* Header Gradient */}
                    <div className="bg-gradient-to-r from-[#B8985D] to-[#8E6D45] p-6 text-white">
                        <div className="flex items-center gap-3">
                            <ChatBubbleLeftRightIcon className="w-8 h-8" />
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-tight">Gửi Phản Hồi</h1>
                                <p className="text-xs opacity-80 italic">Chúng tôi luôn lắng nghe ý kiến từ bạn</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {infoMessage && (
                            <div className="mb-6 p-4 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-between">
                                <div className="text-sm">Thông báo: {infoMessage}</div>
                                <button type="button" onClick={() => setInfoMessage('')} className="ml-4 px-3 py-1 bg-emerald-500 text-white rounded">Đóng</button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Họ và tên *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên của bạn"
                                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 text-sm placeholder-zinc-400 transition-all"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Email *</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="email@example.com"
                                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 text-sm placeholder-zinc-400 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Loại phản hồi *</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {feedbackTypes.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: item.id })}
                                        className={`flex items-center gap-2 justify-center py-2.5 border rounded-xl transition-all ${formData.type === item.id
                                            ? "border-[#B8985D] bg-[#B8985D]/10 text-[#8E6D45] font-bold shadow-sm"
                                            : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span className="text-xs">{item.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="py-2 border-y border-zinc-100 text-center">
                            <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Mức độ hài lòng</label>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        className="transition-transform active:scale-90"
                                        onClick={() => setFormData({ ...formData, rating: star })}
                                    >
                                        {formData.rating >= star
                                            ? <StarSolid className="w-8 h-8 text-yellow-400" />
                                            : <StarOutline className="w-8 h-8 text-zinc-300" />
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Nội dung chi tiết *</label>
                            <textarea
                                required
                                rows="4"
                                placeholder="Chia sẻ ý kiến hoặc báo lỗi tại đây..."
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 text-sm placeholder-zinc-400 transition-all resize-none"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-[#B8985D] to-[#8E6D45] text-white py-3.5 rounded-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.01] hover:shadow-lg transition-all duration-300"
                        >
                            <PaperAirplaneIcon className="w-4 h-4 -rotate-45" />
                            Gửi phản hồi
                        </button>
                    </form>
                </div>
            </div>
        </main>
    </div>
    );
}