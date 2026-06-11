import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Loader2, AlertCircle, Plus, Search, Grid, List, Mic, Clipboard, 
    Layers, BookOpen, Lightbulb, Globe, Trash2, ArrowRight, FileText, X
} from 'lucide-react';
import { listOwnItems, listSharedItems, uploadFile } from '../api/files';
import { NOTEBOOK_DRIVE_FOLDER_ID } from '../constants/notebookDrive';
import { listNotebookChats, createNotebookChat, deleteNotebookChat } from '../api/notebookChats';
import { useToast } from '../components/Toast';
import NotebookLlmContent from '../components/NotebookLlmContent';

// Premium themes with light background colors for tiles
const THEMES = [
    { bg: 'bg-[#FFEFEB]/80 hover:bg-[#FFEFEB] border-[#FDCFC4]', iconBg: 'bg-[#F25A38] text-white', icon: BookOpen },
    { bg: 'bg-[#EEF4FE]/80 hover:bg-[#EEF4FE] border-[#C2D7FC]', iconBg: 'bg-[#1A73E8] text-white', icon: BookOpen },
    { bg: 'bg-[#EAFDF5]/80 hover:bg-[#EAFDF5] border-[#B7F4DB]', iconBg: 'bg-[#0F9D58] text-white', icon: BookOpen },
    { bg: 'bg-[#FEF8E8]/80 hover:bg-[#FEF8E8] border-[#FCE8B2]', iconBg: 'bg-[#F4B400] text-white', icon: BookOpen },
    { bg: 'bg-[#FAF0FD]/80 hover:bg-[#FAF0FD] border-[#F3CFFC]', iconBg: 'bg-[#A142F4] text-white', icon: BookOpen },
    { bg: 'bg-[#E4FAFC]/80 hover:bg-[#E4FAFC] border-[#B2EBF2]', iconBg: 'bg-[#00ACC1] text-white', icon: BookOpen },
    { bg: 'bg-[#F1F3F4]/80 hover:bg-[#F1F3F4] border-[#CFD8DC]', iconBg: 'bg-[#5F6368] text-white', icon: BookOpen },
];

const RECOMMENDED_TEMPLATES = [
    { id: 'rec-1', title: 'Анализ финансового рынка РК за 2025 год', dateText: 'Рекомендовано ИИ', sourceCount: 12, icon: BookOpen, bg: 'bg-[#FAF0FD]/80 hover:bg-[#FAF0FD] border-[#F3CFFC]', iconBg: 'bg-[#A142F4] text-white', desc: 'Комплексный обзор трендов, котировок, ключевых ставок и аналитики финансового сектора Республики Казахстан.' },
    { id: 'rec-2', title: 'Developer Guide: Alem Workspace Frontend', dateText: 'Рекомендовано ИИ', sourceCount: 6, icon: BookOpen, bg: 'bg-[#EAFDF5]/80 hover:bg-[#EAFDF5] border-[#B7F4DB]', iconBg: 'bg-[#0F9D58] text-white', desc: 'Руководство для разработчиков по архитектуре, UI Kit, стейт-менеджменту и дизайн-системе Alem Workspace.' },
    { id: 'rec-3', title: 'Deep Research Assistant: Инструкция', dateText: 'Рекомендовано ИИ', sourceCount: 4, icon: BookOpen, bg: 'bg-[#FEF8E8]/80 hover:bg-[#FEF8E8] border-[#FCE8B2]', iconBg: 'bg-[#F4B400] text-white', desc: 'Как эффективно использовать источники, создавать конспекты, генерировать тесты, таблицы и презентации.' },
];

