import React, { useState, useEffect } from 'react';
import { UserGroupIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

export default function LawyerCard() {
    const [lawyer, setLawyer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLawyer = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api/ai/lawyers/random');
                if (response.data.success) {
                    setLawyer(response.data.data);
                } else {
                    setError('Không có luật sư khả dụng');
                }
            } catch (err) {
                console.error('Lỗi khi lấy thông tin luật sư:', err);
                setError('Không thể tải thông tin luật sư');
            } finally {
                setLoading(false);
            }
        };

        fetchLawyer();
    }, []);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 text-center">
                <div className="animate-pulse">
                    <div className="w-8 h-8 bg-amber-400 rounded-full mx-auto mb-3"></div>
                    <div className="h-4 bg-amber-400 rounded mb-2"></div>
                    <div className="h-3 bg-amber-400 rounded mb-4"></div>
                    <div className="h-3 bg-amber-400 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !lawyer) {
        return (
            <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="flex justify-center mb-3">
                    <UserGroupIcon className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-red-300 mb-2">Không thể tải thông tin luật sư</h3>
                <p className="text-sm text-gray-300 mb-4">
                    {error || 'Vui lòng thử lại sau.'}
                </p>
                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
                        <PhoneIcon className="w-4 h-4" />
                        <span>Hotline: 1900-xxxx</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
                        <EnvelopeIcon className="w-4 h-4" />
                        <span>Email: support@legai.vn</span>
                    </div>
                </div>
                <button className="mt-4 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">
                    Liên Hệ Hỗ Trợ
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
            <div className="flex justify-center mb-3">
                <UserGroupIcon className="w-8 h-8 text-sky-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cần Tư Vấn Luật Sư</h3>
            <p className="text-sm text-slate-600 mb-4">
                Vấn đề của bạn quá phức tạp hoặc cần chuyên gia. Hãy liên hệ luật sư để được hỗ trợ chi tiết.
            </p>
            <div className="bg-slate-100 rounded-lg p-3 mb-4">
                <h4 className="text-slate-900 font-semibold mb-2">{lawyer.FullName}</h4>
                <div className="space-y-1 text-sm text-slate-700">
                    <div className="flex items-center justify-center gap-2">
                        <PhoneIcon className="w-4 h-4 text-slate-500" />
                        <span>{lawyer.Phone}</span>
                    </div>
                    <div className="text-center">
                        <span className="text-xs text-slate-500">Chuyên môn:</span>
                        <p className="text-sm text-slate-800">{lawyer.Specialty}</p>
                    </div>
                </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors">
                Liên Hệ Ngay
            </button>
        </div>
    );
}