import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getDownloadUrl } from '../api/files';
import { ONLYOFFICE_API_SCRIPT_URL, getOnlyOfficeCallbackUrl, getOnlyOfficeDocumentType, getOnlyOfficeFileDownloadUrl } from '../config/runtime';
import { Loader2, ArrowLeft } from 'lucide-react';

const Editor = () => {
    const { fileId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isEmbedded = new URLSearchParams(location.search).get('embedded') === 'true';
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const containerRef = useRef(null);
    const [file, setFile] = useState(location.state?.file);

    // Use a Ref to track if the editor has been destroyed to prevent double initialization
    const editorInstance = useRef(null);

    // Fetch user info first
    useEffect(() => {
        const fetchUserAndFile = async () => {
            // Auth is cookie-based here; do not read JWTs from localStorage.
            setCurrentUser({ id: 'user', username: 'User', full_name: 'User' });

            // 2. Fetch File if missing
            if (!file) {
                try {
                    // We need to import getFile dynamically or assumption it's imported
                    // Since I can't add imports easily with replace_file_content in one go if they are top level...
                    // I'll rely on adding the import in a separate step or assume I'll add it. 
                    // Wait, I should add the import.
                    // For now, let's write the logic and I'll add the import in next step or use require if possible? No, ES modules.
                    // I will add the import in a separate step.
                    // Let's assume getFile is available.
                    const { getFile } = await import('../api/files');
                    // Pass token explicitly if it's from URL, otherwise client interceptor handles it (or we pass it anyway)
                    const fileData = await getFile(fileId);
                    setFile(fileData);
                } catch (err) {
                    console.error("Failed to fetch file", err);
                    // Start editor anyway? It might fail without name/type.
                }
            }
        };
        fetchUserAndFile();
    }, [fileId, location.search]); // Depend on location.search for token

    const [isPdf, setIsPdf] = useState(false);
    const [isImage, setIsImage] = useState(false);
    const [contentUrl, setContentUrl] = useState(null);

    const handleBack = () => {
        if (location.state?.fromPublicShare) {
            navigate(location.state?.backTo || '/drive/shared', { replace: true });
            return;
        }
        navigate(-1);
    };

    useEffect(() => {
        if (file) {
            const name = file.name || file.real_name || '';
            const mime = file.mime_type || '';

            const pdf = name.toLowerCase().endsWith('.pdf') || mime === 'application/pdf';
            const img = name.match(/\.(jpg|jpeg|png|gif|webp)$/i) || mime.startsWith('image/');

            setIsPdf(pdf);
            setIsImage(!!img);
        }
    }, [file]);

    useEffect(() => {
        if (!currentUser) return; // Wait for user
        if (!file) return; // Wait for file metadata before creating a stable OnlyOffice config


        // Handle PDF or Image natively
        if (isPdf || isImage) {
            setLoading(true);
            const fallbackDownloadUrl =
                file?.download_url ||
                file?.downloadUrl ||
                file?.download_url?.url ||
                file?.downloadUrl?.url;
            const url = fallbackDownloadUrl || getDownloadUrl(fileId);
            fetch(url, { credentials: 'include' })
                .then(res => {
                    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                    return res.blob();
                })
                .then(blob => {
                    // Create proper blob type
                    const type = isPdf ? 'application/pdf' : blob.type;
                    const finalBlob = new Blob([blob], { type });
                    const objectUrl = URL.createObjectURL(finalBlob);
                    setContentUrl(objectUrl);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load content", err);
                    setLoading(false);
                });
            return;
        }

        const scriptUrl = ONLYOFFICE_API_SCRIPT_URL;
        const scriptId = 'onlyoffice-api-script';

        const initializeEditor = () => {
            if (!window.DocsAPI) {
                console.error("DocsAPI not found");
                return;
            }

            const downloadUrl = getOnlyOfficeFileDownloadUrl(fileId);

            let fileType = file?.name.split('.').pop();
            const commonExts = ['docx', 'xlsx', 'pptx', 'txt', 'csv', 'pdf'];
            if (!fileType || fileType === file?.name || !commonExts.includes(fileType)) {
                fileType = 'docx';
            }


            // OnlyOffice expects a stable key for the same file version.
            const docKey = file?.key || `${fileId}-v${file?.version || 1}`;

            const isGuest = currentUser.id === 'guest';
            // TODO: If we have permission info in file object, check file.permission === 'viewer'

            // DOM Isolation: Create a child div manually that React doesn't know about
            // This prevents "Failed to execute 'removeChild'" errors when OnlyOffice modifies the DOM
            if (containerRef.current) {
                // Clear any existing manually created children
                containerRef.current.innerHTML = "";

                // Create the specific container for OnlyOffice
                const placeholder = document.createElement("div");
                placeholder.id = "onlyoffice-container-" + Date.now();
                containerRef.current.appendChild(placeholder);

                // Initialize editor on this new placeholder
                const isGuest = currentUser.id === 'guest';

                // Check if user has explicit 'viewer' role from the file metadata
                // We check multiple common fields as the backend structure isn't fully known
                const userRole = file?.role || file?.permission || file?.current_user_role || file?.access_level;

                // Determine if current user is the owner
                const isOwner = currentUser?.id && (
                    String(file?.user_id) === String(currentUser.id) ||
                    String(file?.owner_id) === String(currentUser.id)
                );

                // Determine edit rights
                // 1. Owners always edit
                // 2. Explicit 'editor' role edits
                // 3. 'viewer' role cannot edit
                // 4. Fallback: if no role info, assume edit (legacy behavior) or view? 
                //    For now, let's keep "exclude guest and viewer" logic but strengthen it.

                const isViewer = userRole === 'viewer' || userRole === 'read';
                const isEditor = userRole === 'editor' || userRole === 'write' || userRole === 'owner';

                let canEdit = !isGuest;

                // Prioritize explicit mode passed from Drive.jsx
                if (location.state?.mode) {
                    canEdit = location.state.mode === 'edit';
                } else {
                    // Fallback to local logic
                    if (isViewer) canEdit = false;
                    if (isOwner || isEditor) canEdit = true;
                }


                const config = {
                    documentType: getOnlyOfficeDocumentType(file?.name, file?.mime_type),
                    document: {
                        fileType: fileType,
                        key: docKey,
                        title: file?.name || 'Document',
                        url: downloadUrl,
                        permissions: {
                            edit: canEdit,
                            download: true,
                            review: canEdit,
                            comment: canEdit, // Allow comments if editing
                        },
                    },
                    editorConfig: {
                        // Only provide callbackUrl if editing is allowed (to save changes)
                        // This prevents "No rights" errors when OnlyOffice calls the callback without auth
                        callbackUrl: canEdit ? getOnlyOfficeCallbackUrl(fileId) : undefined,
                        lang: "ru",
                        mode: canEdit ? "edit" : "view",
                        user: {
                            id: isGuest ? `guest-${Date.now()}` : (currentUser.id ? String(currentUser.id) : "user-1"),
                            name: currentUser.full_name || currentUser.username || "User"
                        },
                        customization: {
                            autosave: canEdit,
                            forcesave: canEdit,
                            features: {
                                spellcheck: canEdit,
                            }
                        }
                    },
                    height: "100%",
                    width: "100%",
                };

                editorInstance.current = new window.DocsAPI.DocEditor(placeholder.id, config);
            }
            setLoading(false);
        };

        if (document.getElementById(scriptId)) {
            // Script already loaded
            if (window.DocsAPI) {
                initializeEditor();
            } else {
                // Wait for it? usually ready if in DOM
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
            // Revoke blob URL if exists
            if (contentUrl) {
                URL.revokeObjectURL(contentUrl);
            }
        };
    }, [fileId, file, currentUser, isPdf, isImage]);

    return (
        <div className={`flex flex-col ${isEmbedded ? 'h-screen bg-white' : 'h-full bg-gray-100'}`}>
            {!isEmbedded && (
                <div className="h-12 bg-white border-b flex items-center px-4">
                    <button onClick={handleBack} className="flex items-center text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Назад
                    </button>
                    <span className="ml-4 font-semibold text-gray-700">{file?.name}</span>
                </div>
            )}

            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                )}
                {isPdf && contentUrl ? (
                    <iframe
                        src={contentUrl}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                    />
                ) : isImage && contentUrl ? (
                    <div className="flex items-center justify-center h-full bg-gray-900/5 p-4">
                        <img
                            src={contentUrl}
                            alt={file?.name}
                            className="max-w-full max-h-full object-contain shadow-lg rounded"
                        />
                    </div>
                ) : (
                    <div id="onlyoffice-editor" ref={containerRef} className="h-full w-full"></div>
                )}

            </div>
        </div>
    );
};

export default Editor;
