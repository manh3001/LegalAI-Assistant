import {
  DocumentDuplicateIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

export default function FormDetailView({ record }) {
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
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-[#B8985D] hover:text-[#B8985D] rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <PrinterIcon className="w-4 h-4 stroke-2" /> In / Lưu PDF
        </button>
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