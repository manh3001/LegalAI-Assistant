import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

export default function LegalDocuments() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({
    keyword: "",
    fromDate: "",
    toDate: "",
    category: "Tất cả"
  });

  // State quản lý dữ liệu và phân trang
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0
  });

  const searchRef = useRef(null);

  // 1. LẤY SỐ LƯỢNG SIDEBAR (NHẢY SỐ TỰ ĐỘNG)
  const fetchStats = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/document-stats");
      if (res.data.success) {
        const apiStats = res.data.stats;
        
        //  gom TẤT CẢ các danh mục có trong DB trả về
        const dynamicMenu = apiStats
            .filter(s => s.Category !== "Lĩnh vực khác" && s.Category) // Lọc bỏ 'Lĩnh vực khác' và NULL để xếp riêng
            .map(s => ({
                name: s.Category,
                count: s.Count
            }));

        // Sắp xếp danh mục theo bảng chữ cái cho đẹp
        dynamicMenu.sort((a, b) => a.name.localeCompare(b.name));

        const updated = [
          { name: "Xem tất cả", count: res.data.total },
          ...dynamicMenu, // Chèn tất cả danh mục động vào đây
          { name: "Lĩnh vực khác", count: apiStats.find(s => s.Category === "Lĩnh vực khác")?.Count || 0 }
        ];
        setCategories(updated);
      }
    } catch (err) { console.error("Stats error:", err); }
  };

  // 2. GỌI API LẤY VĂN BẢN (CÓ PHÂN TRANG)
  const fetchDocuments = async (page = 1) => {
    setLoading(true);
    try {
      let categoryToSend = filter.category === "Tất cả" || filter.category === "Xem tất cả" ? "" : filter.category;

      const res = await axios.get("http://localhost:8000/api/documents", {
        params: {
          search: filter.keyword.trim(),
          category: categoryToSend,
          page: page,
          limit: 10
        }
      });
      console.log("🔍 Check Data từ API Tra Cứu:", res.data);
      if (res.data.success) {
        setDocuments(res.data.data);
        setPagination({
          currentPage: res.data.currentPage,
          totalPages: res.data.totalPages,
          totalDocs: res.data.totalDocs
        });
      }
    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); }
  };

  // Effect load ban đầu và khi đổi Category
  useEffect(() => {
    fetchStats();
    fetchDocuments(1); // Đổi category thì về trang 1
  }, [filter.category]);

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => fetchDocuments(1), 400);
    return () => clearTimeout(searchRef.current);
  }, [filter.keyword]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Cuộn lên đầu cho mượt
      fetchDocuments(newPage);
    }
  };

  const handleClearFilter = () => {
    setFilter({ keyword: "", fromDate: "", toDate: "", category: "Tất cả" });
  };

  return (
        // Đổi nền tổng thể sang #f8f9fa, chữ Đen Than #1A2530
        <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] font-sans flex items-start pt-16 w-full selection:bg-[#B8985D]/30 selection:text-[#1A2530]">

            {/* ================= SIDEBAR ================= */}
            <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-zinc-200 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                <div className="p-6 border-b border-zinc-200 bg-zinc-50/50">
                    <h2 className="font-black text-lg flex items-center gap-2 text-[#1A2530] uppercase tracking-wider">
                        <BookOpenIcon className="w-5 h-5 text-[#B8985D] stroke-2" /> Tra cứu văn bản
                    </h2>
                </div>
                <div className="p-4 flex flex-col gap-1">
                    {categories.map((cat, idx) => (
                        <button
                            key={idx}
                            onClick={() => setFilter({ ...filter, category: cat.name })}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group font-bold ${filter.category === cat.name || (cat.name === "Xem tất cả" && filter.category === "Tất cả")
                                    ? "bg-[#B8985D]/10 text-[#8E6D45] border border-[#B8985D]/20 shadow-sm"
                                    : "text-zinc-600 hover:bg-zinc-50 hover:text-[#1A2530] border border-transparent"
                                }`}
                        >
                            <span className="text-[14px] tracking-tight truncate">{cat.name}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                                filter.category === cat.name || (cat.name === "Xem tất cả" && filter.category === "Tất cả")
                                ? "bg-white text-[#8E6D45] shadow-sm"
                                : "bg-zinc-100 text-zinc-500 group-hover:bg-white group-hover:text-[#B8985D]"
                            }`}>
                                ({cat.count})
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ================= MAIN CONTENT ================= */}
            <main className="flex-1 px-4 py-8 md:px-10 max-w-5xl mx-auto w-full">

                {/* Search Bar - Nền trắng tinh, bóng đổ nhẹ */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-8 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tiêu đề, số hiệu..."
                                value={filter.keyword}
                                onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 pl-12 text-[#1A2530] font-medium focus:bg-white focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all outline-none placeholder:text-zinc-400"
                            />
                            <MagnifyingGlassIcon className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 stroke-2" />
                        </div>
                        <button onClick={() => fetchDocuments(1)} className="bg-[#1A2530] hover:bg-[#B8985D] text-white px-8 py-3.5 rounded-xl font-bold transition-colors shadow-md active:scale-95 whitespace-nowrap">
                            Tìm kiếm
                        </button>
                    </div>
                </div>

                {/* Results Header */}
                <div className="flex items-center justify-between mb-6 px-2 border-b border-zinc-200 pb-4">
                    <h3 className="text-sm font-black text-zinc-400 tracking-widest uppercase">Thư viện pháp luật số</h3>
                    <p className="text-xs text-zinc-500 font-medium">Tìm thấy <span className="text-[#B8985D] font-black text-sm">{pagination.totalDocs}</span> văn bản</p>
                </div>

                {/* Documents List */}
                <div className="space-y-4 mb-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-60">
                            <ArrowPathIcon className="w-10 h-10 animate-spin text-[#B8985D] mb-4 stroke-2" />
                            <p className="text-zinc-500 text-sm font-bold tracking-widest uppercase">Đang truy xuất dữ liệu...</p>
                        </div>
                    ) : documents.length > 0 ? (
                        documents.map((item, index) => (
                            <div key={item.Id} className="group bg-white border border-zinc-200 p-6 rounded-2xl hover:border-[#B8985D] transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row gap-5 items-start">
                                {/* Số thứ tự */}
                                <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 font-black border border-zinc-200 group-hover:bg-[#B8985D] group-hover:text-white group-hover:border-[#B8985D] transition-colors flex-shrink-0 shadow-sm">
                                    {(pagination.currentPage - 1) * 10 + index + 1}
                                </div>
                                <div className="flex-1">
                                    {/* Tiêu đề văn bản */}
                                    <h4 className="text-[18px] font-bold text-[#1A2530] group-hover:text-[#B8985D] mb-3 leading-relaxed transition-colors">{item.Title}</h4>
                                    
                                    {/* Meta info */}
                                    <div className="flex flex-wrap gap-4 text-xs text-zinc-500 mb-5 font-medium bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                                        <span className="flex items-center gap-1">Số hiệu: <b className="text-[#1A2530]">{item.DocumentNumber}</b></span>
                                        <span className="text-zinc-300">|</span>
                                        <span className="flex items-center gap-1">Năm: <b className="text-[#1A2530]">{item.IssueYear}</b></span>
                                        <span className="text-zinc-300">|</span>
                                        <span className={`font-bold flex items-center gap-1.5 ${item.Status === "Còn hiệu lực" ? "text-emerald-600" : "text-rose-600"}`}>
                                            <span className="w-2 h-2 rounded-full currentColor bg-current"></span> {item.Status}
                                        </span>
                                    </div>
                                    <button onClick={() => navigate(`/van-ban/chi-tiet/${item.Id}`)} className="text-[11px] border border-zinc-300 px-5 py-2 rounded-lg hover:bg-[#1A2530] hover:text-white hover:border-[#1A2530] transition-all uppercase font-bold tracking-wider text-zinc-600 bg-white shadow-sm">
                                        Xem chi tiết
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-zinc-500 font-medium">Không có dữ liệu phù hợp.</div>
                    )}
                </div>

                {/* ================= PAGINATION UI ================= */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pb-10">
                        <button
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                            disabled={pagination.currentPage === 1}
                            className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                        >
                            <ChevronLeftIcon className="w-5 h-5 stroke-2" />
                        </button>

                        {/* Tạo danh sách số trang */}
                        {[...Array(pagination.totalPages)].map((_, i) => {
                            const p = i + 1;
                            if (p === 1 || p === pagination.totalPages || (p >= pagination.currentPage - 1 && p <= pagination.currentPage + 1)) {
                                return (
                                    <button
                                        key={p}
                                        onClick={() => handlePageChange(p)}
                                        className={`w-10 h-10 rounded-lg border font-bold text-sm transition-all shadow-sm ${pagination.currentPage === p
                                                ? "bg-[#1A2530] border-[#1A2530] text-white"
                                                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-[#B8985D] hover:border-[#B8985D]/50"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                );
                            }
                            if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="text-zinc-400 font-bold tracking-widest px-1">...</span>;
                            return null;
                        })}

                        <button
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                            disabled={pagination.currentPage === pagination.totalPages}
                            className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                        >
                            <ChevronRightIcon className="w-5 h-5 stroke-2" />
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}