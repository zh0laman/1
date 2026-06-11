import React, { useState, useRef, useEffect } from 'react';
import { Plus, FolderPlus, FileText, FileSpreadsheet, FileType, MonitorPlay, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CreateMenu = ({ onCreateFolder, onCreateFile, onUpload, collapsed = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (type) => {
        setIsOpen(false);
        // Dispatch custom event for loose coupling with Drive page
        document.dispatchEvent(new CustomEvent('alem-drive-create', { detail: type }));
        
        // Retain backwards compatibility for legacy props
        if (type === 'folder') {
            onCreateFolder?.();
        } else if (type === 'upload') {
            onUpload?.();
        } else {
            onCreateFile?.(type);
        }
    };

    return (
        <div className="relative w-full flex justify-center" ref={menuRef}>
            {collapsed ? (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#1E88E5] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:bg-[#F8FAFC] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.97]"
                    title="Создать"
                >
                    <Plus className="h-5 w-5 stroke-[2.5]" />
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex w-full items-center justify-center gap-3 px-5 py-3 h-12 rounded-2xl border border-[#E2E8F0] bg-white text-sm font-bold text-[#334155] shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all hover:bg-[#F8FAFC] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] active:scale-[0.98]"
                >
                    <Plus className="h-5 w-5 text-[#1E88E5] stroke-[2.5]" />
                    <span>Создать</span>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.12, ease: "easeOut" }}
                        className={`absolute mt-2 w-56 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0] py-2 z-50 overflow-hidden ${
                            collapsed ? 'left-12 top-0 mt-0' : 'left-0 top-12'
                        }`}
                    >
                        <button
                            onClick={() => handleSelect('folder')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <FolderPlus className="h-4.5 w-4.5 mr-3 text-[#94A3B8] group-hover:text-[#1E88E5]" />
                            Новую папку
                        </button>
                        
                        <button
                            onClick={() => handleSelect('upload')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <UploadCloud className="h-4.5 w-4.5 mr-3 text-[#94A3B8]" />
                            Загрузить файл
                        </button>

                        <div className="h-px bg-[#E2E8F0] my-1.5 mx-2" />

                        <button
                            onClick={() => handleSelect('docx')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <FileText className="h-4.5 w-4.5 mr-3 text-blue-500" />
                            Word документ
                        </button>
                        
                        <button
                            onClick={() => handleSelect('xlsx')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <FileSpreadsheet className="h-4.5 w-4.5 mr-3 text-green-500" />
                            Excel таблицу
                        </button>
                        
                        <button
                            onClick={() => handleSelect('pptx')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <MonitorPlay className="h-4.5 w-4.5 mr-3 text-orange-500" />
                            Презентацию
                        </button>
                        
                        <button
                            onClick={() => handleSelect('txt')}
                            className="w-full flex items-center px-4 py-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E88E5] transition-colors"
                        >
                            <FileType className="h-4.5 w-4.5 mr-3 text-slate-500" />
                            Текстовый файл
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CreateMenu;
