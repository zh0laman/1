import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import NotebookLlmContent from './NotebookLlmContent';

const NotebookLlmModal = ({ isOpen, onClose, files }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <NotebookLlmContent
                        files={files}
                        embedded={false}
                        onClose={onClose}
                        isOpen={isOpen}
                    />
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default NotebookLlmModal;
