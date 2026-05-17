import React, { useState } from "react";
import Swal from "sweetalert2";
import pptxgen from "pptxgenjs";
import {
  ClipboardDocumentCheckIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  PresentationChartBarIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

export default function PlanningDetailView({ record }) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const showToast = (message, icon = "info") => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title: message,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
      background: "#ffffff",
      color: "#1A2530",
      customClass: { popup: "shadow-xl" },
    });
  };

  const handleDownloadWord = () => {
    setIsActionMenuOpen(false);

    if (!tasks || tasks.length === 0) {
      showToast("Không có dữ liệu để xuất file Word.", "warning");
      return;
    }

    const grouped = tasks.reduce((acc, task) => {
      const phase = task.phase || "Chưa phân loại";
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(task);
      return acc;
    }, {});

    let htmlString = `<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>`;
    htmlString += `<h1>KẾ HOẠCH HÀNH ĐỘNG PHÁP LÝ</h1>`;

    Object.keys(grouped).forEach((phaseName) => {
      htmlString += `<h2>${phaseName}</h2>`;
      htmlString += '<ul>';
      grouped[phaseName].forEach((task) => {
        const title = task.title || 'Không có tên task';
        const assignee = task.assignee || 'Chưa phân công';
        const deadline = task.deadline || 'Không có hạn';
        const notes = task.legal_notes || task.description || 'Không có lưu ý';
        htmlString += `<li>${title} | Phụ trách: ${assignee} | Hạn: ${deadline} | Lưu ý: ${notes}</li>`;
      });
      htmlString += '</ul>';
    });

    htmlString += '</body></html>';

    const blob = new Blob(['\ufeff', htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'KeHoach_LegAI.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Đã tải file Word thành công!', 'success');
  };

  const handleGenerateSlide = () => {
    setIsActionMenuOpen(false);

    if (!tasks || tasks.length === 0) {
      showToast("Không có dữ liệu để tạo slide.", "warning");
      return;
    }

    const grouped = tasks.reduce((acc, task) => {
      const phase = task.phase || "Chưa phân loại";
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(task);
      return acc;
    }, {});

    const pres = new pptxgen();
    let slide = pres.addSlide();
    slide.addText("KẾ HOẠCH THỰC THI PHÁP LÝ", {
      x: 0.5,
      y: 1.5,
      w: "90%",
      align: "center",
      bold: true,
      fontSize: 32,
    });
    slide.addText("Tạo tự động bởi LegAI", {
      x: 0.5,
      y: 3,
      w: "90%",
      align: "center",
      italic: true,
      fontSize: 18,
      color: "666666",
    });

    Object.keys(grouped).forEach((phaseName) => {
      slide = pres.addSlide();
      slide.addText(phaseName, {
        x: 0.5,
        y: 0.5,
        w: "90%",
        fontSize: 28,
        bold: true,
        color: "1A2530",
      });

      //  mảng Object chứa 'text' và 'options'
      const items = grouped[phaseName].map((task) => {
        const title = task.title || 'Không có tên task';
        const assignee = task.assignee || 'Chưa phân công';
        const deadline = task.deadline || 'Không có hạn';

        return {
          text: `${title} – ${assignee} – ${deadline}`,
          options: { bullet: true, breakLine: true }
        };
      });


      slide.addText(items, {
        x: 0.5,
        y: 1.5,
        w: "90%",
        fontSize: 16,
        color: "333333",
        margin: 0.1,
        lineSpacing: 20
      });
    });

    pres.writeFile({ fileName: "Slide_KeHoach_LegAI.pptx" })
      .then(() => {
        showToast("Đã tạo file Slide thành công!", "success");
      })
      .catch((error) => {
        console.error("Error generating PPTX:", error);
        showToast("Không thể tạo slide. Vui lòng thử lại.", "error");
      });
  };

  const handlePrint = () => window.print();

  let tasks = [];
  try {
    const parsed = JSON.parse(record.fullData?.AnalysisJson || "[]");
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error parsing AnalysisJson for PlanningDetailView:", error);
    tasks = [];
  }

  const groupedTasks = tasks.reduce((acc, task) => {
    const phase = task.phase || "Chưa phân loại";
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(task);
    return acc;
  }, {});

  const statusConfig = {
    completed: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: "✓",
    },
    "in-progress": {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: "⟳",
    },
    pending: {
      bg: "bg-zinc-50",
      border: "border-zinc-200",
      text: "text-zinc-700",
      icon: "○",
    },
  };

  return (
    <section className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl p-6">
      <div className="mb-6 flex items-center gap-2 relative">
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Quy trình kế hoạch
        </h2>
        <span className="ml-auto text-[11px] font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-md">
          {tasks.length} nhiệm vụ
        </span>

        <div className="ml-4 relative">
          <button
            type="button"
            onClick={() => setIsActionMenuOpen((prev) => !prev)}
            className="flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-200 bg-white text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors shadow-sm"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>

          {isActionMenuOpen && (
            <div className="absolute right-0 mt-12 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                type="button"
                onClick={handleDownloadWord}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5" />
                Tải file Word (.docx)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActionMenuOpen(false);
                  handlePrint();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                Tải file PDF (.pdf)
              </button>
              <button
                type="button"
                onClick={handleGenerateSlide}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1A2530] hover:bg-[#B8985D]/10 transition-colors"
              >
                <PresentationChartBarIcon className="w-5 h-5" />
                Tạo Slide (.pptx)
              </button>
              <hr className="border-zinc-100" />

            </div>
          )}
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedTasks).map(([phase, phaseTasks]) => (
            <div key={phase}>
              <h3 className="text-lg font-bold text-[#1A2530] mb-4 uppercase tracking-wide">
                {phase}
              </h3>
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-blue-300 to-zinc-200"></div>
                <div className="space-y-6">
                  {phaseTasks.map((task, idx) => {
                    const config = statusConfig[task.status] || statusConfig.pending;

                    return (
                      <div key={`${phase}-${idx}`} className="relative pl-28">
                        <div className="absolute left-0 top-1 w-16 h-16 flex items-center justify-center">
                          <div
                            className={`w-12 h-12 rounded-full border-4 ${config.border} ${config.bg} flex items-center justify-center text-lg font-bold ${config.text} z-10 bg-white`}
                          >
                            {config.icon}
                          </div>
                        </div>
                        <article className={`rounded-2xl border-2 ${config.border} ${config.bg} p-5 transition hover:shadow-md`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-[#1A2530]">{task.title}</h4>
                              {task.legal_notes && (
                                <p className="text-xs font-medium text-zinc-600 mt-1 leading-5">
                                  {task.legal_notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <UserIcon className="h-3 w-3" />
                              {task.assignee}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                              <CalendarIcon className="h-3 w-3" />
                              {task.deadline}
                            </span>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <ClipboardDocumentCheckIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-600">Chưa có kế hoạch</p>
          <p className="text-xs text-zinc-500 mt-1">Kế hoạch chi tiết sẽ hiển thị ở đây.</p>
        </div>
      )}
    </section>
  );
}
