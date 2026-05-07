import {
  ClipboardDocumentCheckIcon,
  UserIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

export default function PlanningDetailView({ record }) {
  let tasks = [];
  try {
    const parsed = JSON.parse(record.fullData?.AnalysisJson || '[]');
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing AnalysisJson for PlanningDetailView:', error);
    tasks = [];
  }

  // Group tasks by phase
  const groupedTasks = tasks.reduce((acc, task) => {
    const phase = task.phase || 'Chưa phân loại';
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
      <div className="mb-6 flex items-center gap-2">
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Quy trình kế hoạch
        </h2>
        <span className="ml-auto text-[11px] font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-md">
          {tasks.length} nhiệm vụ
        </span>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedTasks).map(([phase, phaseTasks]) => (
            <div key={phase}>
              <h3 className="text-lg font-bold text-[#1A2530] mb-4 uppercase tracking-wide">
                {phase}
              </h3>
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-blue-300 to-zinc-200"></div>

                {/* Tasks */}
                <div className="space-y-6">
                  {phaseTasks.map((task, idx) => {
                    const config = statusConfig[task.status] || statusConfig.pending;

                    return (
                      <div key={`${phase}-${idx}`} className="relative pl-28">
                        {/* Timeline Dot */}
                        <div className="absolute left-0 top-1 w-16 h-16 flex items-center justify-center">
                          <div
                            className={`w-12 h-12 rounded-full border-4 ${config.border} ${config.bg} flex items-center justify-center text-lg font-bold ${config.text} z-10 bg-white`}
                          >
                            {config.icon}
                          </div>
                        </div>

                        {/* Content Card */}
                        <article
                          className={`rounded-2xl border-2 ${config.border} ${config.bg} p-5 transition hover:shadow-md`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-[#1A2530]">
                                {task.title}
                              </h4>
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
          <p className="text-xs text-zinc-500 mt-1">
            Kế hoạch chi tiết sẽ hiển thị ở đây.
          </p>
        </div>
      )}
    </section>
  );
}
