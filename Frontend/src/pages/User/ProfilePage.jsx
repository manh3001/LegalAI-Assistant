import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import axiosClient from '../../api/axiosClient';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ShieldExclamationIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const getInitials = (fullName) => {
  if (!fullName) return 'LG';
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0].toUpperCase())
    .join('');
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [securityData, setSecurityData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setFormData({
        fullName: parsed.fullName || '',
        email: parsed.email || '',
      });
    } catch (err) {
      console.error('ProfilePage load user error', err);
      navigate('/login');
    }
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSecurityChange = (field, value) => {
    setSecurityData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!formData.fullName.trim()) {
      toast.error('Họ và tên không được để trống.');
      return;
    }

    const hasPasswordChange = securityData.currentPassword || securityData.newPassword || securityData.confirmPassword;
    if (hasPasswordChange) {
      if (!securityData.currentPassword) {
        toast.error('Nhập mật khẩu hiện tại để tiếp tục.');
        return;
      }
      if (!securityData.newPassword) {
        toast.error('Nhập mật khẩu mới.');
        return;
      }
      if (securityData.newPassword !== securityData.confirmPassword) {
        toast.error('Mật khẩu mới và xác nhận không khớp.');
        return;
      }
      if (securityData.newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
      }
    }

    if (formData.fullName.trim() === (user?.fullName || '') && !hasPasswordChange) {
      toast('Không có thay đổi nào để lưu.');
      return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }

      const payload = { fullName: formData.fullName.trim() };
      if (securityData.newPassword) {
        payload.currentPassword = securityData.currentPassword;
        payload.newPassword = securityData.newPassword;
      }

      const response = await axiosClient.put('/users/profile', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedUser = response.data?.user;
      if (!updatedUser) {
        throw new Error(response.data?.message || 'Lưu hồ sơ thất bại.');
      }

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setFormData({ fullName: updatedUser.fullName || '', email: updatedUser.email || '' });
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Thông tin hồ sơ đã được cập nhật.');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Không thể lưu thay đổi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Nhập mật khẩu xác nhận để xóa tài khoản.');
      return;
    }

    try {
      setIsDeleting(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }

      const response = await axiosClient.delete('/users/account', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { password: deletePassword },
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Xóa tài khoản thất bại.');
      }

      toast.success('Tài khoản đã được xóa thành công.');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Không thể xóa tài khoản.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-zinc-50" />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="rounded-[2rem] border border-zinc-200 bg-white/90 p-8 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-zinc-400">Hồ sơ cá nhân</p>
                <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-950">Quản lý thông tin</h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-500 mt-2">
                  Cập nhật tên và mật khẩu của bạn. Email là định danh cố định bảo mật hồ sơ pháp lý.
                </p>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-zinc-200 bg-zinc-100 px-5 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B8985D]/10 text-2xl font-black text-[#8E6D45]">
                  {getInitials(user.fullName)}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Tài khoản</p>
                  <p className="text-lg font-bold text-zinc-950">{user.fullName || user.email}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.form
            onSubmit={handleSaveProfile}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="relative rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm"
          >
            <div className="grid gap-8">
              <section className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-950">Identity</h2>
                    <p className="mt-2 text-sm text-zinc-500">Thông tin cá nhân và email liên hệ.</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <UserCircleIcon className="h-5 w-5" />
                    <span>Minimalist · Zinc · Vàng đồng</span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="space-y-3">
                    <span className="text-sm font-bold text-zinc-700">Họ và tên</span>
                    <input
                      value={formData.fullName}
                      onChange={(event) => handleInputChange('fullName', event.target.value)}
                      className="w-full rounded-[1rem] border border-zinc-200 bg-zinc-50 px-4 py-4 text-lg font-bold text-zinc-900 outline-none transition focus:border-[#B8985D] focus:ring-2 focus:ring-[#B8985D]/20"
                    />
                  </label>

                  <label className="space-y-3">
                    <span className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                      Email
                      <span
                        title="Email là định danh cố định để bảo mật hồ sơ pháp lý"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
                      >
                        i
                      </span>
                    </span>
                    <div className="relative">
                      <LockClosedIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={formData.email}
                        readOnly
                        className="w-full rounded-[1rem] border border-zinc-200 bg-zinc-50/80 px-12 py-4 text-zinc-600 opacity-60 outline-none"
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-950">Bảo mật</h2>
                    <p className="mt-2 text-sm text-zinc-500">Đổi mật khẩu hiện tại của bạn để bảo vệ hồ sơ.</p>
                  </div>
                  <div className="rounded-3xl bg-[#F7EFD6] px-4 py-2 text-sm font-semibold text-[#8E6D45]">
                    Mật khẩu mới
                  </div>
                </div>

                <div className="grid gap-5">
                  {[
                    { key: 'currentPassword', label: 'Mật khẩu hiện tại' },
                    { key: 'newPassword', label: 'Mật khẩu mới' },
                    { key: 'confirmPassword', label: 'Xác nhận mật khẩu mới' },
                  ].map((field) => (
                    <label key={field.key} className="space-y-2">
                      <span className="text-sm font-semibold text-zinc-700">{field.label}</span>
                      <div className="relative">
                        <input
                          type={showPassword[field.key.replace('Password', '')] ? 'text' : 'password'}
                          value={securityData[field.key]}
                          onChange={(event) => handleSecurityChange(field.key, event.target.value)}
                          placeholder={field.label}
                          className="w-full rounded-[1rem] border border-zinc-200 bg-zinc-50 px-4 py-4 pr-14 text-zinc-900 outline-none transition focus:border-[#B8985D] focus:ring-2 focus:ring-[#B8985D]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => ({
                            ...prev,
                            [field.key.replace('Password', '')]: !prev[field.key.replace('Password', '')],
                          }))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
                        >
                          {showPassword[field.key.replace('Password', '')] ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-6 rounded-[1.75rem] border border-rose-200/80 bg-rose-50/50 p-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                    <ShieldExclamationIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-rose-700">Danger Zone</h2>
                    <p className="text-sm text-rose-500">Xóa tài khoản sẽ xoá dữ liệu hồ sơ cá nhân của bạn.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-2xl border border-rose-200 px-5 py-3 text-sm font-bold text-rose-500 transition hover:bg-rose-100"
                >
                  <TrashIcon className="mr-2 h-5 w-5" /> Xóa tài khoản
                </button>
              </section>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="absolute right-8 bottom-8 rounded-2xl bg-[#B8985D] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-[#B8985D]/20 transition hover:bg-[#8E6D45] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </motion.form>
        </div>
      </main>

      <AnimatePresence>
        {isDeleteModalOpen &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-400">Xác thực nguy hiểm</p>
                    <h2 className="mt-3 text-2xl font-bold text-zinc-950">Xóa tài khoản</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200"
                  >
                    <ChevronRightIcon className="h-5 w-5 rotate-180" />
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  Để tiếp tục, hãy nhập mật khẩu hiện tại. Đây là bước xác nhận cuối cùng trước khi xóa toàn bộ tài khoản của bạn.
                </p>

                <div className="mt-6 space-y-4">
                  <label className="space-y-2 text-sm font-semibold text-zinc-700">
                    Mật khẩu xác nhận
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      className="w-full rounded-[1rem] border border-zinc-200 bg-zinc-50 px-4 py-4 text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </label>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </motion.div>
            </motion.div>,
            document.body
          )}
      </AnimatePresence>
    </div>
  );
}
