import {
  ChatBubbleLeftEllipsisIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatDetailView({ record }) {
  let messages = [];
  try {
    const parsed = JSON.parse(record.fullData?.AnalysisJson || '[]');
    messages = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing AnalysisJson for ChatDetailView:', error);
    messages = [];
  }

  // FIX LỖI: Hàm tẩy rửa vỏ bọc ({ "answer": "..." }) do DB lưu xuống
  const cleanChatText = (text) => {
    if (!text) return "";
    let cleaned = text;

    try {
      // Ép chuẩn lại dạng JSON hợp lệ
      cleaned = cleaned.replace(/^\(\s*\{/, '{').replace(/\}\s*\)$/, '}');
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.answer) {
        return parsed.answer;
      }
    } catch (e) {
      // Dùng Regex xóa thủ công nếu JSON parse lỗi
      cleaned = text
        .replace(/^\(\{\s*"answer"\s*:\s*"/, "") 
        .replace(/"\s*\}\)$/, "") 
        .replace(/\\n/g, "\n"); 
    }
    return cleaned;
  };

  return (
    <section className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl p-6">
      <div className="mb-6 flex items-center gap-2">
        <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-emerald-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Lịch sử trò chuyện
        </h2>
        <span className="ml-auto text-[11px] font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-md">
          {messages.length} tin nhắn
        </span>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3">
          {messages.map((msg, idx) => (
            <div
              key={`msg-${idx}`}
              className={`flex gap-3 ${msg.isBot ? "justify-start" : "justify-end"}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center ${msg.isBot
                  ? "bg-zinc-50 border-zinc-200"
                  : "bg-[#B8985D] border-[#B8985D]"
                  }`}
              >
                {msg.isBot ? (
                  <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-zinc-600 stroke-2" />
                ) : (
                  <UserIcon className="h-4 w-4 text-white stroke-2" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${msg.isBot
                  ? "bg-zinc-50 border border-zinc-200 text-zinc-800"
                  : "bg-[#B8985D] text-white"
                  }`}
              >
                {msg.isBot ? (
                  <div className="text-sm leading-6 prose prose-sm max-w-none prose-headings:text-zinc-800 prose-p:text-zinc-800 prose-strong:text-zinc-900 prose-code:text-zinc-700 prose-a:text-blue-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {/* FIX LỖI: Bọc hàm tẩy rửa vào đây */}
                      {cleanChatText(msg.text)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-6">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <ChatBubbleLeftEllipsisIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-600">Không có tin nhắn</p>
          <p className="text-xs text-zinc-500 mt-1">
            Lịch sử cuộc trò chuyện sẽ hiển thị ở đây.
          </p>
        </div>
      )}
    </section>
  );
}