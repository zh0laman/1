import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Folder, MoreVertical, Image, Share2, Trash2, Download, MonitorPlay, MessageCircle, ExternalLink, Edit3, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const FileIcon = ({ type, name }) => {
    if (type === 'folder' || type === 'dir') return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-[#EBF4FE] text-[#1E88E5] border border-[#BBDEFB] shrink-0">
            <Folder className="h-4.5 w-4.5 fill-current text-[#1E88E5]" />
        </div>
    );
    if (type?.startsWith('image')) return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
            <Image className="h-4.5 w-4.5 text-purple-600" />
        </div>
    );
    if (name?.endsWith('.pptx') || type?.includes('presentation')) return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
            <MonitorPlay className="h-4.5 w-4.5 text-orange-600" />
        </div>
    );
    if (name?.endsWith('.xlsx') || type?.includes('spreadsheet')) return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-green-50 text-green-600 border border-green-100 shrink-0">
            <FileText className="h-4.5 w-4.5 text-green-600" />
        </div>
    );
    if (name?.endsWith('.pdf')) return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0">
            <FileText className="h-4.5 w-4.5 text-red-600" />
        </div>
    );
    if (type?.startsWith('video') || name?.match(/\.(mp4|mov|avi|mkv|webm)$/i)) return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-pink-50 text-pink-600 border border-pink-100 shrink-0">
            <MonitorPlay className="h-4.5 w-4.5 text-pink-600" />
        </div>
    );
    return (
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
        </div>
    );
};

const FileTableRow = ({ file, onEdit, onShare, onDelete, onRename, onSendToMessenger, selected, onSelect, showOwnerFio }) => {
    const isFolder = file.type === 'dir' || file.mime_type === 'application/x-directory';
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
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
        if (action === 'open') onEdit(file);
        else if (action === 'share') onShare?.(file);
        else if (action === 'messenger') onSendToMessenger?.(file);
        else if (action === 'rename') onRename?.(file);
        else if (action === 'delete') onDelete?.(file);
    };

    const [menuPosition, setMenuPosition] = useState('bottom');
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });

    const toggleMenu = (e) => {
        e.stopPropagation();
        if (!showMenu) {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;

            let topPosition;
            let leftPosition = rect.right + window.scrollX - 192;

            if (spaceBelow < 220) {
                setMenuPosition('top');
                topPosition = rect.top + window.scrollY - 8;
            } else {
                setMenuPosition('bottom');
                topPosition = rect.bottom + window.scrollY + 4;
            }

            setMenuCoords({ top: topPosition, left: leftPosition });
        }
        setShowMenu(!showMenu);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (showMenu) setShowMenu(false);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [showMenu]);

    let formattedCreatedDate = '-';
    let formattedModifiedDate = '-';

    try {
        if (file.created_at) {
            formattedCreatedDate = formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ru });
        }
        if (file.last_modified || file.updated_at) {
            formattedModifiedDate = formatDistanceToNow(new Date(file.last_modified || file.updated_at), { addSuffix: true, locale: ru });
        } else if (file.created_at) {
            formattedModifiedDate = formattedCreatedDate;
        }
    } catch (e) { }

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const menuContent = (
        <AnimatePresence>
            {showMenu && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, scale: 0.95, y: menuPosition === 'top' ? 10 : -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: menuPosition === 'top' ? 10 : -10 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    style={{
                        position: 'absolute',
                        top: menuCoords.top,
                        left: menuCoords.left,
                        transformOrigin: menuPosition === 'top' ? 'bottom right' : 'top right'
                    }}
                    className={`fixed w-48 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0] py-1.5 z-[9999] text-left ${menuPosition === 'top' ? '-translate-y-full' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={(e) => handleAction('open', e)} className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors">
                        <ExternalLink className="h-4 w-4 mr-2 text-[#94A3B8]" />
                        Открыть
                    </button>
                    {onRename && (
                        <button onClick={(e) => handleAction('rename', e)} className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors">
                            <Edit3 className="h-4 w-4 mr-2 text-[#94A3B8]" />
                            Переименовать
                        </button>
                    )}
                    {onSendToMessenger && (
                        <button onClick={(e) => handleAction('messenger', e)} className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors">
                            <MessageCircle className="h-4 w-4 mr-2 text-blue-500" />
                            Отправить в чат
                        </button>
                    )}
                    {!isFolder && onShare && (
                        <button onClick={(e) => handleAction('share', e)} className="w-full text-left px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] flex items-center transition-colors">
                            <Share2 className="h-4 w-4 mr-2 text-purple-500" />
                            Поделиться
                        </button>
                    )}
                    {onDelete && (
                        <>
                            <div className="h-px bg-[#E2E8F0] my-1.5 mx-2" />
                            <button onClick={(e) => handleAction('delete', e)} className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center transition-colors">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Удалить
                            </button>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            {showMenu && createPortal(menuContent, document.body)}
            <motion.tr
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`group border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer ${selected ? 'bg-[#EBF4FE]/40' : ''}`}
                onClick={() => onEdit(file)}
            >
                <td className="w-12 px-4 py-3 text-center">
                    <div onClick={(e) => { e.stopPropagation(); onSelect(file.id); }} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors mx-auto ${selected ? 'bg-[#1E88E5] border-[#1E88E5]' : 'border-[#CBD5E1] hover:border-[#1E88E5] bg-white'}`}>
                        {selected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                    </div>
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="flex-shrink-0">
                            <FileIcon type={isFolder ? 'folder' : file.mime_type} name={file.name} />
                        </div>
                        <span className="text-xs font-bold text-gray-800 group-hover:text-[#1E88E5] transition-colors truncate max-w-[280px] sm:max-w-[400px]">{file.name}</span>
                    </div>
                </td>
                {showOwnerFio && (
                    <td className="px-4 py-3 text-xs font-semibold text-[#64748B] whitespace-nowrap hidden sm:table-cell">
                        {file.owner_fio || '-'}
                    </td>
                )}
                <td className="px-4 py-3 text-xs font-semibold text-[#64748B] whitespace-nowrap hidden sm:table-cell">
                    {isFolder ? '-' : formatSize(file.size)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-[#64748B] whitespace-nowrap hidden lg:table-cell">
                    {formattedCreatedDate}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-[#64748B] whitespace-nowrap hidden md:table-cell">
                    {formattedModifiedDate}
                </td>
                <td className={`px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-[#F8FAFC] transition-colors shadow-[shadow:-10px_0_10px_-10px_rgba(0,0,0,0.02)] ${showMenu ? 'z-50' : 'z-0'}`}>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={toggleMenu}
                            className={`p-1.5 rounded-xl transition-all active:scale-95 ${showMenu ? 'bg-[#E2E8F0] text-gray-700' : 'text-[#94A3B8] hover:text-[#475569] hover:bg-slate-100'}`}
                        >
                            <MoreVertical className="h-4.5 w-4.5 stroke-[2.5]" />
                        </button>
                    </div>
                </td>
            </motion.tr>
        </>
    );
};

export default FileTableRow;
