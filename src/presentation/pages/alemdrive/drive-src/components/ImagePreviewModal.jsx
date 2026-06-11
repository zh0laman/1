import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader2, FileText } from 'lucide-react';
import { getDownloadUrl } from '../api/files';
import client from '../api/client'; // Import authenticated client
import heic2any from 'heic2any';

const ImagePreviewModal = ({ isOpen, onClose, file }) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen || !file) {
            setBlobUrl(null);
            setError(null);
            return;
        }

        const loadFile = async () => {
            setLoading(true);
            setError(null);
            try {
                // Determine file type
                const fileName = file.name || file.real_name || '';
                const isHeic = /\.(heic|heif)$/i.test(fileName);
                const isPdf = file.mime_type === 'application/pdf' || /\.pdf$/i.test(fileName);

                // Fetch file as blob using authenticated client
                const response = await client.get(`/drive/files/${file.id}/download`, {
                    responseType: 'blob'
                });

                let blob = response.data;
                // Force PDF type if it is a PDF, to ensure iframe renders it
                if (isPdf) {
                    blob = new Blob([blob], { type: 'application/pdf' });
                }

                if (isHeic) {
                    try {
                        const conversionResult = await heic2any({ blob, toType: "image/jpeg" });
                        blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
                    } catch (conversionErr) {
                        console.error("HEIC conversion failed", conversionErr);
                        // Make best effort or fail? We'll try to show it anyway or error
                        throw new Error("Не удалось конвертировать HEIC");
                    }
                }

                // Create object URL
                const url = URL.createObjectURL(blob);
                setBlobUrl(url);

            } catch (err) {
                console.error("Failed to load file", err);
                setError("Не удалось загрузить файл");
            } finally {
                setLoading(false);
            }
        };

        loadFile();

    }, [isOpen, file]);

    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [blobUrl]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !file) return null;

    const fileName = file.name || file.real_name || '';
    const isPdf = file.mime_type === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isVideo = (file.mime_type && file.mime_type.startsWith('video/')) || /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(fileName);

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md"
                onClick={onClose}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-[70]"
                >
                    <X className="h-8 w-8" />
                </button>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full h-full max-w-7xl max-h-[90vh] p-4 flex flex-col items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    {loading ? (
                        <div className="flex flex-col items-center text-white">
                            <Loader2 className="h-10 w-10 animate-spin mb-2" />
                            <p>Загрузка файла...</p>
                        </div>
                    ) : error ? (
                        <div className="text-white text-center">
                            <p className="text-red-400 mb-2">{error}</p>
                            <a href={getDownloadUrl(file.id)} download={file.name} className="text-indigo-400 hover:underline">
                                Попробовать скачать напрямую
                            </a>
                        </div>
                    ) : (
                        <>
                            {isPdf ? (
                                <iframe
                                    src={blobUrl}
                                    className="w-full h-full rounded-lg bg-white shadow-2xl"
                                    title={file.name}
                                />
                            ) : isVideo ? (
                                <video
                                    src={blobUrl}
                                    controls
                                    autoPlay
                                    className="max-h-[80vh] max-w-full rounded-lg shadow-2xl"
                                />
                            ) : (
                                <img
                                    src={blobUrl || ''}
                                    alt={file.name}
                                    className="max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain"
                                />
                            )}

                            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                                <span className="inline-block bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white pointer-events-auto">
                                    <p className="text-lg font-medium drop-shadow-md inline mr-3">{file.name || file.real_name}</p>
                                    <a href={getDownloadUrl(file.id)} download={file.name || file.real_name} target="_blank" rel="noreferrer" className="inline-flex items-center text-indigo-300 hover:text-indigo-200 text-sm">
                                        <ExternalLink className="w-4 h-4 mr-1" />
                                        Скачать
                                    </a>
                                </span>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ImagePreviewModal;