function mergeNotebookSources(ownData, sharedData) {
    const rawOwn = Array.isArray(ownData) ? ownData : ownData?.files || [];
    const rawShared = Array.isArray(sharedData) ? sharedData : sharedData?.shared || [];
    const merged = [...rawOwn];
    const seenIds = new Set(rawOwn.map((f) => f.id));
    rawShared.forEach((f) => {
        if (f.id && !seenIds.has(f.id)) {
            seenIds.add(f.id);
            merged.push(f);
        }
    });
    return merged.filter((f) => {
        if (f.type === 'dir' || f.mime_type === 'application/x-directory') return false;
        const n = (f.name || '').toLowerCase();
        return (
            n.endsWith('.docx') ||
            n.endsWith('.txt') ||
            n.endsWith('.md') ||
            n.endsWith('.pptx') ||
            n.endsWith('.ppt') ||
            n.endsWith('.xlsx') ||
            n.endsWith('.xls') ||
            n.endsWith('.xlsm')
        );
    });
}

const getSourcesWord = (count) => {
    const x10 = count % 10;
    const x100 = count % 100;
    if (x100 >= 11 && x100 <= 19) return 'источников';
    if (x10 === 1) return 'источник';
    if (x10 >= 2 && x10 <= 4) return 'источника';
    return 'источников';
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'Недавно';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return 'Недавно';
    }
};

