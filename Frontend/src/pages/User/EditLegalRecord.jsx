import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import toast from 'react-hot-toast';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckBadgeIcon,
    DocumentArrowUpIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import ConfirmModal from '../../components/ConfirmModal';
import UploadBox from '../../components/UploadBox';
import {
    RECORD_TYPES,
    getTypeConfig,
    normalizeRecord,
    renderRecordBadge
} from '../../utils/legalRecordUtils';

export default function EditLegalRecord() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [form, setForm] = useState({
        name: '',
        type: '',
        description: ''
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    console.log('Current Record Data:', record);

    useEffect(() => {
        const fetchRecord = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('accessToken');
                const res = await axios.get(`${API_URL}/history/detail/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (res.data?.success) {
                    const normalized = normalizeRecord(res.data.data);
                    setRecord(normalized);
                    setForm({
                        name: normalized.name,
                        type: normalized.type,
                        description: normalized.description
                    });
                } else {
                    toast.error(res.data?.message || 'Không thể tải hồ sơ.');
                }
            } catch (err) {
                console.error('Fetch editable record error:', err);
                toast.error(err.response?.data?.message || 'Không thể tải dữ liệu chỉnh sửa.');
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [id]);

    const safeRecord = useMemo(() => normalizeRecord(record || {}), [record]);
    const config = getTypeConfig(form.type || safeRecord.type);

    const handleChange = (field) => (event) => {
        setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

    const handleCancel = () => {
        const hasChanged =
            form.name !== safeRecord.name ||
            form.type !== safeRecord.type ||
            form.description !== safeRecord.description ||
            Boolean(file);

        if (hasChanged) {
            setShowCancelModal(true);
            return;
        }

        navigate(-1);
    };

    const handleUpdate = async (event) => {
        event.preventDefault();

        if (!form.name.trim()) {
            toast.error('Vui lòng nhập tên hồ sơ.');
            return;
        }

        setSaving(true);
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const payload = {
            title: form.name.trim(),
            name: form.name.trim(),
            recordType: form.type,
            type: form.type,
            description: form.description.trim()
        };

        try {
            if (file) {
                const formData = new FormData();
                Object.entries(payload).forEach(([key, value]) => formData.append(key, value || ''));
                formData.append('contract', file);

                await axios.patch(`${API_URL}/history/update/${id}`, formData, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await axios.patch(`${API_URL}/history/update/${id}`, payload, { headers });
            }

            toast.success('Đã lưu thay đổi hồ sơ.');
            navigate(`/ho-so/chi-tiet/${id}`);
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 405) {
                console.warn('Endpoint update chưa sẵn sàng, đang dùng mock save:', payload);
                toast.success('Đã mock lưu thay đổi. Backend chưa có endpoint update.');
                navigate(`/ho-so/chi-tiet/${id}`);
                return;
            }

            console.error('Update record error:', err);
            toast.error(err.response?.data?.message || 'Lưu thay đổi thất bại.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-[#B8985D] font-black uppercase tracking-widest">
                <ArrowPathIcon className="mr-3 h-5 w-5 animate-spin stroke-2" /> Đang tải dữ liệu...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-x-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#B8985D]/5 rounded-full blur-[120px] -z-10"></div>

            <main className="max-w-5xl mx-auto w-full px-6 py-24 relative z-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={handleCancel} className="w-fit px-6 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 hover:text-[#1A2530] transition-colors shadow-sm">
                        <ArrowLeftIcon className="w-4 h-4 stroke-2" /> Quay lại
                    </button>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#B8985D]/30 bg-[#B8985D]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#8E6D45]">
                        <CheckBadgeIcon className="h-4 w-4 stroke-2" /> Chỉnh sửa hồ sơ
                    </div>
                </div>

                <form onSubmit={handleUpdate} className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
                    <div className="border-b border-zinc-100 p-8">
                        <div className="flex items-start gap-5">
                            <div className={`rounded-2xl border border-zinc-100 p-4 shadow-sm ${config.bgColor}`}>
                                {config.icon}
                            </div>
                            <div>
                                <div className="mb-3">{renderRecordBadge({ ...safeRecord, ...form, riskScore: safeRecord.riskScore })}</div>
                                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide text-[#1A2530]">Cập nhật hồ sơ</h1>
                                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-500">
                                    Điều chỉnh tên, loại hồ sơ và mô tả. Nếu backend chưa có endpoint update, thao tác lưu sẽ được mock và log payload ra console.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-8 p-8 md:grid-cols-2">
                        <div className="space-y-6">
                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">Tên hồ sơ</label>
                                <input
                                    value={form.name}
                                    onChange={handleChange('name')}
                                    placeholder="Nhập tên hồ sơ"
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-semibold text-[#1A2530] outline-none transition placeholder:text-zinc-400 focus:border-[#B8985D] focus:bg-white focus:ring-4 focus:ring-[#B8985D]/10"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">Loại hồ sơ</label>
                                <select
                                    value={form.type}
                                    onChange={handleChange('type')}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-semibold text-[#1A2530] outline-none transition focus:border-[#B8985D] focus:bg-white focus:ring-4 focus:ring-[#B8985D]/10"
                                >
                                    <option value="">Chọn loại hồ sơ</option>
                                    {RECORD_TYPES.map(type => {
                                        const typeConfig = getTypeConfig(type);
                                        return <option key={type} value={type}>{typeConfig.label}</option>;
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">Mô tả</label>
                                <textarea
                                    value={form.description}
                                    onChange={handleChange('description')}
                                    placeholder="Nhập mô tả hồ sơ"
                                    rows={7}
                                    className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-semibold leading-6 text-[#1A2530] outline-none transition placeholder:text-zinc-400 focus:border-[#B8985D] focus:bg-white focus:ring-4 focus:ring-[#B8985D]/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#B8985D]">
                                    <DocumentArrowUpIcon className="h-4 w-4 stroke-2" /> Thay thế file
                                </h2>
                                <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-2">
                                    <UploadBox onFileSelect={setFile} />
                                </div>
                                {file && (
                                    <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                                        File mới: {file.name}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-[#B8985D]">Dữ liệu hiện tại</h2>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3">
                                        <span className="font-bold text-zinc-400">ID</span>
                                        <span className="font-semibold text-[#1A2530]">#{safeRecord.id || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3">
                                        <span className="font-bold text-zinc-400">Ngày tạo</span>
                                        <span className="font-semibold text-[#1A2530]">{safeRecord.date}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="font-bold text-zinc-400">Điểm</span>
                                        <span className="font-semibold text-[#1A2530]">{safeRecord.riskScore}/100</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 bg-zinc-50/70 px-8 py-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={saving}
                            className="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-[#1A2530] disabled:opacity-50"
                        >
                            <XMarkIcon className="mr-2 inline h-4 w-4 stroke-2" /> Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl border border-[#1A2530] bg-[#1A2530] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#263442] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {saving ? (
                                <>
                                    <ArrowPathIcon className="mr-2 inline h-4 w-4 animate-spin stroke-2" /> Đang lưu...
                                </>
                            ) : (
                                <>
                                    <CheckBadgeIcon className="mr-2 inline h-4 w-4 stroke-2" /> Lưu thay đổi
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>

            <ConfirmModal
                isOpen={showCancelModal}
                title="Hủy chỉnh sửa"
                message="Bạn có thay đổi chưa lưu. Rời trang chỉnh sửa và bỏ các thay đổi này?"
                confirmText="Rời trang"
                tone="neutral"
                loading={false}
                onClose={() => setShowCancelModal(false)}
                onConfirm={() => navigate(-1)}
            />
        </div>
    );
}
