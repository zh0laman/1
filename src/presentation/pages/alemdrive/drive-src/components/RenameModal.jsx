import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X } from 'lucide-react';

const RenameModal = ({ isOpen, onClose, file, onConfirm }) => {
    const [baseName, setBaseName] = useState('');
    const [extension, setExtension] = useState('');

    useEffect(() => {
        if (isOpen && file) {
            const fullName = file.name || '';
            const dotIndex = fullName.lastIndexOf('.');
            if (dotIndex > 0) {
                setBaseName(fullName.slice(0, dotIndex));
                setExtension(fullName.slice(dotIndex)); // includes the dot, e.g. ".docx"
            } else {
                setBaseName(fullName);
                setExtension('');
            }
        }
    }, [isOpen, file]);

    if (!isOpen || !file) return null;

    const isFolder = file.type === 'dir' || file.mime_type === 'application/x-directory';

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = baseName.trim();
        if (!trimmed) return;
        const fullName = extension ? trimmed + extension : trimmed;
        onConfirm(fullName);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100"
                >
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-50">
                                    <Edit3 className="h-5 w-5 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Переименовать {isFolder ? 'папку' : 'файл'}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden mb-4 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                                <input
                                    type="text"
                                    value={baseName}
                                    onChange={(e) => setBaseName(e.target.value)}
                                    placeholder={isFolder ? 'Название папки' : 'Название файла'}
                                    className="flex-1 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none min-w-0"
                                    autoFocus
                                />
                                {!isFolder && extension && (
                                    <span className="px-4 py-3 bg-gray-50 text-gray-500 border-l border-gray-200 select-none">
                                        {extension}
                                    </span>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={!baseName.trim()}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RenameModal;