const Notebook = () => {
    const [files, setFiles] = useState([]);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [creatingChat, setCreatingChat] = useState(false);
    const [chatNameModalOpen, setChatNameModalOpen] = useState(false);
    const [chatNameInput, setChatNameInput] = useState('');
    const [chatNameSuggested, setChatNameSuggested] = useState('Чат Deep Research Assistant');
    const [notebookImportBusy, setNotebookImportBusy] = useState(false);
    const { addToast } = useToast();

    // Dashboard states
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [dashboardSort, setDashboardSort] = useState('recent'); // 'recent' | 'alphabetical'
    const [dashboardFilter, setDashboardFilter] = useState('my'); // 'all' | 'my' | 'recommended'

    const refreshNotebookFiles = useCallback(async () => {
        const [ownData, sharedData] = await Promise.all([listOwnItems(), listSharedItems()]);
        setFiles(mergeNotebookSources(ownData, sharedData));
    }, []);

    const handleImportNotebookFile = useCallback(
        async (file) => {
            const n = (file?.name || '').toLowerCase();
            const ok =
                n.endsWith('.txt') ||
                n.endsWith('.md') ||
                n.endsWith('.docx') ||
                n.endsWith('.pptx') ||
                n.endsWith('.ppt') ||
                n.endsWith('.xlsx') ||
                n.endsWith('.xls') ||
                n.endsWith('.xlsm');
            if (!ok) {
                addToast('Допустимые форматы: .txt, .md, .docx, .pptx, .ppt, .xlsx, .xls, .xlsm', 'warning');
                return;
            }
            setNotebookImportBusy(true);
            try {
                await uploadFile(file, NOTEBOOK_DRIVE_FOLDER_ID);
                addToast(`Файл «${file.name}» загружен`, 'success');
                await refreshNotebookFiles();
            } catch (err) {
                console.error('Notebook file upload failed', err);
                addToast('Не удалось загрузить файл', 'error');
            } finally {
                setNotebookImportBusy(false);
            }
        },
        [addToast, refreshNotebookFiles]
    );

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [ownData, sharedData, chatsData] = await Promise.all([
                    listOwnItems(),
                    listSharedItems(),
                    listNotebookChats(),
                ]);
                setFiles(mergeNotebookSources(ownData, sharedData));

                const rawChats = Array.isArray(chatsData?.data)
                    ? chatsData.data
                    : Array.isArray(chatsData?.chats)
                        ? chatsData.chats
                        : Array.isArray(chatsData)
                            ? chatsData
                            : [];
                setChats(rawChats);
                // Keep selectedChatId as null so the grid dashboard is showed initially
            } catch (err) {
                console.error('Failed to load files for Deep Research Assistant', err);
                setError('Не удалось загрузить файлы');
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreateChatModal = () => {
        let suggestedTitle = 'Чат Deep Research Assistant';
        if (files.length === 1) {
            suggestedTitle = `Чат: ${files[0].name}`;
        } else if (files.length > 1) {
            suggestedTitle = `Чат по ${files.length} документам`;
        }
        setChatNameSuggested(suggestedTitle);
        setChatNameInput(suggestedTitle);
        setChatNameModalOpen(true);
    };

    const handleConfirmCreateChat = async () => {
        try {
            setCreatingChat(true);
            const title = (chatNameInput || chatNameSuggested || 'Чат Deep Research Assistant').trim();
            const data = await createNotebookChat(title);
            const newChat = data?.data || data;
            if (!newChat) return;
            setChats((prev) => [...prev, newChat]);
            const id = newChat.id || newChat.chat_id || newChat.uuid || newChat.chatId;
            if (id) setSelectedChatId(id);
            setChatNameModalOpen(false);
        } catch (err) {
            console.error('Failed to create Notebook chat', err);
        } finally {
            setCreatingChat(false);
        }
    };

    const handleSelectRecommended = async (template) => {
        try {
            setCreatingChat(true);
            addToast(`Импорт шаблона «${template.title}»...`, 'info');
            const data = await createNotebookChat(template.title);
            const newChat = data?.data || data;
            if (!newChat) return;
            setChats((prev) => [...prev, newChat]);
            const id = newChat.id || newChat.chat_id || newChat.uuid || newChat.chatId;
            if (id) {
                setSelectedChatId(id);
                addToast('Шаблон успешно импортирован!', 'success');
            }
        } catch (err) {
            console.error('Failed to import template', err);
            addToast('Не удалось импортировать шаблон', 'error');
        } finally {
            setCreatingChat(false);
        }
    };

    // Sort and Search notebooks
    const filteredAndSortedChats = useMemo(() => {
        let list = [...chats];
        if (dashboardSearch.trim()) {
            const q = dashboardSearch.toLowerCase();
            list = list.filter((chat) => (chat.title || '').toLowerCase().includes(q));
        }
        if (dashboardSort === 'alphabetical') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else {
            list.sort((a, b) => {
                const da = new Date(a.updated_at || a.created_at || 0);
                const db = new Date(b.updated_at || b.created_at || 0);
                return db - da;
            });
        }
        return list;
    }, [chats, dashboardSearch, dashboardSort]);

    const isTablet = location.pathname.includes('/tablet');

    if (loading) {
        return (
            <div className="flex h-full w-full min-w-0 items-center justify-center bg-[#f8f9fa]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-slate-600 animate-spin" />
                    <p className="text-sm text-gray-500">Загрузка документов...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full w-full min-w-0 flex-col items-center justify-center bg-[#f8f9fa] px-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-base text-gray-700 text-center mb-4">{error}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-5 py-2.5 rounded-xl bg-[#1E88E5] text-white text-sm font-medium hover:bg-[#1565C0]"
                >
                    Обновить
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex h-full min-h-0 w-full min-w-0 flex-col bg-[#f8f9fa]`}
        >
            <AnimatePresence mode="wait">
                {selectedChatId ? (
                    <motion.div
                        key="workspace-view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
                    >
                        <NotebookLlmContent
                            files={files}
                            embedded
                            activeChatId={selectedChatId}
                            chats={chats}
                            onSelectChat={setSelectedChatId}
                            onCreateChat={openCreateChatModal}
                            creatingChat={creatingChat}
                            chatSearchQuery={searchQuery}
                            onChatSearchChange={setSearchQuery}
                            onImportNotebookFile={handleImportNotebookFile}
                            notebookImportBusy={notebookImportBusy}
                            onBack={() => setSelectedChatId(null)}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="dashboard-view"
                        initial={{ opacity: 0, y: -15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#f8f9fa] px-6 py-6 md:px-8 overflow-y-auto"
                    >
                        {/* Top Action & Navigation Bar */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                            <div>
                                <h1 className="text-xl font-bold text-[#0F172A] tracking-tight sm:text-2xl flex items-center gap-2">
                                    <Layers className="w-6 h-6 text-[#1A73E8]" />
                                    Блокноты Deep Research
                                </h1>
                                <p className="text-xs text-slate-500 mt-1">
                                    Интеллектуальные исследования, отчеты и презентации на основе ваших документов
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Search Field */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={dashboardSearch}
                                        onChange={(e) => setDashboardSearch(e.target.value)}
                                        placeholder="Поиск блокнота..."
                                        className="pl-9 pr-4 py-2 w-48 sm:w-56 rounded-full border border-[#DDE3EE] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* View options (Grid/List) */}
                                <div className="hidden sm:flex items-center border border-[#DDE3EE] bg-white p-1 rounded-xl">
                                    <button className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                                        <Grid className="w-3.5 h-3.5" />
                                    </button>
                                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                                        <List className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Sorting Option */}
                                <select
                                    value={dashboardSort}
                                    onChange={(e) => setDashboardSort(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-[#DDE3EE] bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                >
                                    <option value="recent">Последние</option>
                                    <option value="alphabetical">По алфавиту</option>
                                </select>

                                {/* Action Buttons */}
                                <button
                                    onClick={openCreateChatModal}
                                    className="inline-flex items-center gap-1.5 bg-[#1E88E5] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#1565C0] hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Создать блокнот
                                </button>
                            </div>
                        </div>

                        {/* Category Tab Selector */}
                        <div className="flex items-center justify-end mt-6">
                            <span className="text-xs font-medium text-slate-400">
                                Всего: {chats.length}
                            </span>
                        </div>

                        {/* Bento Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6 pb-12">
                            {/* Card: Create New Notebook */}
                            {dashboardFilter !== 'recommended' && (
                                <button
                                    onClick={openCreateChatModal}
                                    className="group relative flex flex-col items-center justify-center h-48 rounded-[24px] border-2 border-dashed border-[#DDE3EE] hover:border-slate-400 bg-white hover:bg-slate-50/50 transition-all duration-300 shadow-sm"
                                >
                                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-100 border border-[#EBEFF5] group-hover:scale-105 transition-all mb-3 shadow-inner">
                                        <Plus className="w-6 h-6 text-slate-500" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800">Создать блокнот</span>
                                </button>
                            )}

                            {/* Render Recommended Templates */}
                            {dashboardFilter === 'recommended' && (
                                RECOMMENDED_TEMPLATES.map((tmpl) => {
                                    const IconComp = tmpl.icon;
                                    return (
                                        <div
                                            key={tmpl.id}
                                            onClick={() => handleSelectRecommended(tmpl)}
                                            className={`group relative flex flex-col justify-between h-48 p-5 rounded-[24px] border border-[#E2E8F0] shadow-sm hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:border-slate-300 transition-all duration-300 cursor-pointer overflow-hidden ${tmpl.bg}`}
                                        >
                                            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/20 blur-xl group-hover:scale-110 transition-all pointer-events-none" />
                                            <div className="flex items-start justify-between">
                                                <div className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm border border-white/20 ${tmpl.iconBg}`}>
                                                    <IconComp className="w-5.5 h-5.5" />
                                                </div>
                                                <span className="text-[10px] font-bold tracking-wider uppercase bg-white/80 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                                                    Шаблон
                                                </span>
                                            </div>
                                            <div className="mt-4 flex-1">
                                                <h4 className="font-bold text-slate-800 leading-snug tracking-tight text-[14px] line-clamp-2">
                                                    {tmpl.title}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-normal">
                                                    {tmpl.desc}
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                                                <span>{tmpl.dateText}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-white/60 border border-slate-200/40 text-slate-600">
                                                    {tmpl.sourceCount} источников
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Render User Notebooks */}
                            {dashboardFilter !== 'recommended' && (
                                filteredAndSortedChats.length === 0 ? (
                                    dashboardSearch.trim() && (
                                        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm">
                                            <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
                                            <p className="text-sm font-semibold text-slate-700">Ничего не найдено</p>
                                            <p className="text-xs text-slate-400 mt-1">Попробуйте изменить запрос поиска</p>
                                        </div>
                                    )
                                ) : (
                                    filteredAndSortedChats.map((chat, idx) => {
                                        const id = chat.id || chat.chat_id || chat.uuid || chat.chatId;
                                        const theme = THEMES[idx % THEMES.length];
                                        const IconComp = theme.icon;
                                        const title = chat.title || 'Без названия';
                                        const dateText = formatDate(chat.updated_at || chat.created_at);
                                        const sourceCount = chat.documents?.length || 1;
                                        const sourceLabel = `${sourceCount} ${getSourcesWord(sourceCount)}`;

                                        return (
                                            <div
                                                key={id}
                                                onClick={() => setSelectedChatId(id)}
                                                className={`group relative flex flex-col justify-between h-48 p-5 rounded-[24px] border border-[#E2E8F0] shadow-sm hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:border-slate-300 transition-all duration-300 cursor-pointer overflow-hidden ${theme.bg}`}
                                            >
                                                {/* Floating pattern */}
                                                <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/20 blur-xl group-hover:scale-110 transition-all pointer-events-none" />

                                                {/* Top row */}
                                                <div className="flex items-start justify-between">
                                                    <div className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm border border-white/20 ${theme.iconBg}`}>
                                                        <IconComp className="w-5.5 h-5.5" />
                                                    </div>

                                                    {/* Quick Delete option */}
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (window.confirm(`Вы действительно хотите удалить блокнот «${title}»?`)) {
                                                                try {
                                                                    await deleteNotebookChat(id);
                                                                    setChats((prev) => prev.filter((c) => (c.id || c.chat_id || c.uuid || c.chatId) !== id));
                                                                    if (selectedChatId === id) setSelectedChatId(null);
                                                                    addToast(`Блокнот «${title}» успешно удален`, 'success');
                                                                  } catch (err) {
                                                                    console.error('Failed to delete notebook chat', err);
                                                                    addToast('Не удалось удалить блокнот на сервере', 'error');
                                                                }
                                                            }
                                                        }}
                                                        className="relative z-10 opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-xl bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 shadow-sm border border-[#EBEFF5] transition-all"
                                                        title="Удалить блокнот"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Title */}
                                                <div className="mt-4 flex-1">
                                                    <h4 className="font-bold text-slate-800 leading-snug tracking-tight text-[14px] group-hover:text-slate-900 transition-colors line-clamp-2">
                                                        {title}
                                                    </h4>
                                                </div>

                                                {/* Footer */}
                                                <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between text-[11px] font-medium text-slate-500">
                                                    <span className="tabular-nums">{dateText}</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-white/60 border border-slate-200/40 text-slate-600">
                                                        {sourceLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal for creating a new Notebook */}
            {chatNameModalOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="notebook-new-chat-title"
                    >
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-[#E2E8F0]">
                            <div className="flex items-center justify-between mb-2">
                                <h3 id="notebook-new-chat-title" className="text-base font-bold text-gray-900">
                                    Новый блокнот
                                </h3>
                                <button
                                    onClick={() => setChatNameModalOpen(false)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                Задайте понятное название для вашей исследовательской среды.
                            </p>
                            <input
                                type="text"
                                value={chatNameInput}
                                onChange={(e) => setChatNameInput(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent mb-4 transition-all"
                                placeholder={chatNameSuggested}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setChatNameModalOpen(false);
                                        setChatNameInput('');
                                    }}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl hover:bg-gray-100 transition-all"
                                    disabled={creatingChat}
                                >
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCreateChat}
                                    disabled={creatingChat || !chatNameInput.trim()}
                                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#1E88E5] text-white hover:bg-[#1565C0] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                    {creatingChat ? 'Создание…' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </motion.div>
    );
};

export default Notebook;
