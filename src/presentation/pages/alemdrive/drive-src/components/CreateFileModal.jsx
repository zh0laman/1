import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, FileSpreadsheet, FileType, MonitorPlay } from 'lucide-react';
import { useToast } from './Toast';

const CreateFileModal = ({ isOpen, onClose, type, onCreate }) => {
    const [fileName, setFileName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setFileName(`Новый документ`);
            setTimeout(() => {
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, type]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fileName.trim()) return;
        onCreate(fileName);
        onClose();
    };

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'docx': return <FileText className="h-6 w-6 text-blue-600" />;
            case 'xlsx': return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
            case 'pptx': return <MonitorPlay className="h-6 w-6 text-orange-600" />;
            default: return <FileType className="h-6 w-6 text-gray-600" />;
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'docx': return 'Создать Word документ';
            case 'xlsx': return 'Создать Excel таблицу';
            case 'pptx': return 'Создать презентацию';
            default: return 'Создать текстовый файл';
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100"
                >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                                {getIcon()}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{getTitle()}</h3>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm transition-colors hover:bg-gray-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Имя файла</label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 bg-white placeholder-gray-400"
                                placeholder="Введите имя файла..."
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            >
                                Создать
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CreateFileModal;
