import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, MoreVertical, Image, Share2, Trash2, MonitorPlay, ExternalLink, MessageCircle, Edit3, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FileIcon = ({ type, name }) => {
    if (type === 'folder' || type === 'dir') return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EBF4FE] text-[#1E88E5] border border-[#BBDEFB] shrink-0">
            <Folder className="h-5.5 w-5.5 fill-current text-[#1E88E5]" />
        </div>
    );
    if (type?.startsWith('image')) return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
            <Image className="h-5.5 w-5.5 text-purple-600" />
        </div>
    );
    if (name?.endsWith('.pptx') || type?.includes('presentation')) return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
            <MonitorPlay className="h-5.5 w-5.5 text-orange-600" />
        </div>
    );
    if (name?.endsWith('.xlsx') || type?.includes('spreadsheet')) return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-600 border border-green-100 shrink-0">
            <FileText className="h-5.5 w-5.5 text-green-600" />
        </div>
    );
    if (name?.endsWith('.pdf')) return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100 shrink-0">
            <FileText className="h-5.5 w-5.5 text-red-600" />
        </div>
    );
    return (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <FileText className="h-5.5 w-5.5 text-blue-600" />
        </div>
    );
};

const FileCard = ({ file, onEdit, onShare, onDelete, onRename, onSendToMessenger, selected, onSelect }) => {
    const isFolder = file.type === 'dir' || file.mime_type === 'application/x-directory';
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    const handleAction = (action, e) => {
        e.stopPropagation();
        setShowMenu(false);
        if (action === 'open') {
            onEdit(file);
        } else if (action === 'share') {
            onShare?.(file);
        } else if (action === 'messenger') {
            onSendToMessenger?.(file);
        } else if (action === 'rename') {
            onRename?.(file);
        } else if (action === 'delete') {
            onDelete?.(file);
        }
    };

    const toggleMenu = (e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    };

    const handleSelect = (e) => {
        e.stopPropagation();
        onSelect?.(file.id);
    };

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`group bg-white border rounded-3xl p-4 transition-all duration-300 cursor-pointer relative shadow-[0_4px_16px_rgba(0,0,0,0.01)] ${
                selected 
                    ? 'border-[#1E88E5] ring-1 ring-[#1E88E5]/30 bg-[#EBF4FE]/10 shadow-[0_8px_32px_rgba(30,136,229,0.04)]' 
                    : 'border-[#E2E8F0] hover:shadow-[0_12px_32px_rgba(30,136,229,0.03)] hover:border-[#1E88E5]/30'
            } ${showMenu ? 'z-50' : ''}`}
            onClick={() => onEdit(file)}
        >
            {/* Selection Checkbox */}
            {onSelect && (
                <div
                    onClick={handleSelect}
                    className="absolute top-4 left-4 z-10 p-0.5 rounded-lg transition-all"
                >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        selected 
                            ? 'bg-[#1E88E5] border-[#1E88E5]' 
                            : 'bg-white border-[#CBD5E1] group-hover:border-[#1E88E5] hover:scale-105'
                    }`}>
                        {selected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-start mb-4 pl-7">
                <div className="flex-shrink-0">
                    <FileIcon type={isFolder ? 'folder' : file.mime_type} name={file.name} />
                </div>

                <div className="relative" ref={menuRef}>
                    <button
                        onClick={toggleMenu}
                        className={`p-1.5 rounded-xl transition-all active:scale-95 ${
                            showMenu 
                                ? 'bg-[#E2E8F0] text-gray-700' 
                                : 'text-[#94A3B8] hover:text-[#475569] hover:bg-slate-100'
                        }`}
                    >
                        <MoreVertical className="h-4.5 w-4.5 stroke-[2.5]" />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                transition={{ duration: 0.12, ease: "easeOut" }}
                                className="absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0] py-1.5 z-20"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={(e) => handleAction('open', e)}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2 text-[#94A3B8]" />
                                    Открыть
                                </button>

                                {onRename && (
                                    <button
                                        onClick={(e) => handleAction('rename', e)}
                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors"
                                    >
                                        <Edit3 className="h-4 w-4 mr-2 text-[#94A3B8]" />
                                        Переименовать
                                    </button>
                                )}

                                {onSendToMessenger && (
                                    <button
                                        onClick={(e) => handleAction('messenger', e)}
                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors"
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2 text-blue-500" />
                                        Отправить в чат
                                    </button>
                                )}

                                {!isFolder && onShare && (
                                    <button
                                        onClick={(e) => handleAction('share', e)}
                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors"
                                    >
                                        <Share2 className="h-4 w-4 mr-2 text-purple-500" />
                                        Поделиться
                                    </button>
                                )}

                                {onDelete && (
                                    <>
                                        <div className="h-px bg-[#E2E8F0] my-1.5 mx-2" />
                                        <button
                                            onClick={(e) => handleAction('delete', e)}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Удалить
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <h3 className="text-xs font-bold text-gray-800 truncate mb-1 pr-1 group-hover:text-[#1E88E5] transition-colors" title={file.name}>{file.name}</h3>
            <p className="text-[10px] text-[#94A3B8] font-semibold">{isFolder ? 'Папка' : formatSize(file.size)}</p>
        </motion.div>
    );
};

export default FileCard;
