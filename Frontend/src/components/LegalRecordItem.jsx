import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from '../config/api';
import toast from "react-hot-toast";
import {
  EyeIcon,
  PencilSquareIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import ConfirmModal from "./ConfirmModal";
import ShareModal from "./ShareModal";
import {
  getTypeConfig,
  normalizeRecord,
  renderRecordBadge,
} from "../utils/legalRecordUtils";

export default function LegalRecordItem({ record, onDeleted }) {
  console.log("🔍 Current Record Data:", record);

  const navigate = useNavigate();
  const safeRecord = normalizeRecord(record);
  const config = getTypeConfig(safeRecord.type);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleView = () => navigate(`/ho-so/chi-tiet/${safeRecord.id}`);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem("accessToken");
      await axios.delete(
        `${API_URL}/history/delete/${safeRecord.id}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      toast.success("Đã xóa hồ sơ.");
      setShowDeleteModal(false);
      onDeleted?.(safeRecord.id);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.response?.data?.message || "Xóa hồ sơ thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className={`flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-all duration-300 group ${config.borderColor}`}
      >
        <div className="flex items-center gap-5 mb-4 md:mb-0">
          <div
            className={`p-3 ${config.bgColor} border border-zinc-100 rounded-xl shadow-sm flex-shrink-0`}
          >
            {config.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h4 className="font-bold text-[#1A2530] uppercase text-sm tracking-wide group-hover:text-[#B8985D] transition-colors">
                {safeRecord.name}
              </h4>
              {renderRecordBadge(safeRecord)}
            </div>
            <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mt-1 font-medium">
              ID: #{safeRecord.id || "N/A"}{" "}
              <span className="mx-2 text-zinc-300">|</span>{" "}
              <span className="text-zinc-500">Ngày tạo: {safeRecord.date}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200 shadow-inner">
          <button
            onClick={handleView}
            title="Xem chi tiết"
            className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn"
          >
            <EyeIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-blue-500 stroke-2" />
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            title="Chia sẻ"
            className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn"
          >
            <ShareIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-emerald-500 stroke-2" />
          </button>

          <button
            onClick={() => navigate(`/ho-so/chinh-sua/${safeRecord.id}`)}
            title="Chỉnh sửa"
            className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn"
          >
            <PencilSquareIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-amber-500 stroke-2" />
          </button>

          <div className="w-[1px] h-5 bg-zinc-200 mx-1"></div>

          <button
            onClick={() => setShowDeleteModal(true)}
            title="Xóa hồ sơ"
            className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn"
          >
            <TrashIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-red-500 stroke-2" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Xóa hồ sơ"
        message={`Xóa vĩnh viễn hồ sơ "${safeRecord.name}"? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa hồ sơ"
        loading={deleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />

      <ShareModal
        isOpen={showShareModal}
        recordId={safeRecord.id}
        recordName={safeRecord.name}
        onClose={() => setShowShareModal(false)}
      />
    </>
  );
}
