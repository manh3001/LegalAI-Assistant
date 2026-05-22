import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import usePersistedState from '../hooks/usePersistedState';
import {
    PaperAirplaneIcon,
    PrinterIcon,
    SparklesIcon,
    ChatBubbleLeftEllipsisIcon,
    DocumentMagnifyingGlassIcon,
    ArrowPathIcon,
    CheckBadgeIcon,
    EllipsisVerticalIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import aiClient from "../api/aiClient";


// ==============================================================================
// COMPONENT FIELDINPUT TỰ ĐỘNG XUỐNG HÀNG VÀ CĂN LỀ THẲNG TẮP CHUẨN VĂN BẢN
// ==============================================================================
const FieldInput = ({ label, field, value, onChange, placeholder }) => {
    const textareaRef = useRef(null);

    // Thuật toán tự co giãn chiều cao theo nội dung thực tế khi dữ liệu thay đổi
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <div className="flex items-start gap-1 mb-2 w-full min-w-0" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {/* NHÃN TRƯỜNG: Ép cứng độ rộng 160px để chứa vừa vặn chữ "Tên Cá nhân/Tổ chức" không lo rớt dòng nhãn */}
            <span
                className="font-semibold text-gray-800 text-[14px] print:text-black min-w-[160px] max-w-[160px] inline-block select-none pt-0.5"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
                - {label}
            </span>

            {/* CỘT DẤU HAI CHẤM: Đứng độc lập cố định vị trí thẳng hàng từ trên xuống dưới */}
            <span className="font-semibold text-gray-800 text-[14px] print:text-black select-none pt-0.5 mr-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>:</span>

            {/* VÙNG NHẬP LIỆU: Sử dụng border dotted đơn giản của trình duyệt, chữ đè lên chấm */}
            <div className="flex-1 min-w-0">
                <textarea
                    ref={textareaRef}
                    value={value || ''}
                    onChange={(e) => onChange(field, e.target.value)}
                    placeholder={placeholder || '.......................................................................................................................................'}
                    rows={1}
                    className="w-full bg-transparent p-0 focus:outline-none focus:ring-0 font-medium text-[14px] text-gray-900 resize-none overflow-hidden block break-words whitespace-pre-wrap border-t-0 border-l-0 border-r-0 border-b border-dotted border-zinc-400 focus:border-[#B8985D] pb-0.5 placeholder-gray-400"
                    style={{
                        fontFamily: '"Times New Roman", Times, serif',
                        minHeight: '24px',
                        lineHeight: '1.6'
                    }}
                />
            </div>
        </div>
    );
};

