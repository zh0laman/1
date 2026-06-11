import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Clock, Users, MessageCircle, PanelLeftClose, PanelLeft, Plus, FolderPlus, UploadCloud, FileText, FileSpreadsheet, FileType, MonitorPlay } from 'lucide-react';
import { getMe } from '../api/auth';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <motion.div
        onClick={onClick}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
            "flex items-center px-3 py-2.5 cursor-pointer rounded-xl transition-all font-medium text-[13.5px] min-w-0 select-none",
            active
                ? "bg-[#EBF4FE] text-[#1E88E5]"
                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
        )}
    >
        <Icon className={clsx("h-[17px] w-[17px] mr-2.5 shrink-0", active ? "text-[#1E88E5]" : "text-[#94A3B8]")} />
        <span className="truncate min-w-0 flex-1">{label}</span>
    </motion.div>
);

const SIDEBAR_COLLAPSED_KEY = 'dashboard_sidebar_collapsed';

const DashboardLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
    });
    const [createOpen, setCreateOpen] = useState(false);

    const isTablet = location.pathname.includes('/tablet');
    const isNotebook = location.pathname.includes('/notebook');

    const toggleSidebar = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch {}
            return next;
        });
    };

    const handleCreate = (type) => {
        setCreateOpen(false);
        document.dispatchEvent(new CustomEvent('alem-drive-create', { detail: type }));
    };

    // Close create menu on outside click
    useEffect(() => {
        if (!createOpen) return;
        const close = () => setCreateOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [createOpen]);

    if (isTablet) {
        return (
            <div className="flex h-full bg-[#F8FAFC]">
                <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-[#F8FAFC] p-3">
            {/* ── SIDEBAR ── */}
            <div
                className="flex-shrink-0 bg-white border border-[#E8EDF2] rounded-[28px] shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col transition-[width] duration-300 ease-in-out z-40 overflow-hidden"
                style={{ width: sidebarCollapsed ? 56 : 240 }}
            >
                {sidebarCollapsed ? (
                    /* ─── COLLAPSED ─── */
                    <div className="flex flex-col items-center pt-3 pb-4 h-full gap-1">
                        {/* Expand button */}
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#1E88E5] hover:bg-[#EBF4FE] transition-colors mb-2"
                            title="Развернуть меню"
                        >
                            <PanelLeft className="h-4.5 w-4.5" />
                        </button>

                        {/* Create (round) */}
                        <button
                            type="button"
                            onClick={() => setCreateOpen((v) => !v)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0] active:scale-95 transition-all mb-3"
                            title="Создать"
                        >
                            <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                        </button>

                        {/* Nav icons */}
                        {[
                            { icon: Layout, path: '/drive', exact: true, title: 'Все файлы' },
                            { icon: Users, path: '/drive/shared', title: 'Доступные мне' },
                            { icon: Clock, path: '/drive/recent', title: 'Недавние' },
                            { icon: MessageCircle, path: '/drive/notebook', title: 'Deep Research' },
                        ].map(({ icon: Icon, path, exact, title }) => {
                            const active = exact
                                ? location.pathname === path || location.pathname.startsWith('/drive/f/')
                                : location.pathname.startsWith(path);
                            return (
                                <button
                                    key={path}
                                    type="button"
                                    onClick={() => navigate(path)}
                                    title={title}
                                    className={clsx(
                                        "w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95",
                                        active ? "bg-[#EBF4FE] text-[#1E88E5]" : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]"
                                    )}
                                >
                                    <Icon className="h-[18px] w-[18px]" />
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    /* ─── EXPANDED ─── */
                    <div className="flex flex-col h-full">
                        {/* Logo row */}
                        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                            <img
                                src={`${import.meta.env.BASE_URL}alem-drive-logo.png`}
                                alt="Alem Drive"
                                className="h-[22px] w-auto"
                            />
                            <button
                                type="button"
                                onClick={toggleSidebar}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#1E88E5] hover:bg-[#EBF4FE] transition-colors"
                                title="Свернуть меню"
                            >
                                <PanelLeftClose className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Create button — full width, blue */}
                        <div className="px-3 pb-3 relative" onMouseDown={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setCreateOpen((v) => !v)}
                                className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-[#1E88E5] text-white text-[13px] font-semibold shadow-sm hover:bg-[#1565C0] active:scale-[0.98] transition-all"
                            >
                                <Plus className="h-4 w-4 stroke-[2.5]" />
                                Создать
                            </button>

                            {/* Dropdown */}
                            <AnimatePresence>
                                {createOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute left-3 right-3 top-full mt-1.5 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.1)] border border-[#E2E8F0] py-1.5 z-50"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        {[
                                            { type: 'folder', icon: FolderPlus, label: 'Новую папку', color: 'text-[#1E88E5]' },
                                            { type: 'upload', icon: UploadCloud, label: 'Загрузить файл', color: 'text-[#64748B]' },
                                        ].map(({ type, icon: Icon, label, color }) => (
                                            <button key={type} onClick={() => handleCreate(type)}
                                                className="w-full flex items-center px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors">
                                                <Icon className={`h-4 w-4 mr-2.5 ${color}`} />{label}
                                            </button>
                                        ))}
                                        <div className="h-px bg-[#E8EDF2] mx-3 my-1" />
                                        {[
                                            { type: 'docx', icon: FileText, label: 'Word документ', color: 'text-blue-500' },
                                            { type: 'xlsx', icon: FileSpreadsheet, label: 'Excel таблицу', color: 'text-green-500' },
                                            { type: 'pptx', icon: MonitorPlay, label: 'Презентацию', color: 'text-orange-500' },
                                            { type: 'txt', icon: FileType, label: 'Текстовый файл', color: 'text-slate-400' },
                                        ].map(({ type, icon: Icon, label, color }) => (
                                            <button key={type} onClick={() => handleCreate(type)}
                                                className="w-full flex items-center px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors">
                                                <Icon className={`h-4 w-4 mr-2.5 ${color}`} />{label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 px-2 overflow-y-auto">
                            <div className="flex flex-col gap-0.5">
                                <SidebarItem icon={Layout} label="Все файлы"
                                    active={location.pathname === '/drive' || location.pathname.startsWith('/drive/f/')}
                                    onClick={() => navigate('/drive')} />
                                <SidebarItem icon={Users} label="Доступные мне"
                                    active={location.pathname.startsWith('/drive/shared')}
                                    onClick={() => navigate('/drive/shared')} />
                                <SidebarItem icon={Clock} label="Недавние"
                                    active={location.pathname.startsWith('/drive/recent')}
                                    onClick={() => navigate('/drive/recent')} />
                                <SidebarItem icon={MessageCircle} label="Deep Research"
                                    active={location.pathname.startsWith('/drive/notebook')}
                                    onClick={() => navigate('/drive/notebook')} />
                            </div>
                        </nav>
                    </div>
                )}
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC] min-w-0 pl-3">
                <main className={clsx(
                    'min-w-0 flex-1 rounded-[28px] bg-white border border-[#E8EDF2]',
                    isNotebook ? 'flex flex-col overflow-hidden p-0' : 'overflow-auto p-6 lg:p-8'
                )}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
