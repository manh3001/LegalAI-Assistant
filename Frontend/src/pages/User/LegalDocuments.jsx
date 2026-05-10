import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
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

  const [userId, setUserId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0
  });

  const searchRef = useRef(null);

  const [myLaws, setMyLaws] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);

  // Hàm lấy Token từ localStorage để gắn vào header (Cải tiến)
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("accessToken"); // Lấy token trực tiếp
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Hàm xử lý khi gặp lỗi 401 (token hết hạn/không hợp lệ)
  const handleUnauthorized = useCallback(() => {
    setUserId(null); // Xóa userId trong state
    localStorage.removeItem("user"); // Xóa user từ localStorage
    localStorage.removeItem("accessToken"); // Xóa token từ localStorage
    // Có thể thêm navigate('/login') để redirect về trang đăng nhập
    alert("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
  }, []);

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

  const fetchMyLawsFromDb = useCallback(async () => {
    if (!userId) { 
        setMyLaws(JSON.parse(localStorage.getItem("myLaws") || "[]")); 
        return; 
    }
    try {
      const res = await axios.get(`http://localhost:8000/api/user/saved-laws/${userId}`, { headers: getAuthHeaders() }); 
      if (res.data.success) {
        setMyLaws(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi lấy luật đã lưu từ DB:", err);
      if (err.response && err.response.status === 401) handleUnauthorized(); 
      setMyLaws(JSON.parse(localStorage.getItem("myLaws") || "[]")); // Fallback to local storage
    }
  }, [userId, getAuthHeaders, handleUnauthorized]); 

  const fetchRecentDocsFromDb = useCallback(async () => {
    if (!userId) { 
        setRecentDocs(JSON.parse(localStorage.getItem("recentDocs") || "[]")); 
        return; 
    }
    try {
      const res = await axios.get(`http://localhost:8000/api/user/recent-docs/${userId}`, { headers: getAuthHeaders() }); 
      if (res.data.success) {
        setRecentDocs(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi lấy tài liệu xem gần đây từ DB:", err);
      if (err.response && err.response.status === 401) handleUnauthorized();
      setRecentDocs(JSON.parse(localStorage.getItem("recentDocs") || "[]")); // Fallback to local storage
    }
  }, [userId, getAuthHeaders, handleUnauthorized]); 


  // useEffect để thiết lập userId khi component mount hoặc khi localStorage thay đổi
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserId(user.id || user.Id); // Lấy userId từ object user
      } catch (e) {
        console.error("Lỗi parse user từ localStorage:", e);
        setUserId(null); 
        localStorage.removeItem("user"); // Xóa dữ liệu user lỗi
        localStorage.removeItem("accessToken"); // Xóa token lỗi
      }
    } else {
        setUserId(null); 
    }
    // Các fetch ban đầu này không phụ thuộc vào userId
    fetchStats();
    fetchDocuments(1); 
  }, [filter.category]); // Giữ dependency này để re-fetch khi category đổi


  // useEffect để gọi các fetch liên quan đến user khi userId thay đổi
  useEffect(() => {
    if (userId) { // Chỉ gọi khi userId có giá trị (người dùng đã đăng nhập)
      fetchMyLawsFromDb(); 
      fetchRecentDocsFromDb(); 
    } else {
      // Nếu không có userId (chưa đăng nhập), load từ localStorage tạm thời
      setMyLaws(JSON.parse(localStorage.getItem("myLaws") || "[]"));
      setRecentDocs(JSON.parse(localStorage.getItem("recentDocs") || "[]"));
    }
  }, [userId, fetchMyLawsFromDb, fetchRecentDocsFromDb]); 

  const saveMyLaws = (arr) => {
    setMyLaws(arr);
    try { localStorage.setItem("myLaws", JSON.stringify(arr)); } catch(e) {}
  };

  const saveRecent = (arr) => {
    setRecentDocs(arr);
    try { localStorage.setItem("recentDocs", JSON.stringify(arr)); } catch(e) {}
  };


  const toggleStar = async (doc) => {
    if (userId) { // Kiểm tra userId trước khi gọi DB
      try {
        const payload = {
          userId: userId,
          DocumentId: doc.Id, 
          DocumentTitle: doc.Title,
          DocumentNumber: doc.DocumentNumber,
          IssueYear: doc.IssueYear
        };
        const res = await axios.post("http://localhost:8000/api/user/toggle-saved-law", payload, { headers: getAuthHeaders() }); 
        if (res.data.success) {
          fetchMyLawsFromDb(); 
        }
      } catch (err) {
        console.error("Lỗi khi cập nhật luật đã lưu (DB):", err);
        if (err.response && err.response.status === 401) handleUnauthorized();
        alert("Có lỗi xảy ra khi lưu/xóa luật. Vui lòng thử lại.");
      }
    } else {
      // Logic lưu tạm vào trình duyệt nếu chưa đăng nhập
      const exists = myLaws.find(d => d.Id === doc.Id);
      if (exists) {
        const next = myLaws.filter(d => d.Id !== doc.Id);
        saveMyLaws(next);
      } else {
        const next = [doc, ...myLaws];
        saveMyLaws(next);
      }
      alert("Bạn chưa đăng nhập. Luật đã được lưu tạm vào trình duyệt.");
    }
  };
    const removeSavedLaw = async (savedLawId) => {
    if (!userId) { // Kiểm tra userId trước khi gọi DB
        saveMyLaws(myLaws.filter(l => l.Id !== savedLawId));
        alert("Bạn chưa đăng nhập. Luật đã được xóa khỏi danh sách lưu tạm.");
        return;
    }
    try {
        const payload = { userId: userId, savedLawId: savedLawId }; 
        const res = await axios.delete("http://localhost:8000/api/user/remove-saved-law", { data: payload, headers: getAuthHeaders() }); 
        if (res.data.success) {
            fetchMyLawsFromDb(); 
        }
    } catch (err) {
        console.error("Lỗi khi xóa luật đã lưu từ panel (DB):", err);
        if (err.response && err.response.status === 401) handleUnauthorized();
        alert("Có lỗi xảy ra khi xóa luật đã lưu. Vui lòng thử lại.");
    }
  };


  const addToRecent = async (doc) => {
    const simplified = { Id: doc.Id, Title: doc.Title, DocumentNumber: doc.DocumentNumber, IssueYear: doc.IssueYear };

    if (userId) { // Kiểm tra userId trước khi gọi DB
      try {
        const payload = {
          userId: userId,
          DocumentId: simplified.Id, 
          DocumentTitle: simplified.Title,
          DocumentNumber: simplified.DocumentNumber,
          IssueYear: simplified.IssueYear
        };
        const res = await axios.post("http://localhost:8000/api/user/add-recent-doc", payload, { headers: getAuthHeaders() }); 
        if (res.data.success) {
          fetchRecentDocsFromDb(); 
        }
      } catch (err) {
        console.error("Lỗi khi thêm/cập nhật tài liệu xem gần đây (DB):", err);
        if (err.response && err.response.status === 401) handleUnauthorized();
      }
    } else {
      // Logic lưu tạm vào trình duyệt nếu chưa đăng nhập
      const next = [simplified, ...recentDocs.filter(d => d.Id !== simplified.Id)].slice(0, 8);
      saveRecent(next);
    }
  };

  const removeRecentDoc = async (recentDocId) => {
    if (!userId) { // Kiểm tra userId trước khi gọi DB
        saveRecent(recentDocs.filter(r => r.Id !== recentDocId));
        alert("Bạn chưa đăng nhập. Mục đã được xóa khỏi lịch sử xem tạm.");
        return;
    }
    try {
        const payload = { userId: userId, recentDocId: recentDocId }; 
        const res = await axios.delete("http://localhost:8000/api/user/remove-recent-doc", { data: payload, headers: getAuthHeaders() }); 
        if (res.data.success) {
            fetchRecentDocsFromDb(); 
        }
    } catch (err) {
        console.error("Lỗi khi xóa lịch sử xem gần đây (DB):", err);
        if (err.response && err.response.status === 401) handleUnauthorized();
        alert("Có lỗi xảy ra khi xóa lịch sử. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => fetchDocuments(1), 400);
    return () => clearTimeout(searchRef.current);
  }, [filter.keyword]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <main className="flex-1 px-4 py-8 md:px-10 max-w-3xl mx-auto w-full">

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
                        documents.map((item, index) => {
                            const isStarred = myLaws.some(d => (userId ? d.DocumentId === item.Id : d.Id === item.Id));
                            return (
                                <div key={item.Id} className="group bg-white border border-zinc-200 p-6 rounded-2xl hover:border-[#B8985D]/30 transition-all shadow-sm flex flex-col md:flex-row gap-5">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 font-bold border border-zinc-100 group-hover:text-[#B8985D] transition-colors">
                                    {(pagination.currentPage - 1) * 10 + index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <h4 className="text-[20px] font-bold text-zinc-800 group-hover:text-zinc-900 mb-2 leading-relaxed italic">{item.Title}</h4>
                                            <button onClick={() => toggleStar(item)} className={`ml-4 text-2xl transition-colors ${isStarred ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'}`} aria-label="Lưu luật">
                                            {isStarred ? '🌟' : '☆'}
                                            </button>
                                        </div>
                                        <div className="flex gap-4 text-xs text-zinc-500 mb-4">
                                            <span>Số hiệu: <b className="text-zinc-600">{item.DocumentNumber}</b></span>
                                            <span>Năm: <b className="text-zinc-600">{item.IssueYear}</b></span>
                                            <span className={item.Status === "Còn hiệu lực" ? "text-emerald-500" : "text-rose-500"}>● {item.Status}</span>
                                        </div>
                                    <button onClick={() => { addToRecent(item); navigate(`/van-ban/chi-tiet/${item.Id}`); }} className="text-[10px] border border-zinc-200 px-4 py-1.5 rounded-lg hover:bg-[#B8985D] hover:text-white transition-all uppercase font-bold tracking-tighter">Xem chi tiết</button>
                                    </div>
                                </div>
                            );
                        })
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
            {/* ================= RIGHT PANEL: My Laws + Recently Viewed ================= */}
            <aside className="hidden lg:flex flex-col w-96 bg-white border-l border-zinc-200 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6 gap-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                {/* --- Luật của tôi --- */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="text-sm font-bold text-[#8E6D45] mb-4 uppercase tracking-widest flex items-center gap-2">
                        <BookOpenIcon className="w-4 h-4 text-[#B8985D]" /> LUẬT CỦA TÔI
                    </h3>
                    {myLaws.length === 0 ? (
                        <div className="text-xs text-zinc-600 text-center py-4 bg-zinc-50 rounded-lg border border-zinc-200">
                            Bạn chưa lưu luật nào.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myLaws.map(l => (
                                <div 
                                    key={l.Id} 
                                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-all group border border-zinc-200"
                                >
                                    <div className="flex-1 mr-3 min-w-0"> 
                                        <div className="font-bold text-zinc-800 text-sm truncate group-hover:text-zinc-900 transition-colors">{l.Title}</div>
                                        <div className="text-xs text-zinc-500 truncate">{l.DocumentNumber}</div> 
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            // FIX: Sử dụng l.DocumentId nếu có, nếu không thì dùng l.Id
                                            onClick={() => navigate(`/van-ban/chi-tiet/${l.DocumentId || l.Id}`)} 
                                            className="p-2 rounded-md text-zinc-600 bg-zinc-100 hover:bg-[#B8985D] hover:text-white transition-all shadow-sm group-hover:scale-105"
                                            title="Xem chi tiết"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => removeSavedLaw(l.Id)} 
                                            className="p-2 rounded-md text-zinc-500 bg-zinc-100 hover:bg-red-500/10 hover:text-red-600 transition-all shadow-sm group-hover:scale-105"
                                            title="Xóa khỏi danh sách"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* --- Các luật bạn vừa xem gần đây --- */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm mt-4">
                    <h3 className="text-sm font-bold text-[#8E6D45] mb-4 uppercase tracking-widest flex items-center gap-2">
                        <EyeIcon className="w-4 h-4 text-[#B8985D]" /> VỪA XEM GẦN ĐÂY
                    </h3>
                    {recentDocs.length === 0 ? (
                        <div className="text-xs text-zinc-600 text-center py-4 bg-zinc-50 rounded-lg border border-zinc-200">
                            Chưa có lịch sử xem.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentDocs.map(r => (
                                <div 
                                    key={r.Id} 
                                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-all group border border-zinc-200"
                                >
                                    <div className="flex-1 mr-3 min-w-0"> 
                                        <div className="font-bold text-zinc-800 text-sm truncate group-hover:text-zinc-900 transition-colors">{r.Title}</div>
                                        <div className="text-xs text-zinc-500 truncate">{r.DocumentNumber}</div> 
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            // FIX: Sử dụng r.DocumentId nếu có, nếu không thì dùng r.Id
                                            onClick={() => navigate(`/van-ban/chi-tiet/${r.DocumentId || r.Id}`)} 
                                            className="p-2 rounded-md text-zinc-600 bg-zinc-100 hover:bg-[#B8985D] hover:text-white transition-all shadow-sm group-hover:scale-105"
                                            title="Xem chi tiết"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => removeRecentDoc(r.Id)} 
                                            className="p-2 rounded-md text-zinc-500 bg-zinc-100 hover:bg-red-500/10 hover:text-red-600 transition-all shadow-sm group-hover:scale-105"
                                            title="Xóa khỏi lịch sử"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

        </div>
    );
}