export default function FormGeneration() {
    // 1. STATE QUẢN LÝ CHAT & LƯU TRỮ
    const [messages, setMessages] = usePersistedState('formMessages', [
        { id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegAI. Bạn cần tạo hợp đồng gì? (VD: Soạn hợp đồng dịch vụ tư vấn pháp lý, tôi là Công ty A, MST 12345, phí dịch vụ 50 triệu...)' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const textAreaRef = useRef(null);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const actionMenuRef = useRef(null);


    // 2. STATE QUẢN LÝ BIỂU MẪU
    const [currentTemplate, setCurrentTemplate] = usePersistedState('currentFormTemplate', 'none');
    const [formData, setFormData] = usePersistedState('formData', {
        ten_hop_dong: 'HỢP ĐỒNG DỊCH VỤ',
        benA_role: 'BÊN A',
        benB_role: 'BÊN B',
        can_cu_luat: [],
        benA_name: '', benA_id: '', benA_address: '', benA_phone: '', benA_rep: '',
        benB_name: '', benB_id: '', benB_address: '', benB_phone: '', benB_rep: '',
        sections: []
    });

    //  Khởi tạo auto-resize cho thanh chat AI
    useEffect(() => {
        const el = textAreaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [inputValue]);

    // Tự động bung hết chiều cao cho toàn bộ Điều Khoản Hợp Đồng
    useEffect(() => {
        setTimeout(() => {
            const contractTextareas = document.querySelectorAll('.contract-textarea');
            contractTextareas.forEach(textarea => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
        }, 50);
    }, [formData.sections]);

    // Close action menu when clicking outside
    useEffect(() => {
        const handleOutside = (e) => {
            if (isActionMenuOpen && actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
                setIsActionMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isActionMenuOpen]);


    //  Hàm cập nhật
    const handleFormChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        setIsSaved(false);
    };

    // Hàm cập nhật nội dung từng Section khi người dùng click gõ sửa trực tiếp trên tờ A4
    const handleSectionChange = (index, key, value) => {
        const newSections = [...formData.sections];
        newSections[index][key] = value;
        handleFormChange('sections', newSections);
    };

    // 3. HÀM GỬI TIN NHẮN & GỌI AI
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newUserMsg = { id: Date.now(), sender: 'user', text: inputValue };
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue('');
        setIsTyping(true);
        setIsSaved(false);

        try {
            const chatHistory = messages.map(m => ({ role: m.sender, content: m.text }));
            const response = await aiClient.generateForm({
                text: inputValue,
                history: chatHistory
            });

            const aiData = response?.data || response;
            console.log("Dữ liệu AI trả về:", aiData);

            if (!aiData || Object.keys(aiData).length === 0) {
                throw new Error("Dữ liệu AI trống");
            }

            setCurrentTemplate(aiData?.template_type ?? 'none');

          
           // =============================================================================
            //  KHỐI setFormData 
            // =============================================================================
            setFormData(prev => {
                const cleanText = (str) => {
                    if (!str) return '';
                    return str.normalize('NFC')
                              .replace(/\[\d+\]|\[\s*\]/g, '')
                              .replace(/;;+/g, ';') // Khử sạch lỗi trùng lặp dấu chấm phẩy từ AI
                              .trim();
                };

                const sanitizedSections = (aiData.extracted_data?.sections || []).map(section => ({
                    title: cleanText(section.title),
                    content: cleanText(section.content)
                }));

                // Khôi phục bộ bóc tách ID thích ứng
                let idA = '';
                if (aiData.extracted_data?.benA_mst && aiData.extracted_data?.benA_mst !== 'N/A') idA = aiData.extracted_data.benA_mst;
                else if (aiData.extracted_data?.benA_cccd && aiData.extracted_data?.benA_cccd !== 'N/A') idA = aiData.extracted_data.benA_cccd;
                else idA = aiData.extracted_data?.benA_id || '';

                let idB = '';
                if (aiData.extracted_data?.benB_mst && aiData.extracted_data?.benB_mst !== 'N/A') idB = aiData.extracted_data.benB_mst;
                else if (aiData.extracted_data?.benB_cccd && aiData.extracted_data?.benB_cccd !== 'N/A') idB = aiData.extracted_data.benB_cccd;
                else idB = aiData.extracted_data?.benB_id || '';

                return {
                    ...prev,
                    ten_hop_dong: cleanText(aiData.extracted_data?.ten_hop_dong || aiData.ten_hop_dong || prev.ten_hop_dong),
                    benA_role: cleanText(aiData.extracted_data?.benA_role || 'BÊN A'),
                    benB_role: cleanText(aiData.extracted_data?.benB_role || 'BÊN B'),
                    can_cu_luat: (aiData.extracted_data?.can_cu_luat || []).map(luat => cleanText(luat)),
                    
                    // Đồng bộ trục thời gian phẳng lỳ lên UI
                    ngay: cleanText(aiData.extracted_data?.ngay_ky || aiData.extracted_data?.ngay || ''),
                    thang: cleanText(aiData.extracted_data?.thang_ky || aiData.extracted_data?.thang || ''),
                    nam: cleanText(aiData.extracted_data?.nam_ky || aiData.extracted_data?.nam || ''),
                    tai: cleanText(aiData.extracted_data?.dia_diem_ky || aiData.extracted_data?.dia_diem || aiData.extracted_data?.tai || ''),

                    benA_name: cleanText(aiData.extracted_data?.benA_name || ''),
                    benA_id: cleanText(idA), 
                    benA_address: cleanText(aiData.extracted_data?.benA_address || ''),
                    benA_phone: cleanText(aiData.extracted_data?.benA_phone || ''),
                    benA_rep: cleanText(aiData.extracted_data?.benA_rep || ''),
                    
                    benB_name: cleanText(aiData.extracted_data?.benB_name || ''),
                    benB_id: cleanText(idB), 
                    benB_address: cleanText(aiData.extracted_data?.benB_address || ''),
                    benB_phone: cleanText(aiData.extracted_data?.benB_phone || ''),
                    benB_rep: cleanText(aiData.extracted_data?.benB_rep || ''),
                    
                    sections: sanitizedSections
                };
            });
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiData.chat_reply }]);
        } catch (error) {
            console.error("Lỗi AI Form:", error);
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'Hệ thống AI đang bận. Bạn có thể điền tay vào biểu mẫu bên phải nhé!' }]);
        } finally {
            setIsTyping(false);
        }
    };
    // 4. HÀM LƯU VÀO DATABASE SQL SERVER
    const handleSaveToHistory = async () => {
        if (currentTemplate === 'none') {
            Swal.fire({ icon: 'warning', title: 'Vui lòng nhập thông tin để AI tạo biểu mẫu trước khi lưu.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
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
                Swal.fire({ icon: 'success', title: 'Đã lưu biểu mẫu vào Kho lưu trữ số thành công!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
            }
        } catch (err) {
            console.error("Lỗi lưu Form:", err);
            Swal.fire({ icon: 'error', title: 'Lỗi: ' + (err.response?.status === 401 ? 'Hết hạn phiên làm việc!' : 'Không thể lưu.'), toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, iconColor: '#B8985D' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNewChat = () => {
        Swal.fire({
            title: 'Bản thảo hiện tại sẽ bị xóa',
            text: 'Bản thảo hiện tại sẽ bị xóa (nếu chưa Lưu hồ sơ). Bạn có chắc muốn tạo mới?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xác nhận',
            cancelButtonText: 'Hủy',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                setMessages([{ id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegAI. Bạn cần tạo hợp đồng gì?' }]);
                setCurrentTemplate('none');
                setFormData({
                    ten_hop_dong: 'HỢP ĐỒNG DỊCH VỤ', can_cu_luat: [],
                    benA_role: 'BÊN A', benB_role: 'BÊN B',
                    benA_name: '', benA_id: '', benA_address: '', benA_phone: '', benA_rep: '',
                    benB_name: '', benB_id: '', benB_address: '', benB_phone: '', benB_rep: '',
                    sections: []
                });
                setInputValue('');
                setIsSaved(false);
            }
        });
    };

    const handleDownloadWord = () => {
        try {
            const title = (formData.ten_hop_dong || 'HỢP ĐỒNG').toUpperCase();

            const canCu = (formData.can_cu_luat || []).map((luat, idx) => {
                const isLast = idx === (formData.can_cu_luat.length - 1);
                return `<p style="margin: 4px 0; padding-left: 15px; text-align: justify;">- ${luat}${isLast ? '.' : ';'}</p>`;
            }).join('\n');

            const sectionsHtml = (formData.sections || []).map(s => `
            <h3 style="font-size: 15px; font-weight: bold; text-transform: uppercase; margin-top: 16px; margin-bottom: 6px; font-family: 'Times New Roman', Times, serif;">${s.title || ''}</h3>
            <p style="font-size: 15px; line-height: 1.6; text-align: justify; margin: 0 0 10px 0; font-family: 'Times New Roman', Times, serif;">${(s.content || '').replace(/\n/g, '<br>')}</p>
        `).join('\n');

            const html = `<!doctype html>
<html>
<head>
    <meta charset='utf-8'>
    <title>${title}</title>
    <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 15px; line-height: 1.6; color: #000000; }
        table { font-family: 'Times New Roman', Times, serif; font-size: 15px; border-collapse: collapse; }
    </style>
</head>
<body>
    <div style="text-align: center; font-weight: bold; font-size: 15px; text-transform: uppercase; margin-bottom: 2px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div style="text-align: center; font-weight: bold; font-size: 15px; margin-bottom: 4px;">Độc lập - Tự do - Hạnh phúc</div>
    <div style="text-align: center; font-size: 14px; margin-bottom: 20px; color: #555555;">------o0o------</div>
    
    <h1 style="text-align: center; font-size: 19px; font-weight: bold; uppercase; margin-bottom: 25px; line-height: 1.4;">${title}</h1>
    
    <p style="text-align: justify; font-style: italic; margin-bottom: 12px;">Hôm nay, ngày ${formData.ngay || '......'} tháng ${formData.thang || '......'} năm ${formData.nam || '......'}, tại ${formData.tai || '..........................................................................................................................'}</p>
    <p style="font-weight: bold; margin-bottom: 15px;">- Chúng tôi gồm có các bên dưới đây:</p>
    
    <div style="margin-bottom: 20px; font-style: italic; color: #333333;">
        ${canCu}
    </div>
    
    <h2 style="font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">- BÊN A (${(formData.benA_role || 'BÊN ĐẶT GIA CÔNG').toUpperCase()}):</h2>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; margin-left: 15px;">
      <tr height="26">
        <td width="160" style="font-weight: bold; padding-bottom: 4px;">- Tên Cá nhân/Tổ chức</td>
        <td width="15" style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benA_name || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- MST / CCCD</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benA_id || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Địa chỉ</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benA_address || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Điện thoại</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benA_phone || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Đại diện</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benA_rep || '......................................................................................'}</td>
      </tr>
    </table>

    <h2 style="font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">- BÊN B (${(formData.benB_role || 'BÊN NHẬN GIA CÔNG').toUpperCase()}):</h2>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; margin-left: 15px;">
      <tr height="26">
        <td width="160" style="font-weight: bold; padding-bottom: 4px;">- Tên Cá nhân/Tổ chức</td>
        <td width="15" style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benB_name || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- MST / CCCD</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benB_id || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Địa chỉ</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benB_address || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Điện thoại</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benB_phone || '......................................................................................'}</td>
      </tr>
      <tr height="26">
        <td style="font-weight: bold; padding-bottom: 4px;">- Đại diện</td>
        <td style="font-weight: bold; padding-bottom: 4px;">:</td>
        <td style="padding-bottom: 4px;">${formData.benB_rep || '......................................................................................'}</td>
      </tr>
    </table>

    <div style="margin-top: 15px;">
        ${sectionsHtml}
    </div>
    
    <br/><br/>
    
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="page-break-inside: avoid; margin-top: 30px;">
        <tr>
            <td width="50%" style="text-align: center; font-weight: bold; font-size: 15px; text-transform: uppercase; vertical-align: top;">
                ${formData.benA_role || 'BÊN A'}<br/>
                <span style="font-weight: normal; font-style: italic; font-size: 13px; text-transform: none; color: #555555;">(Ký và ghi rõ họ tên)</span>
            </td>
            <td width="50%" style="text-align: center; font-weight: bold; font-size: 15px; text-transform: uppercase; vertical-align: top;">
                ${formData.benB_role || 'BÊN B'}<br/>
                <span style="font-weight: normal; font-style: italic; font-size: 13px; text-transform: none; color: #555555;">(Ký và ghi rõ họ tên)</span>
            </td>
        </tr>
        <tr>
            <td height="110"></td>
            <td></td>
        </tr>
        <tr>
            <td style="text-align: center; font-weight: bold; font-size: 14px; text-transform: uppercase;">
                ${formData.benA_rep || formData.benA_name || '...........................................'}
            </td>
            <td style="text-align: center; font-weight: bold; font-size: 14px; text-transform: uppercase;">
                ${formData.benB_rep || formData.benB_name || '...........................................'}
            </td>
        </tr>
    </table>
</body>
</html>`;

            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${formData.ten_hop_dong || 'HopDong_LegAI'}.doc`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setIsActionMenuOpen(false);
            Swal.fire({ icon: 'success', title: 'Đã tải file Word thành công!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        } catch (err) {
            console.error('Error exporting Word:', err);
            Swal.fire({ icon: 'error', title: 'Không thể xuất file Word', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, iconColor: '#B8985D' });
        }
    };
    const handlePrint = () => window.print();

    return (
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col md:flex-row gap-6 text-[#1A2530]">
            {/* CỘT TRÁI: CHAT AI */}
            <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col h-full bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl overflow-hidden flex-shrink-0">
                <div className="p-5 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-[#B8985D] hover:bg-[#B8985D]/10 transition-colors border border-zinc-200"
                    >
                        <ArrowPathIcon className="w-4 h-4 stroke-2 animate-spin-slow" />
                        TẠO MỚI
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-zinc-50/50">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm font-medium leading-relaxed ${msg.sender === 'user'
                                ? 'bg-[#1A2530] text-white rounded-tr-none'
                                : 'bg-white text-zinc-700 border border-zinc-200 rounded-tl-none'
                                }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

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

                <div className="p-4 border-t border-zinc-200 bg-white">
                    <form onSubmit={handleSendMessage} className="relative flex items-end">
                        <textarea
                            ref={textAreaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Yêu cầu soạn hợp đồng..."
                            rows={1}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 pl-5 pr-14 text-sm font-medium focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 resize-none transition-all duration-200 custom-scrollbar placeholder:text-zinc-400"
                            style={{ minHeight: '56px', maxHeight: '200px' }}
                        />
                        <button type="submit" disabled={isTyping || !inputValue.trim()} className="absolute right-2 bottom-2 h-[40px] w-[40px] flex items-center justify-center rounded-xl bg-[#1A2530] hover:bg-[#B8985D] text-white disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors shadow-sm">
                            <PaperAirplaneIcon className="w-5 h-5 stroke-2" />
                        </button>
                    </form>
                </div>
            </div>

            {/* CỘT PHẢI: TỜ A4 SOẠN THẢO CHUẨN TIMES NEW ROMAN */}
            <div className="flex-1 flex flex-col h-full bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-sm rounded-3xl overflow-hidden relative print:bg-white print:text-black print:border-none print:shadow-none">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center px-6 print:hidden">
                    <div className="flex items-center gap-4 text-[#1A2530]">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-[#B8985D] stroke-2" />
                        <span className="text-sm font-black uppercase tracking-widest">
                            {currentTemplate === 'none' ? 'Khu vực soạn thảo' : 'Bản thảo văn bản'}
                        </span>
                    </div>

                    <div ref={actionMenuRef} className="relative">
                        <button onClick={() => setIsActionMenuOpen(v => !v)} className="p-2 rounded-lg hover:bg-zinc-100">
                            <EllipsisVerticalIcon className="w-6 h-6 text-zinc-600" />
                        </button>
                        {isActionMenuOpen && (
                            <ul className="absolute right-6 mt-12 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                {currentTemplate !== 'none' && (
                                    <li onClick={() => { handleSaveToHistory(); setIsActionMenuOpen(false); }} className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                                        <CheckBadgeIcon className="w-5 h-5" />
                                        <span className="text-sm font-medium">Lưu Biểu Mẫu</span>
                                    </li>
                                )}
                                <li onClick={() => { handleDownloadWord(); }} className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                                    <DocumentTextIcon className="w-5 h-5" />
                                    <span className="text-sm font-medium">Tải file Word (.doc)</span>
                                </li>
                                <li onClick={() => { handlePrint(); setIsActionMenuOpen(false); }} className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                                    <PrinterIcon className="w-5 h-5" />
                                    <span className="text-sm font-medium">Tải file PDF (.pdf)</span>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-zinc-100/80 print:bg-white custom-scrollbar">
                    {currentTemplate === 'none' ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                            <DocumentMagnifyingGlassIcon className="w-24 h-24 mb-4 stroke-1 opacity-50" />
                            <p className="text-lg font-semibold text-zinc-500">Trò chuyện với AI để sinh hợp đồng</p>
                        </div>
                    ) : (
                        <div className="max-w-[210mm] mx-auto min-h-[297mm] bg-white text-gray-900 p-12 md:p-16 shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            <div className="text-center mb-8" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                <h3 className="font-bold text-[15px] uppercase" style={{ fontFamily: '"Times New Roman", Times, serif' }}>Cộng hòa Xã hội Chủ nghĩa Việt Nam</h3>
                                <h4 className="font-bold text-[15px] underline mb-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>Độc lập - Tự do - Hạnh phúc</h4>
                                <p className="text-sm italic text-gray-600" style={{ fontFamily: '"Times New Roman", Times, serif' }}>------o0o------</p>
                            </div>

                            {/* TỰ ĐỘNG XUỐNG HÀNG KHI TIÊU ĐỀ QUÁ DÀI */}
                            <div className="w-full text-center mb-6 px-4" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                <textarea
                                    value={(formData.ten_hop_dong || '').normalize('NFC')}
                                    onChange={(e) => handleFormChange('ten_hop_dong', e.target.value)}
                                    rows={2}
                                    className="w-full bg-transparent border-none p-0 focus:outline-none focus:bg-zinc-50/50 resize-none text-center text-xl font-bold uppercase text-gray-900 focus:ring-0 leading-normal tracking-wide block break-words whitespace-pre-wrap"
                                    style={{ fontFamily: '"Times New Roman", Times, serif', height: 'auto' }}
                                    onInput={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                />
                            </div>

                            <div className="space-y-6 text-justify" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                {/* DANH SÁCH CĂN CỨ LUẬT CHUẨN THỂ THỨC */}
                                {formData.can_cu_luat && formData.can_cu_luat.length > 0 && (
                                    <div className="italic text-[14px] space-y-0.5 mb-4 text-gray-700 pl-2 font-serif" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        {formData.can_cu_luat.map((luat, idx) => (
                                            <p key={idx} style={{ fontFamily: '"Times New Roman", Times, serif' }}>- {luat}{idx === formData.can_cu_luat.length - 1 ? '.' : ';'}</p>
                                        ))}
                                    </div>
                                )}

                                {/* MỤC THỜI GIAN ĐỊA ĐIỂM: CHO PHÉP AI ĐIỀN + USER GÕ TAY TRỰC TIẾP CHUẨN ĐƯỜNG CHẤM */}
                                <div className="w-full mb-4 italic text-[14px] text-gray-800" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 leading-relaxed w-full" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        <span>Hôm nay, ngày</span>
                                        <input
                                            type="text"
                                            value={formData.ngay || ''}
                                            onChange={(e) => handleFormChange('ngay', e.target.value)}
                                            placeholder="........."
                                            className="w-12 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-dotted border-zinc-400 p-0 text-center focus:outline-none focus:ring-0 font-medium italic text-[14px] focus:border-[#B8985D]"
                                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                        />
                                        <span>tháng</span>
                                        <input
                                            type="text"
                                            value={formData.thang || ''}
                                            onChange={(e) => handleFormChange('thang', e.target.value)}
                                            placeholder="........."
                                            className="w-12 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-dotted border-zinc-400 p-0 text-center focus:outline-none focus:ring-0 font-medium italic text-[14px] focus:border-[#B8985D]"
                                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                        />
                                        <span>năm</span>
                                        <input
                                            type="text"
                                            value={formData.nam || ''}
                                            onChange={(e) => handleFormChange('nam', e.target.value)}
                                            placeholder="............"
                                            className="w-16 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-dotted border-zinc-400 p-0 text-center focus:outline-none focus:ring-0 font-medium italic text-[14px] focus:border-[#B8985D]"
                                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                        />
                                        <span>, tại</span>
                                        
                                        {/* PHẪU THUẬT CHUYỂN SANG TEXTAREA TỰ ĐỘNG XUỐNG DÒNG THEO LAYOUT VĂN BẢN */}
                                        <div className="flex-1 min-w-[250px]">
                                            <textarea
                                                value={formData.tai || ''}
                                                onChange={(e) => handleFormChange('tai', e.target.value)}
                                                placeholder="............................................................................................................................................"
                                                rows={1}
                                                className="w-full bg-transparent p-0 focus:outline-none focus:ring-0 font-medium italic text-[14px] text-gray-900 resize-none overflow-hidden block break-words whitespace-pre-wrap border-t-0 border-l-0 border-r-0 border-b border-dotted border-zinc-400 focus:border-[#B8985D] pb-0.5"
                                                style={{ 
                                                    fontFamily: '"Times New Roman", Times, serif',
                                                    minHeight: '22px',
                                                    lineHeight: '1.5'
                                                }}
                                                onInput={(e) => {
                                                    // Ma trận tính toán chiều cao động theo text
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <p className="mt-2 font-semibold not-italic text-gray-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>- Chúng tôi gồm có các bên dưới đây:</p>
                                </div>

                                <div className="space-y-4" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    <div>
                                        <h2 className="font-bold uppercase mb-2 font-serif text-[14px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>BÊN A ({(formData.benA_role || 'BÊN BÁN').toUpperCase()}):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benA_name" value={(formData.benA_name || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="MST / CCCD" field="benA_id" value={(formData.benA_id || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Địa chỉ" field="benA_address" value={(formData.benA_address || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Điện thoại" field="benA_phone" value={(formData.benA_phone || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Đại diện" field="benA_rep" value={(formData.benA_rep || '').normalize('NFC')} onChange={handleFormChange} />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="font-bold uppercase mb-2 font-serif text-[14px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>BÊN B ({(formData.benB_role || 'BÊN MUA').toUpperCase()}):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benB_name" value={(formData.benB_name || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="MST / CCCD" field="benB_id" value={(formData.benB_id || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Địa chỉ" field="benB_address" value={(formData.benB_address || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Điện thoại" field="benB_phone" value={(formData.benB_phone || '').normalize('NFC')} onChange={handleFormChange} />
                                            <FieldInput label="Đại diện" field="benB_rep" value={(formData.benB_rep || '').normalize('NFC')} onChange={handleFormChange} />
                                        </div>
                                    </div>
                                </div>

                                {/* RENDER MẢNG SECTIONS ĐỘNG TÀNG HÌNH CHUẨN WORD */}
                                <div className="space-y-6 pt-4" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    {formData.sections && formData.sections.length > 0 ? (
                                        formData.sections.map((section, index) => (
                                            <div key={index} className="space-y-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                {/* Ô nhập tiêu đề điều khoản */}
                                                <input
                                                    type="text"
                                                    value={(section.title || '').normalize('NFC')}
                                                    onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                                                    className="w-full font-bold uppercase text-[15px] bg-transparent focus:outline-none focus:bg-zinc-50 border-none p-0 focus:ring-0"
                                                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                                />

                                                {/* Ô nhập nội dung điều khoản */}
                                                <textarea
                                                    value={(section.content || '').normalize('NFC').replace(/\[\d+\]|\[\s*\]/g, '')}
                                                    onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                                                    className="contract-textarea w-full bg-transparent border-none p-0 focus:outline-none focus:bg-zinc-50/50 resize-none overflow-hidden text-black text-justify focus:ring-0"
                                                    style={{
                                                        fontFamily: '"Times New Roman", Times, serif',
                                                        fontSize: '16px',
                                                        fontWeight: '500',
                                                        lineHeight: '1.6',
                                                        padding: '0'
                                                    }}
                                                    onInput={(e) => {
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-zinc-400 italic text-center py-10 font-medium" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            AI đang xử lý và phân tích các điều khoản hợp đồng...
                                        </div>
                                    )}
                                </div>

                                {/* CHỮ KÝ GOM CỤM CHUẨN IN ẤN VĂN BẢN HÀNH CHÍNH */}
                                <div className="pt-16 pb-10 grid grid-cols-2 gap-12 text-center break-inside-avoid" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    <div className="flex flex-col items-center justify-between min-h-[160px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        <div>
                                            <h3 className="font-bold uppercase text-[15px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{formData.benA_role || 'BÊN A'}</h3>
                                            <p className="text-[13px] italic text-gray-500 mt-0.5" style={{ fontFamily: '"Times New Roman", Times, serif' }}>(Ký và ghi rõ họ tên)</p>
                                        </div>
                                        <div className="w-full flex items-center justify-center px-4 mt-auto">
                                            <span className="font-bold uppercase text-[14px] leading-snug tracking-wide text-gray-900 block max-w-[280px] break-words" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                {formData.benA_rep || formData.benA_name || '........................'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-between min-h-[160px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        <div>
                                            <h3 className="font-bold uppercase text-[15px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{formData.benB_role || 'BÊN B'}</h3>
                                            <p className="text-[13px] italic text-gray-500 mt-0.5" style={{ fontFamily: '"Times New Roman", Times, serif' }}>(Ký và ghi rõ họ tên)</p>
                                        </div>
                                        <div className="w-full flex items-center justify-center px-4 mt-auto">
                                            <span className="font-bold uppercase text-[14px] leading-snug tracking-wide text-gray-900 block max-w-[280px] break-words" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                {formData.benB_rep || formData.benB_name || '........................'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(184, 152, 93, 0.3); border-radius: 20px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(184, 152, 93, 0.6); }
                    @media print { body { background: white; } .print\\:hidden { display: none !important; } }
                `}
            </style>
        </div>
    );
}