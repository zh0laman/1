import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, file, onConfirm }) => {
    if (!isOpen || !file) return null;

    const isFolder = file.type === 'dir' || file.mime_type === 'application/x-directory';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100"
                >
                    <div className="p-6 text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-50 mb-4">
                            <Trash2 className="h-6 w-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {file.isBulk
                                ? `Удалить ${file.count} элементов?`
                                : `Удалить ${isFolder ? 'папку' : 'файл'}?`
                            }
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Вы собираетесь удалить <span className="font-medium text-gray-700">"{file.name}"</span>.
                            Это действие необратимо.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => { onConfirm(); onClose(); }}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DeleteConfirmModal;
