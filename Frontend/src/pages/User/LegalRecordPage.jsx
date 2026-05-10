import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  FolderOpenIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VideoCameraIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import CreateRecordModal from "../../components/CreateRecordModal";
import LegalRecordItem from "../../components/LegalRecordItem";
import {
  getMockRecordsResponse,
  USE_MOCK_DATA,
} from "../../mockData/legalRecordsMock";
export default function LegalRecordPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // THÊM: State quản lý Phân trang
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0,
  });

  // THÊM: Ref để chống spam gọi API khi gõ tìm kiếm
  const searchRef = useRef(null);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      let res;

      {
        // Gọi API thực tế
        const token = localStorage.getItem("accessToken");
        const userStr = localStorage.getItem("user");

        if (!userStr || !token) {
          console.error("Chưa đăng nhập!");
          setLoading(false);
          return;
        }

        const user = JSON.parse(userStr);
        const userId = user.id ?? user.Id ?? user.ID;

        const apiRes = await axios.get(
          `http://localhost:8000/api/history/${userId}`,
          {
            params: {
              page: page,
              limit: 6,
              search: searchTerm.trim(),
            },
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        res = apiRes.data;
      }

      if (res && res.success) {
        const formattedRecords = res.data.map((item) => ({
          id: item.id || item.Id,
          name: item.name || item.Title || item.FileName || "Bản ghi không tên",
          date:
            item.date || new Date(item.CreatedAt).toLocaleDateString("vi-VN"),

          // normalize type
          type: item.type || item.RecordType,

          riskScore: item.riskScore || item.RiskScore,

          //  ép fullData luôn chứa AnalysisJson
          fullData: {
            ...item,
            AnalysisJson: item.AnalysisJson || item.analysisJson || item.fullData?.AnalysisJson
          }
        }));
        setRecords(formattedRecords);

        setPagination({
          currentPage: res.currentPage || 1,
          totalPages: res.totalPages || 1,
          totalDocs: res.totalDocs || 0,
        });
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  // Lắng nghe sự thay đổi của Trang hiện tại
  useEffect(() => {
    fetchHistory(pagination.currentPage);
  }, [pagination.currentPage]);

  //  Xử lý tìm kiếm (Debounce)
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
      } else {
        fetchHistory(1);
      }
    }, 500);
    return () => clearTimeout(searchRef.current);
  }, [searchTerm]);

  const handleBack = () => navigate("/");

  //  Hàm chuyển trang
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  return (
    // Đổi nền tổng thể sang #f8f9fa và chữ mặc định sang Đen Than
    <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-x-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
      {/* Vệt sáng trang trí nền (Tạo cảm giác sang trọng) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#B8985D]/5 rounded-full blur-[120px] -z-10"></div>

      <main className="max-w-7xl mx-auto w-full px-6 py-24 relative z-10">
        <div className="text-center mb-16 space-y-6">
          {/* Badge: Đổi từ Cyan sang tông Vàng Đồng nhạt */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B8985D]/30 bg-[#B8985D]/10 text-[#8E6D45] text-xs font-bold uppercase tracking-wider">
            <FolderOpenIcon className="w-4 h-4 stroke-2" /> Kho lưu trữ số
          </div>
          {/* Tiêu đề: Áp dụng Gradient Vàng Đồng */}
          <h2 className="text-4xl md:text-6xl font-black uppercase">
            Hồ sơ{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C5A880] to-[#8E6D45]">
              Pháp lý
            </span>
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-10">
          {/* Nút Quay lại: Nền trắng, viền kẽm */}
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 hover:text-[#1A2530] transition-colors shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 stroke-2" /> Quay lại
          </button>
          {/* Tổng số hồ sơ */}
          <div className="text-sm font-bold text-[#1A2530] border border-zinc-200 px-5 py-3 rounded-xl bg-white shadow-sm flex items-center gap-2">
            Tổng cộng:{" "}
            <span className="text-[#B8985D] text-lg">
              {pagination.totalDocs}
            </span>{" "}
            hồ sơ
          </div>
        </div>

        {/* Main Container: Nền trắng kính mờ */}
        <div className="bg-white/80 backdrop-blur-xl border border-zinc-200 rounded-[2.5rem] p-8 min-h-[500px] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
          <div className="mb-10 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm hồ sơ..."
                className="w-full pl-5 pr-12 py-4 bg-zinc-50 border border-zinc-200 rounded-xl text-[#1A2530] font-medium outline-none focus:bg-white focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 transition-all placeholder:text-zinc-400 shadow-sm"
              />
              <MagnifyingGlassIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 stroke-2" />
            </div>
          </div>

          <div className="space-y-4 flex-grow">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 opacity-60">
                <ArrowPathIcon className="w-10 h-10 animate-spin mb-4 text-[#B8985D] stroke-2" />
                <span className="text-zinc-500 font-bold tracking-widest uppercase text-sm">
                  Đang đồng bộ dữ liệu...
                </span>
              </div>
            ) : records.length > 0 ? (
              records.map((record) => (
                <LegalRecordItem
                  key={record.id}
                  record={record}
                  onDeleted={(deletedId) => {
                    setRecords((prev) =>
                      prev.filter((item) => item.id !== deletedId),
                    );
                    setPagination((prev) => ({
                      ...prev,
                      totalDocs: Math.max((prev.totalDocs || 1) - 1, 0),
                    }));
                  }}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                <DocumentTextIcon className="w-16 h-16 text-zinc-300 mb-4 stroke-1" />
                <p className="text-zinc-500 font-medium">Chưa có hồ sơ nào</p>
              </div>
            )}
          </div>

          {/* KHỐI UI PHÂN TRANG (PAGINATION) CHUẨN LIGHT MODE */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8 border-t border-zinc-100 mt-6">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronLeftIcon className="w-5 h-5 stroke-2" />
              </button>

              {[...Array(pagination.totalPages)].map((_, i) => {
                const p = i + 1;
                if (
                  p === 1 ||
                  p === pagination.totalPages ||
                  (p >= pagination.currentPage - 1 &&
                    p <= pagination.currentPage + 1)
                ) {
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
                if (
                  p === pagination.currentPage - 2 ||
                  p === pagination.currentPage + 2
                )
                  return (
                    <span
                      key={p}
                      className="text-zinc-400 font-bold tracking-widest px-1"
                    >
                      ...
                    </span>
                  );
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
        </div>
      </main>
    </div>
  );
}
