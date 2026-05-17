import React, { useState, useRef, useEffect } from 'react';
import {
  DocumentDuplicateIcon,
  PrinterIcon,
  EllipsisVerticalIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";
import Swal from 'sweetalert2';

export default function FormDetailView({ record }) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);
  let data = {};
  try {
    data = JSON.parse(record.fullData?.AnalysisJson || '{}');
  } catch (error) {
    console.error('Error parsing AnalysisJson for FormDetailView:', error);
    data = {};
  }

  // Bóc tách toàn bộ data y như bên FormGeneration
  const {
    ten_hop_dong = 'HỢP ĐỒNG DỊCH VỤ',
    can_cu_luat = [],
    benA_role = 'BÊN A', benA_name = '', benA_id = '', benA_address = '', benA_phone = '', benA_rep = '',
    benB_role = 'BÊN B', benB_name = '', benB_id = '', benB_address = '', benB_phone = '', benB_rep = '',
    sections = []
  } = data;

  // Lệnh in kích hoạt cửa sổ Print của Browser
  const handlePrint = () => window.print();

  const handleDownloadWord = () => {
    try {
      const title = ten_hop_dong || 'HỢP ĐỒNG';
      const canCu = (can_cu_luat || []).map(l => `<p>- ${l}</p>`).join('');
      const sectionsHtml = (sections || []).map(s => `
        <h3 style="font-weight:bold">${s.title || ''}</h3>
        <p>${(s.content || '').replace(/\n/g, '<br>')}</p>
      `).join('\n');

      const html = `<!doctype html>
<html>
<head><meta charset='utf-8'><title>${title}</title></head>
<body style="font-family: 'Times New Roman', Times, serif;">
  <div style="text-align:center; font-weight:bold;">Cộng hòa Xã hội Chủ nghĩa Việt Nam</div>
  <div style="text-align:center; font-weight:bold;">Độc lập - Tự do - Hạnh phúc</div>
  <hr/>
  <h1 style="text-align:center;">${title}</h1>
  <div>${canCu}</div>
  <h2>Thông tin Bên A</h2>
  <p>Tên: ${benA_name || ''}</p>
  <p>MST/CCCD: ${benA_id || ''}</p>
  <p>Địa chỉ: ${benA_address || ''}</p>
  <p>Điện thoại: ${benA_phone || ''}</p>
  <p>Đại diện: ${benA_rep || ''}</p>
  <h2>Thông tin Bên B</h2>
  <p>Tên: ${benB_name || ''}</p>
  <p>MST/CCCD: ${benB_id || ''}</p>
  <p>Địa chỉ: ${benB_address || ''}</p>
  <p>Điện thoại: ${benB_phone || ''}</p>
  <p>Đại diện: ${benB_rep || ''}</p>
  <div>${sectionsHtml}</div>
  <br/>
  <table width="100%">
    <tr>
      <td style="text-align:center; font-weight:bold;">BÊN A<br/>(Ký và ghi rõ họ tên)</td>
      <td style="text-align:center; font-weight:bold;">BÊN B<br/>(Ký và ghi rõ họ tên)</td>
    </tr>
    <tr><td style="height:120px"></td><td></td></tr>
    <tr>
      <td style="text-align:center;">${benA_rep || benA_name || '........................'}</td>
      <td style="text-align:center;">${benB_rep || benB_name || '........................'}</td>
    </tr>
  </table>
</body>
</html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HopDong_LegAI.doc';
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (isActionMenuOpen && actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isActionMenuOpen]);

  // Component phụ trợ để render dòng thông tin (Chỉ đọc)
  const FieldRow = ({ label, value }) => (
    <div className="flex items-start gap-2 mb-1">
      <span className="font-semibold text-gray-800 text-[13px] min-w-[120px]">- {label}:</span>
      <span className="flex-1 text-[14px] font-medium leading-relaxed">
        {value || '................................................................'}
      </span>
    </div>
  );

  return (
    <section className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-zinc-100/80 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl p-4 md:p-6 print:p-0 print:border-none print:shadow-none print:bg-white relative">

      {/* Header thanh công cụ - Sẽ bị ẩn khi in */}
      <div className="mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
        <div className="flex items-center gap-2">
          <DocumentDuplicateIcon className="h-5 w-5 text-[#B8985D] stroke-2" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
            Hồ sơ lưu trữ: Biểu mẫu
          </h2>
        </div>
        <div ref={actionMenuRef} className="relative">
          <button onClick={() => setIsActionMenuOpen(v => !v)} className="p-2 rounded-lg hover:bg-zinc-100">
            <EllipsisVerticalIcon className="w-6 h-6 text-zinc-600" />
          </button>
          {isActionMenuOpen && (
            <ul className="absolute right-6 mt-12 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
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

      {/* Vùng chứa tờ A4 */}
      <div className="w-full overflow-y-auto custom-scrollbar print:overflow-visible">

        {/* KHUNG TỜ GIẤY A4 (Khóa kích thước chuẩn in ấn) */}
        <div
          className="max-w-[210mm] mx-auto min-h-[297mm] bg-white text-gray-900 p-12 md:p-16 shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative leading-relaxed print:shadow-none print:p-0 print:mx-0 print:w-full"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {/* Quốc hiệu */}
          <div className="text-center mb-8">
            <h3 className="font-bold text-[15px] uppercase">Cộng hòa Xã hội Chủ nghĩa Việt Nam</h3>
            <h4 className="font-bold text-[15px] underline mb-2">Độc lập - Tự do - Hạnh phúc</h4>
            <p className="text-sm italic text-gray-600">------o0o------</p>
          </div>

          {/* Tên Hợp đồng */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-black uppercase mb-1">{ten_hop_dong}</h1>
            <p className="text-sm text-gray-600 italic">Hôm nay, tại ........................................</p>
          </div>

          <div className="space-y-6 text-justify">

            {/* Căn cứ luật */}
            {can_cu_luat && can_cu_luat.length > 0 && (
              <div className="italic text-sm space-y-1 mb-4">
                <p className="font-bold">- Căn cứ theo:</p>
                {can_cu_luat.map((luat, idx) => (
                  <p key={idx} className="ml-4">- {luat}</p>
                ))}
              </div>
            )}

            {/* Thông tin 2 bên */}
            <div className="space-y-4">
              <div>
                <h2 className="font-bold uppercase mb-2">BÊN A ({benA_role}):</h2>
                <div className="pl-4">
                  <FieldRow label="Tên Cá nhân/Tổ chức" value={benA_name} />
                  <FieldRow label="MST / CCCD" value={benA_id} />
                  <FieldRow label="Địa chỉ" value={benA_address} />
                  <FieldRow label="Điện thoại" value={benA_phone} />
                  <FieldRow label="Đại diện" value={benA_rep} />
                </div>
              </div>
              <div>
                <h2 className="font-bold uppercase mb-2">BÊN B ({benB_role}):</h2>
                <div className="pl-4">
                  <FieldRow label="Tên Cá nhân/Tổ chức" value={benB_name} />
                  <FieldRow label="MST / CCCD" value={benB_id} />
                  <FieldRow label="Địa chỉ" value={benB_address} />
                  <FieldRow label="Điện thoại" value={benB_phone} />
                  <FieldRow label="Đại diện" value={benB_rep} />
                </div>
              </div>
            </div>

            {/* Nội dung điều khoản */}
            <div className="space-y-6 pt-4">
              {sections && sections.length > 0 ? (
                sections.map((section, index) => (
                  <div key={index} className="space-y-2 break-inside-avoid">
                    <h2 className="font-bold uppercase text-[15px]">{section.title}</h2>
                    {/* KHÔNG dùng Textarea nữa, dùng Div để chỉ đọc và tự động co giãn */}
                    <div className="w-full text-[15px] leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-zinc-400 italic text-center py-10 font-medium print:hidden">
                  Không có nội dung điều khoản.
                </div>
              )}
            </div>

            {/* Chữ ký */}
            <div className="pt-16 pb-10 grid grid-cols-2 gap-8 text-center break-inside-avoid">
              <div>
                <h3 className="font-bold uppercase mb-1">Bên A</h3>
                <p className="text-[12px] italic text-gray-500 mb-20">(Ký và ghi rõ họ tên)</p>
                <p className="font-bold uppercase">{benA_rep || benA_name || '........................'}</p>
              </div>
              <div>
                <h3 className="font-bold uppercase mb-1">Bên B</h3>
                <p className="text-[12px] italic text-gray-500 mb-20">(Ký và ghi rõ họ tên)</p>
                <p className="font-bold uppercase">{benB_rep || benB_name || '........................'}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>
        {`
          /* Tinh chỉnh thanh cuộn UI */
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(184, 152, 93, 0.3); border-radius: 20px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(184, 152, 93, 0.6); }
          
         
          @media print { 
            /* 1. Ẩn toàn bộ giao diện gốc của web (Sidebar, Header chung...) */
            body * { visibility: hidden; }
            
            /* 2. Ẩn các nút bấm trong Component  */
            .print\\:hidden { display: none !important; }
            
            /* 3. in ra (tờ A4)  */
            .max-w-\\[210mm\\] * { visibility: visible; }
            
            /* 4. Căn chỉnh tờ A4 dính sát góc trái trên cùng để in tràn viền chuẩn chỉ */
            .max-w-\\[210mm\\] { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}
      </style>
    </section>
  );
}