import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Database, Users, Scale, MessageSquare, Settings, ShieldCheck,
    LogOut
} from 'lucide-react';

const navigationItems = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
    { key: 'users', label: 'Quản lý Người dùng', icon: Users, path: '/admin/users' },
    { key: 'crawl', icon: Database, label: 'Trình thu thập', path: '/admin/crawl' },
    { key: 'lawdata', icon: Scale, label: 'Quản lý data luật', path: '/admin/lawdata' },
    { key: 'feedback', icon: MessageSquare, label: 'Quản lý phản hồi', path: '/admin/feedback' },
    { key: 'settings', icon: Settings, label: 'Cài đặt', path: '/admin/settings' },
];

export default function AdminSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <aside className="w-68 border-r border-gray-200 bg-white flex flex-col p-6 gap-8 sticky top-0 h-screen shrink-0 transition-all">
            {/* LOGO LEGAI HUB */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    <ShieldCheck className="text-white w-6 h-6" />
                </div>
                <span className="font-black text-xl tracking-tighter text-gray-900 uppercase">
                    LEGAI <span className="text-amber-500">HUB</span>
                </span>
            </div>

            {/* NAVIGATION MENU */}

            <nav className="flex flex-col gap-2">
                {navigationItems.map((item) => {
                    const active = item.path === location.pathname;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${active
                                ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                : 'hover:bg-gray-50 hover:text-gray-900 text-gray-600'
                                }`}
                        >
                            <Icon size={18} className="shrink-0" />

                            <span className="text-[10px] font-bold uppercase tracking-widest text-left flex-1 whitespace-nowrap overflow-hidden">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* NÚT THOÁT VỀ TRANG USER */}

            <div className="mt-2 pt-6 border-t border-gray-200">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] group"
                >
                    <LogOut size={18} className="shrink-0 transition-transform group-hover:-translate-x-1" />

                    <span className="text-[10px] font-bold uppercase tracking-widest text-left flex-1 whitespace-nowrap overflow-hidden">
                        OUT
                    </span>
                </button>
            </div>
        </aside>
    );
}