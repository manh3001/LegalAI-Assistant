import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getTypeConfig,
  normalizeRecord,
  renderRecordBadge,
} from "../../utils/legalRecordUtils";
import {
  getMockDetailResponse,
  USE_MOCK_DATA,
} from "../../mockData/legalRecordsMock";

export default function EditRecordPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
  });

  console.log("🔍 Editing Record:", record);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("accessToken");
        const res = await axios.get(
          `http://localhost:8000/api/history/detail/${id}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        if (res.data?.success) {
          const normalized = normalizeRecord(res.data.data);
          setRecord(normalized);
          setFormData({
            name: normalized.name,
            description: normalized.description,
            type: normalized.type,
          });
        } else {
          toast.error("Không thể tải hồ sơ.");
        }
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("Lỗi tải dữ liệu hồ sơ.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Tên hồ sơ không được trống.");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const payload = {
        name: formData.name,
        description: formData.description
      };

      const res = await axios.put(`http://localhost:8000/api/history/update/${id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.data?.success) {
        toast.success("Lưu thay đổi thành công!");
        setTimeout(() => navigate(`/ho-so/chi-tiet/${id}`), 1000);
      } else {
        toast.error(res.data?.message || "Lưu thất bại.");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.message || "Lỗi kết nối đến máy chủ.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-[#B8985D] font-black uppercase tracking-widest">
        Đang tải...
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-4 text-[#1A2530]">
        <PencilSquareIcon className="h-14 w-14 text-zinc-300 stroke-1" />
        <p className="font-bold">Không tìm thấy hồ sơ.</p>
        <button
          onClick={() => navigate("/ho-so-phap-ly")}
          className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-600 shadow-sm hover:text-[#B8985D]"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const config = getTypeConfig(record.type);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-x-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#B8985D]/5 rounded-full blur-[120px] -z-10"></div>

      <main className="max-w-2xl mx-auto w-full px-6 py-24 relative z-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-fit px-6 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 hover:text-[#1A2530] transition-colors shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 stroke-2" /> Quay lại
          </button>
        </div>

        {/* Main Form */}
        <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          {/* Form Header */}
          <div className="border-b border-zinc-100 p-8">
            <div className="flex items-start gap-5">
              <div
                className={`rounded-2xl border border-zinc-100 p-4 shadow-sm ${config.bgColor}`}
              >
                {config.icon}
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-wide text-[#1A2530] mb-2">
                  Chỉnh sửa hồ sơ
                </h1>
                <p className="text-sm font-medium text-zinc-500">
                  Cập nhật thông tin chi tiết của hồ sơ pháp lý
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8 space-y-6">
            {/* Badge Info */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex-shrink-0">{renderRecordBadge(record)}</div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  ID: #{record.id}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Ngày tạo: {record.date}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Tên Hồ sơ */}
              <div>
                <label className="block text-sm font-black uppercase tracking-wider text-[#1A2530] mb-2">
                  Tên hồ sơ *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nhập tên hồ sơ"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-[#1A2530] placeholder-zinc-400 font-medium transition focus:outline-none focus:ring-2 focus:ring-[#B8985D]/50 focus:border-[#B8985D]"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Tiêu đề chính của hồ sơ
                </p>
              </div>

              {/* Mô tả */}
              <div>
                <label className="block text-sm font-black uppercase tracking-wider text-[#1A2530] mb-2">
                  Mô tả
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Nhập mô tả chi tiết hồ sơ (tùy chọn)"
                  rows="4"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-[#1A2530] placeholder-zinc-400 font-medium transition focus:outline-none focus:ring-2 focus:ring-[#B8985D]/50 focus:border-[#B8985D] resize-none"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Thêm thông tin chi tiết về nội dung hồ sơ
                </p>
              </div>

              {/* Loại Hồ sơ - Chỉ đọc */}
              <div>
                <label className="block text-sm font-black uppercase tracking-wider text-[#1A2530] mb-2">
                  Loại hồ sơ
                </label>
                <div className="px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[#1A2530] font-medium">
                  {config.label}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Loại hồ sơ không thể thay đổi sau khi tạo
                </p>
              </div>

              {/* Meta Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    ID Hồ sơ
                  </p>
                  <p className="text-sm font-semibold text-[#1A2530]">
                    {record.id}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Ngày tạo
                  </p>
                  <p className="text-sm font-semibold text-[#1A2530]">
                    {record.date}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                💡 Lưu ý
              </p>
              <p className="text-xs font-medium text-emerald-900">
                Bạn chỉ có thể chỉnh sửa tên và mô tả hồ sơ. Nội dung chi tiết
                sẽ được quản lý riêng từ trang chi tiết.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-8 py-6 flex items-center justify-end gap-3">
            <button
              onClick={() => navigate(-1)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-100 transition disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4 stroke-2" /> Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#1A2530] text-white font-bold text-sm flex items-center gap-2 hover:bg-[#263442] transition disabled:opacity-70"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 stroke-2" /> Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}