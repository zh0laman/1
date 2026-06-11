import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, FileText, AlertCircle, Loader2 } from 'lucide-react';
import client from '../api/client';
import { acceptPublicLink, getPublicItem } from '../api/files';
import { ONLYOFFICE_API_SCRIPT_URL, getOnlyOfficeDocumentType, getOnlyOfficePublicFileDownloadUrl } from '../config/runtime';

const PublicShare = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const editorInstance = useRef(null);

    // View state
    const [isImage, setIsImage] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const [isPdf, setIsPdf] = useState(false);
    const [isOnlyOffice, setIsOnlyOffice] = useState(false);

    useEffect(() => {
        const fetchItem = async () => {
            if (!id) return;
            try {
                const data = await getPublicItem(id);
                setFile(data);
            } catch (err) {
                console.error("Failed to load public item", err);
                setError("Файл не найден или срок действия ссылки истек");
            } finally {
                setLoading(false);
            }
        };
        fetchItem();
    }, [id]);

    useEffect(() => {
        if (!id) return;

        let cancelled = false;

        const acceptAndRedirect = async () => {
            try {
                const accepted = await acceptPublicLink(id);
                if (cancelled || !accepted) return;

                if (accepted.type === 'folder' && accepted.folder?.id) {
                    navigate(`/drive/shared/f/${accepted.folder.id}`, { replace: true });
                    return;
                }

                if (accepted.file?.id) {
                    navigate(`/drive/editor/${accepted.file.id}`, {
                        replace: true,
                        state: {
                            file: accepted.file,
                            mode: accepted.access_role === 'editor' || accepted.access_role === 'owner' ? 'edit' : 'view',
                            role: accepted.access_role,
                            fromPublicShare: true,
                            backTo: '/drive/shared',
                        },
                    });
                }
            } catch (err) {
                console.error('Failed to accept public link', err);
            }
        };

        acceptAndRedirect();

        return () => {
            cancelled = true;
        };
    }, [id, navigate]);

    useEffect(() => {
        if (!file || loading || error) return;

        const actualFile = file.file || file;
        const fileName = actualFile.real_name || actualFile.name || actualFile.original_name || actualFile.object_name || 'document.docx';
        const mime = actualFile.mime_type || '';

        // Determine type
        const img = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(fileName);
        const vid = mime.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(fileName);
        const pdf = mime === 'application/pdf' || /\.pdf$/i.test(fileName);

        setIsImage(!!img);
        setIsVideo(!!vid);
        setIsPdf(!!pdf);

        if (img || vid || pdf) {
            setIsOnlyOffice(false);
            return;
        }

        // If not specific media, try OnlyOffice
        setIsOnlyOffice(true);

        const scriptUrl = ONLYOFFICE_API_SCRIPT_URL;
        const scriptId = 'onlyoffice-api-script';

        const initializeEditor = () => {
            if (!window.DocsAPI) return;
            if (!containerRef.current) return;

            // Clear container
            containerRef.current.innerHTML = "";
            const placeholder = document.createElement("div");
            placeholder.id = "onlyoffice-public-container-" + Date.now();
            containerRef.current.appendChild(placeholder);

            const downloadUrl = getOnlyOfficePublicFileDownloadUrl(id);

            let fileType = 'docx';
            const parts = fileName.split('.');
            if (parts.length > 1) {
                fileType = parts.pop().toLowerCase();
            }

            // Document Type Logic
            const config = {
                documentType: getOnlyOfficeDocumentType(fileName, mime),
                document: {
                    fileType: fileType,
                    key: actualFile.key || `${id}-v${actualFile.version || 1}`,
                    title: fileName,
                    url: downloadUrl,
                    permissions: {
                        edit: false,
                        download: true,
                        review: false,
                        comment: false,
                    },
                },
                editorConfig: {
                    lang: "ru",
                    mode: "view",
                    user: {
                        id: "guest",
                        name: "Guest User"
                    },
                    customization: {
                        autosave: false,
                        forcesave: false,
                        features: {
                            spellcheck: false,
                        },
                        uiTheme: "light",
                    }
                },
                height: "100%",
                width: "100%",
            };

            editorInstance.current = new window.DocsAPI.DocEditor(placeholder.id, config);
        };

        if (document.getElementById(scriptId)) {
            if (window.DocsAPI) {
                initializeEditor();
            } else {
                setTimeout(initializeEditor, 500);
            }
        } else {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = scriptUrl;
            script.async = true;
            script.onload = initializeEditor;
            document.body.appendChild(script);
        }

        return () => {
            if (editorInstance.current) {
                editorInstance.current.destroyEditor();
                editorInstance.current = null;
            }
        };

    }, [file, loading, error, id]);

    const handleManualDownload = () => {
        const baseURL = client.defaults.baseURL || '';
        window.location.href = `${baseURL}/public/drive/files/${id}/download`;
    };

    const getDownloadUrl = () => {
        const baseURL = client.defaults.baseURL || '';
        return `${baseURL}/public/drive/files/${id}/download`;
    };

    if (loading) {
        return (
            <div className="h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500">Загрузка документа...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Ошибка доступа</h1>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    const actualFile = file?.file || file;
    const displayName = actualFile?.real_name || actualFile?.name || 'File';

    return (
        <div className="h-screen w-full bg-gray-100 flex flex-col">
            {/* Header */}
            <div className="h-14 bg-white border-b flex items-center px-4 justify-between shadow-sm z-10">
                <div className="flex items-center">
                    <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mr-3">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-gray-800 text-sm md:text-base">{displayName}</h1>
                        <p className="text-xs text-gray-500">Только чтение</p>
                    </div>
                </div>
                <button
                    onClick={handleManualDownload}
                    className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Скачать
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 relative bg-gray-100 overflow-hidden flex items-center justify-center">
                {isOnlyOffice && (
                    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
                )}

                {isImage && (
                    <div className="w-full h-full p-4 flex items-center justify-center bg-gray-900/90">
                        <img
                            src={getDownloadUrl()}
                            alt={displayName}
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />
                    </div>
                )}

                {isVideo && (
                    <div className="w-full h-full p-4 flex items-center justify-center bg-black">
                        <video
                            src={getDownloadUrl()}
                            controls
                            className="max-w-full max-h-full rounded-lg shadow-2xl"
                        />
                    </div>
                )}

                {isPdf && (
                    <iframe
                        src={getDownloadUrl()}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                    />
                )}

                {!isOnlyOffice && !isImage && !isVideo && !isPdf && (
                    <div className="text-center text-gray-500">
                        <p className="mb-4">Предпросмотр недоступен для этого типа файла</p>
                        <button onClick={handleManualDownload} className="text-blue-600 underline">Скачать файл</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicShare;
