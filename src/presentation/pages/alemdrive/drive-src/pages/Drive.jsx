import React, { useEffect, useState, useRef } from 'react';
import { listFiles, uploadFile, createFolder, listSharedItems, listOwnItems, listRecentFiles, deleteFile, deleteFolder, updateFolder, updateFile, getFileTypes, getMyPermission, getSharedUsers } from '../api/files';
import { getMe } from '../api/auth';
import FileTableRow from '../components/FileTableRow';
import FileCard from '../components/FileCard';
import { Loader2, UploadCloud, FolderPlus, ArrowLeft, Search, X, Check, Folder, ChevronRight, Grid, List, Sparkles, MoreVertical } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ShareModal from '../components/ShareModal';
import { useToast } from '../components/Toast';
import ImagePreviewModal from '../components/ImagePreviewModal';
import CreateFileModal from '../components/CreateFileModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import RenameModal from '../components/RenameModal';
import SendToMessengerModal from '../components/SendToMessengerModal';
import { generateTxt, generateDocx, generateXlsx, generatePptx } from '../utils/fileGenerators';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const ALLOWED_UPLOAD_EXTENSIONS = ['docx', 'xlsx', 'pdf', 'pptx', 'txt'];
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
]);

const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

const Drive = ({ mode = 'my-drive' }) => {
    const { folderId: urlFolderId } = useParams();
    const currentFolderId = urlFolderId || 'root';
    
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [fileToShare, setFileToShare] = useState(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [fileToPreview, setFileToPreview] = useState(null);
    const [createFileModalOpen, setCreateFileModalOpen] = useState(false);
    const [fileTypeToCreate, setFileTypeToCreate] = useState('txt');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [fileToRename, setFileToRename] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // View state
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('alem_drive_view_mode') || 'list';
        } catch {
            return 'list';
        }
    });
    const [showAiBanner, setShowAiBanner] = useState(() => {
        try {
            return localStorage.getItem('alem_drive_ai_banner_visible') !== 'false';
        } catch {
            return true;
        }
    });

    // Messenger state
    const [messengerModalOpen, setMessengerModalOpen] = useState(false);
    const [fileToSendMessage, setFileToSendMessage] = useState(null);
    const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

    // Bulk selection state
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const navigate = useNavigate();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);

    // Filter states
    const [fileTypes, setFileTypes] = useState([]);
    const [activeFileType, setActiveFileType] = useState(null);
    const [showTypeFilter, setShowTypeFilter] = useState(false);
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const typeFilterRef = useRef(null);
    const [user, setUser] = useState(null);

    const [sharedUsers, setSharedUsers] = useState([]);
    const [activeSharedUser, setActiveSharedUser] = useState(null);
    const [showUserFilter, setShowUserFilter] = useState(false);
    const userFilterRef = useRef(null);

    useEffect(() => {
        getMe().then(setUser).catch(err => console.error(err));
        getFileTypes().then(setFileTypes).catch(err => console.error(err));

        const handleClickOutside = (event) => {
            if (typeFilterRef.current && !typeFilterRef.current.contains(event.target)) {
                setShowTypeFilter(false);
            }
            if (userFilterRef.current && !userFilterRef.current.contains(event.target)) {
                setShowUserFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (mode === 'shared') {
            getSharedUsers().then(data => setSharedUsers(data || [])).catch(console.error);
        } else {
            setSharedUsers([]);
            setActiveSharedUser(null);
        }
    }, [mode]);

    // Reset folder items selection when mode or folder changes
    useEffect(() => {
        setSelectedItems(new Set());
    }, [mode, currentFolderId]);

    useEffect(() => {
        loadFiles(currentFolderId);
        setSelectedItems(new Set());
    }, [currentFolderId, activeFileType, sortBy, sortOrder, mode]);

    // Listen to sidebar create actions
    useEffect(() => {
        const handleSidebarCreate = (e) => {
            const actionType = e.detail;
            if (actionType === 'folder') {
                setIsCreatingFolder(true);
            } else if (actionType === 'upload') {
                handleUploadClick();
            } else {
                handleCreateFileClick(actionType);
            }
        };
        document.addEventListener('alem-drive-create', handleSidebarCreate);
        return () => document.removeEventListener('alem-drive-create', handleSidebarCreate);
    }, [currentFolderId]);

    const reqIdRef = useRef(0);

    const loadFiles = async (folderId) => {
        const reqId = ++reqIdRef.current;
        try {
            setLoading(true);

            const params = {
                sort_by: sortBy,
                sort_order: sortOrder,
                type: activeFileType ? activeFileType.type : undefined
            };

            let data;
            if (folderId === 'root') {
                if (mode === 'shared') {
                    data = await listSharedItems(params);
                } else if (mode === 'recent') {
                    data = await listRecentFiles(10, 0, params);
                } else {
                    data = await listOwnItems(params);
                }
            } else {
                data = await listFiles(folderId, params);
            }

            if (reqId === reqIdRef.current) {
                const rawData = data ? (Array.isArray(data) ? data : data.files || []) : [];
                
                const flattenedData = rawData.map(item => {
                    if (item.id && (item.name || item.real_name)) return item;

                    const base = item.folder || item.file || item;
                    if (!base || typeof base !== 'object') return item;

                    return {
                        ...base,
                        type: item.type === 'folder' || item.type === 'dir' || base.mime_type === 'application/x-directory' ? 'dir' : 'file',
                        name: base.name || base.real_name || '',
                        last_accessed_at: item.last_accessed_at || base.last_accessed_at,
                        id: base.id || item.id
                    };
                });
                
                setFiles(flattenedData);
            }
        } catch (err) {
            if (reqId === reqIdRef.current) {
                console.error("Failed to load files", err);
                setError("Не удалось загрузить файлы");
            }
        } finally {
            if (reqId === reqIdRef.current) {
                setLoading(false);
            }
        }
    };

    const handleFileClick = async (file) => {
        const isImage = (file.mime_type && file.mime_type.startsWith('image/')) ||
            /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(file.name);
        const isPdf = (file.mime_type === 'application/pdf') || /\.pdf$/i.test(file.name);
        const isVideo = (file.mime_type && file.mime_type.startsWith('video/')) ||
            /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(file.name);

        if (file.type === 'dir' || file.mime_type === 'application/x-directory') {
            const prefix = mode === 'shared' ? '/drive/shared/f' : mode === 'recent' ? '/drive/recent/f' : '/drive/f';
            navigate(`${prefix}/${file.id}`);
        } else if (isImage || isPdf || isVideo) {
            setFileToPreview(file);
            setPreviewModalOpen(true);
        } else {
            try {
                const permission = await getMyPermission(file.id, 'file');
                const editMode = permission?.role === 'editor' || permission?.role === 'owner' ? 'edit' : 'view';
                navigate(`/drive/editor/${file.id}`, { state: { file, mode: editMode, role: permission?.role } });
            } catch (error) {
                console.error("Failed to check permissions", error);
                navigate(`/drive/editor/${file.id}`, { state: { file, mode: 'view' } });
            }
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleToggleSelection = (id) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.size === files.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(files.map(f => f.id)));
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedItems.size === 0) return;
        setFileToDelete({
            id: 'bulk',
            name: `${selectedItems.size} элементов`,
            isBulk: true,
            count: selectedItems.size
        });
        setDeleteModalOpen(true);
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim() || isSubmittingFolder) return;
        try {
            setIsSubmittingFolder(true);
            await createFolder(newFolderName, currentFolderId);
            setNewFolderName('');
            setIsCreatingFolder(false);
            loadFiles(currentFolderId);
        } catch (err) {
            console.error("Failed to create folder", err);
            addToast("Не удалось создать папку", 'error');
        } finally {
            setIsSubmittingFolder(false);
        }
    };

    const handleShareClick = (file) => {
        setFileToShare(file);
        setShareModalOpen(true);
    };

    const handleSendToMessengerClick = (file) => {
        setFileToSendMessage(file);
        setMessengerModalOpen(true);
    };

    const handleCreateFileClick = (type) => {
        setFileTypeToCreate(type);
        setCreateFileModalOpen(true);
    };

    const handleCreateFileConfirm = async (name) => {
        try {
            const type = fileTypeToCreate;
            let blob;
            let extension;
            let mimeType;

            switch (type) {
                case 'txt':
                    blob = generateTxt();
                    extension = 'txt';
                    mimeType = 'text/plain';
                    break;
                case 'docx':
                    blob = await generateDocx();
                    extension = 'docx';
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    break;
                case 'xlsx':
                    blob = await generateXlsx();
                    extension = 'xlsx';
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    break;
                case 'pptx':
                    blob = await generatePptx();
                    extension = 'pptx';
                    mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    break;
                default:
                    return;
            }

            const fileName = name.endsWith(`.${extension}`) ? name : `${name}.${extension}`;
            const file = new File([blob], fileName, { type: mimeType });

            const newFile = await uploadFile(file, currentFolderId);
            addToast(`Файл "${fileName}" успешно создан`, 'success');

            setFiles(prev => [newFile, ...prev]);
            loadFiles(currentFolderId);
        } catch (err) {
            console.error("File creation failed", err);
            addToast("Не удалось создать файл", 'error');
        } finally {
            setCreateFileModalOpen(false);
        }
    };

    const handleDeleteClick = (file) => {
        setFileToDelete(file);
        setDeleteModalOpen(true);
    };

    const handleRenameClick = (file) => {
        setFileToRename(file);
        setRenameModalOpen(true);
    };

    const confirmRename = async (newName) => {
        if (!fileToRename || !newName.trim()) return;
        try {
            const isFolder = fileToRename.type === 'dir' || fileToRename.mime_type === 'application/x-directory';
            if (isFolder) {
                await updateFolder(fileToRename.id, newName.trim());
            } else {
                await updateFile(fileToRename.id, newName.trim());
            }
            addToast(`${isFolder ? 'Папка' : 'Файл'} переименован`, 'success');
            setFiles(prev => prev.map(f =>
                f.id === fileToRename.id ? { ...f, name: newName.trim() } : f
            ));
        } catch (err) {
            console.error("Rename failed", err);
            addToast("Не удалось переименовать: " + (err.response?.data?.message || err.message), 'error');
        } finally {
            setFileToRename(null);
        }
    };

    const confirmDeleteFile = async () => {
        if (!fileToDelete) return;

        if (fileToDelete.isBulk) {
            try {
                setIsBulkDeleting(true);
                addToast(`Удаление ${selectedItems.size} элементов...`, 'info');

                const deletePromises = Array.from(selectedItems).map(id => {
                    const file = files.find(f => f.id === id);
                    const isFolder = file && (file.type === 'dir' || file.mime_type === 'application/x-directory');
                    return isFolder ? deleteFolder(id) : deleteFile(id);
                });
                await Promise.allSettled(deletePromises);

                addToast(`Выбранные элементы удалены`, 'success');
                setFiles(prev => prev.filter(f => !selectedItems.has(f.id)));
                setSelectedItems(new Set());
            } catch (err) {
                console.error("Bulk delete failed", err);
                addToast("Ошибка при массовом удалении", 'error');
            } finally {
                setIsBulkDeleting(false);
                loadFiles(currentFolderId);
            }
        } else {
            try {
                const isFolder = fileToDelete.type === 'dir' || fileToDelete.mime_type === 'application/x-directory';
                if (isFolder) {
                    await deleteFolder(fileToDelete.id);
                } else {
                    await deleteFile(fileToDelete.id);
                }
                addToast(`${isFolder ? 'Папка' : 'Файл'} "${fileToDelete.name}" удален`, 'success');
                setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
            } catch (err) {
                console.error("Delete failed", err, err.response?.data);
                addToast("Не удалось удалить элемент: " + (err.response?.data?.message || err.message), 'error');
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.includes(extension);
        const isAllowedMime = ALLOWED_UPLOAD_MIME_TYPES.has(file.type);
        if (!isAllowedExtension && !isAllowedMime) {
            addToast('Разрешены только файлы: docx, xlsx, pdf, pptx, txt', 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            await uploadFile(file, currentFolderId);
            addToast(`Файл "${file.name}" успешно загружен`, 'success');
            loadFiles(currentFolderId);
        } catch (err) {
            console.error("Upload failed", err);
            addToast("Не удалось загрузить файл", 'error');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const toggleViewMode = (modeVal) => {
        setViewMode(modeVal);
        try {
            localStorage.setItem('alem_drive_view_mode', modeVal);
        } catch {}
    };

    const toggleAiBanner = (visible) => {
        setShowAiBanner(visible);
        try {
            localStorage.setItem('alem_drive_ai_banner_visible', String(visible));
        } catch {}
    };

    const filteredFiles = files.filter(file => {
        const isFolder = file.type === 'dir' || file.mime_type === 'application/x-directory';

        if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        if (mode === 'shared' && activeSharedUser && file.owner_id !== activeSharedUser.id) {
            return false;
        }

        if (activeFileType) {
            if (activeFileType.type === 'folder' && !isFolder) return false;
            if (activeFileType.type !== 'folder' && isFolder) return false;
            
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (activeFileType.type === 'docx' && ext !== 'docx' && ext !== 'doc') return false;
            if (activeFileType.type === 'xlsx' && ext !== 'xlsx' && ext !== 'xls') return false;
            if (activeFileType.type === 'pptx' && ext !== 'pptx') return false;
            if (activeFileType.type === 'pdf' && ext !== 'pdf') return false;
            if (activeFileType.type === 'txt' && ext !== 'txt') return false;
        }

        return true;
    });

    // Split folders and files
    const foldersList = filteredFiles.filter(file => file.type === 'dir' || file.mime_type === 'application/x-directory');
    const filesList = filteredFiles.filter(file => file.type !== 'dir' && file.mime_type !== 'application/x-directory');

    if (loading && files.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 text-[#1E88E5] animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col h-full bg-transparent text-gray-900 select-none pb-20"
        >
            {/* Search and filters toolbar */}
            <div className="mb-6 flex w-full flex-col items-stretch gap-3 px-2 sm:px-0 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-[780px] md:flex-1">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#94A3B8] group-focus-within:text-[#1E88E5] transition-colors stroke-[2.5]" />
                        <input
                            type="text"
                            placeholder="Поиск файлов и папок"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-13 pr-12 py-3.5 bg-white border border-[#E2E8F0] rounded-3xl outline-none focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/5 shadow-[0_2px_8px_rgba(0,0,0,0.015)] focus:shadow-[0_8px_32px_rgba(15,23,42,0.06)] transition-all text-sm font-semibold text-gray-700 placeholder-[#94A3B8]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-5 top-1/2 transform -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-4 w-4 stroke-[2.5]" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
                    {/* Type Filter Dropdown */}
                    <div className="relative" ref={typeFilterRef}>
                        <button
                            onClick={() => setShowTypeFilter(!showTypeFilter)}
                            className={`flex items-center space-x-1.5 px-4 py-3.5 border rounded-3xl text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.01)] ${
                                activeFileType 
                                    ? 'bg-[#EBF4FE] border-[#90CAF9] text-[#1E88E5]' 
                                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                            }`}
                        >
                            <span>{activeFileType ? activeFileType.label : 'Тип файла'}</span>
                            <svg className={`w-3 h-3 text-[#94A3B8] transition-transform duration-200 ${showTypeFilter ? 'rotate-180 text-[#1E88E5]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <AnimatePresence>
                            {showTypeFilter && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0] py-1.5 z-50 max-h-64 overflow-y-auto"
                                >
                                    <button
                                        onClick={() => { setActiveFileType(null); setShowTypeFilter(false); }}
                                        className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F8FAFC] ${!activeFileType ? 'text-[#1E88E5] bg-[#EBF4FE]/50' : 'text-[#64748B]'}`}
                                    >
                                        Все типы
                                    </button>
                                    {fileTypes.map((itemVal, idx) => (
                                        <button
                                            key={itemVal.type || idx}
                                            onClick={() => { setActiveFileType(itemVal); setShowTypeFilter(false); }}
                                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F8FAFC] ${activeFileType?.type === itemVal.type ? 'text-[#1E88E5] bg-[#EBF4FE]/50' : 'text-[#64748B]'}`}
                                        >
                                            {itemVal.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {mode === 'shared' && (
                        <div className="relative" ref={userFilterRef}>
                            <button
                                onClick={() => setShowUserFilter(!showUserFilter)}
                                className={`flex items-center space-x-1.5 px-4 py-3.5 border rounded-3xl text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.01)] ${
                                    activeSharedUser 
                                        ? 'bg-[#EBF4FE] border-[#90CAF9] text-[#1E88E5]' 
                                        : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                                }`}
                            >
                                <span>{activeSharedUser ? (activeSharedUser.full_name || activeSharedUser.username) : 'Отправитель'}</span>
                                <svg className={`w-3 h-3 text-[#94A3B8] transition-transform duration-200 ${showUserFilter ? 'rotate-180 text-[#1E88E5]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <AnimatePresence>
                                {showUserFilter && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        transition={{ duration: 0.1 }}
                                    className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-[#E2E8F0] py-1.5 z-50 max-h-64 overflow-y-auto"
                                    >
                                        <button
                                            onClick={() => { setActiveSharedUser(null); setShowUserFilter(false); }}
                                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F8FAFC] ${!activeSharedUser ? 'text-[#1E88E5] bg-[#EBF4FE]/50' : 'text-[#64748B]'}`}
                                        >
                                            Все пользователи
                                        </button>
                                        {sharedUsers?.map((u) => (
                                            <button
                                                key={u.id}
                                                onClick={() => { setActiveSharedUser(u); setShowUserFilter(false); }}
                                                className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F8FAFC] flex items-center ${activeSharedUser?.id === u.id ? 'text-[#1E88E5] bg-[#EBF4FE]/50' : 'text-[#64748B]'}`}
                                            >
                                                <div className="h-5 w-5 rounded-full bg-[#EBF4FE] flex items-center justify-center text-[#1E88E5] font-bold text-[9px] mr-2 flex-shrink-0">
                                                    {u.username?.[0]?.toUpperCase()}
                                                </div>
                                                <span className="truncate">{u.full_name || u.username}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>



            {/* Navigation & Actions Toolbar */}
            <div className="flex justify-between items-center mb-6 px-2">
                <div className="flex items-center space-x-2">
                    {currentFolderId !== 'root' && (
                        <button onClick={handleGoBack} className="p-2 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition-all text-[#64748B] hover:text-[#1E293B] active:scale-95 mr-1 bg-white cursor-pointer">
                            <ArrowLeft className="h-4.5 w-4.5 stroke-[2.5]" />
                        </button>
                    )}
                    <h2 className="text-base font-bold text-[#1E293B] tracking-tight uppercase flex items-center gap-1.5">
                        <span>{currentFolderId === 'root' ? (mode === 'shared' ? 'Доступные мне' : mode === 'recent' ? 'Недавние' : 'Файлы') : 'Папка'}</span>
                    </h2>
                </div>

                <div className="flex items-center space-x-3">
                    {/* View Switch */}
                    <div className="flex items-center bg-[#E2E8F0]/70 p-0.5 rounded-xl border border-[#DCE4EC]">
                        <button
                            type="button"
                            onClick={() => toggleViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1E88E5]' : 'text-[#64748B] hover:text-[#1E293B]'}`}
                            title="Список"
                        >
                            <List className="h-4.5 w-4.5 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#1E88E5]' : 'text-[#64748B] hover:text-[#1E293B]'}`}
                            title="Сетка"
                        >
                            <Grid className="h-4.5 w-4.5 stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Bulk Selection Actions */}
                    {selectedItems.size > 0 && (
                        <div className="flex items-center space-x-2 bg-[#EBF4FE] px-3 py-1.5 rounded-xl border border-[#BBDEFB] animate-in fade-in slide-in-from-top-2 duration-200">
                            <span className="text-xs font-bold text-[#1E88E5]">{selectedItems.size}</span>
                            <div className="h-4 w-px bg-[#90CAF9] mx-1.5" />
                            <button
                                onClick={handleSelectAll}
                                className="text-xs font-bold text-[#1E88E5] hover:underline transition-colors cursor-pointer"
                            >
                                {selectedItems.size === files.length ? 'Отменить все' : 'Выбрать все'}
                            </button>
                            <button
                                onClick={confirmBulkDelete}
                                className="text-xs font-bold text-red-600 hover:underline transition-colors ml-1.5 cursor-pointer"
                            >
                                Удалить
                            </button>
                        </div>
                    )}

                    {/* Create Inline folder form */}
                    {mode === 'my-drive' && isCreatingFolder && (
                        <form onSubmit={handleCreateFolder} className="flex items-center space-x-2 bg-white border border-[#E2E8F0] p-1 rounded-2xl shadow-sm">
                            <input
                                autoFocus
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Имя папки"
                                disabled={isSubmittingFolder}
                                className="border-0 bg-transparent px-3 py-1 text-xs font-semibold text-gray-700 placeholder-[#94A3B8] focus:outline-none w-32"
                                onBlur={() => !newFolderName && !isSubmittingFolder && setIsCreatingFolder(false)}
                            />
                            <button type="submit" disabled={isSubmittingFolder} className="text-[#1E88E5] hover:bg-[#EBF4FE] p-1.5 rounded-xl transition-all cursor-pointer">
                                <Check className="h-4 w-4 stroke-[2.5]" />
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {error ? (
                <div className="text-center text-red-500 mt-10">
                    <p className="font-semibold">{error}</p>
                    <button onClick={() => loadFiles(currentFolderId)} className="mt-4 px-4 py-2 border border-[#E2E8F0] bg-white text-xs font-bold rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer">Повторить</button>
                </div>
            ) : files.length === 0 ? (
                <div className="text-center py-20 bg-white border border-[#E2E8F0] rounded-3xl mx-2 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                    <div className="bg-[#F8FAFC] border border-[#EBF0F6] rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                        <UploadCloud className="h-10 w-10 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">
                        {mode === 'shared' ? 'Нет доступных файлов' : mode === 'recent' ? 'Нет недавних файлов' : 'Папка пуста'}
                    </h3>
                    <p className="mt-1 text-xs text-[#94A3B8]">Создайте новую папку или добавьте файлы в левом меню.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Recommended Folders Grid (Only show if foldersList contains folders) */}
                    {foldersList.length > 0 && (
                        <div className="px-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Папки</h3>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {foldersList.map((folder) => (
                                    <div
                                        key={folder.id}
                                        onClick={() => handleFileClick(folder)}
                                        className="bg-white border border-[#E2E8F0] p-4 rounded-3xl flex items-center justify-between gap-3 hover:shadow-[0_8px_24px_rgba(30,136,229,0.04)] hover:border-[#1E88E5]/30 transition-all hover:-translate-y-0.5 group/folder relative cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EBF4FE] text-[#1E88E5] border border-[#BBDEFB]">
                                                <Folder className="h-5 w-5 fill-current text-[#1E88E5]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-[#1E293B] truncate leading-tight group-hover/folder:text-[#1E88E5] transition-colors">{folder.name}</p>
                                                <p className="text-[10px] text-[#94A3B8] font-semibold mt-1">Папка</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleRenameClick(folder); }}
                                            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-slate-100 transition-colors shrink-0"
                                            title="Переименовать"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files Section */}
                    {filesList.length > 0 && (
                        <div className="px-2">
                            {foldersList.length > 0 && (
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Файлы</h3>
                            )}
                            
                            {viewMode === 'list' ? (
                                <div className="overflow-x-auto bg-white border border-[#E2E8F0] rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-[#64748B] bg-[#F8FAFC]">
                                                <th className="w-12 px-4 py-3.5 text-center">
                                                    <div onClick={handleSelectAll} className="w-5 h-5 rounded border border-[#CBD5E1] bg-white flex items-center justify-center cursor-pointer hover:border-[#1E88E5] transition-colors mx-auto">
                                                        {selectedItems.size > 0 && <div className={`w-2.5 h-2.5 ${selectedItems.size === files.length ? 'bg-[#1E88E5]' : 'bg-[#94A3B8]'} rounded-sm`} />}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => {
                                                        if (sortBy === 'name') {
                                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setSortBy('name');
                                                            setSortOrder('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center space-x-1">
                                                        <span>Название</span>
                                                        {sortBy === 'name' && (
                                                            <span className="text-[#1E88E5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                                {mode === 'shared' && (
                                                    <th className="px-4 py-3.5 hidden sm:table-cell">
                                                        Создатель
                                                    </th>
                                                )}
                                                <th
                                                    className="px-4 py-3.5 hidden sm:table-cell cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => {
                                                        if (sortBy === 'size') {
                                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setSortBy('size');
                                                            setSortOrder('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center space-x-1">
                                                        <span>Размер</span>
                                                        {sortBy === 'size' && (
                                                            <span className="text-[#1E88E5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3.5 hidden lg:table-cell cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => {
                                                        if (sortBy === 'created_at') {
                                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setSortBy('created_at');
                                                            setSortOrder('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center space-x-1">
                                                        <span>Создан</span>
                                                        {sortBy === 'created_at' && (
                                                            <span className="text-[#1E88E5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3.5 hidden md:table-cell cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => {
                                                        if (sortBy === 'updated_at') {
                                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setSortBy('updated_at');
                                                            setSortOrder('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center space-x-1">
                                                        <span>Изменен</span>
                                                        {sortBy === 'updated_at' && (
                                                            <span className="text-[#1E88E5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3.5 text-right w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#E2E8F0] bg-white">
                                            {filesList.map((file) => (
                                                <FileTableRow
                                                    key={file.id}
                                                    file={file}
                                                    onEdit={handleFileClick}
                                                    onDelete={handleDeleteClick}
                                                    onRename={handleRenameClick}
                                                    onShare={handleShareClick}
                                                    onSendToMessenger={handleSendToMessengerClick}
                                                    selected={selectedItems.has(file.id)}
                                                    onSelect={handleToggleSelection}
                                                    showOwnerFio={mode === 'shared'}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                    {filesList.map((file) => (
                                        <FileCard
                                            key={file.id}
                                            file={file}
                                            onEdit={handleFileClick}
                                            onDelete={handleDeleteClick}
                                            onRename={handleRenameClick}
                                            onShare={handleShareClick}
                                            onSendToMessenger={handleSendToMessengerClick}
                                            selected={selectedItems.has(file.id)}
                                            onSelect={handleToggleSelection}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ShareModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                file={fileToShare}
            />

            <SendToMessengerModal
                isOpen={messengerModalOpen}
                onClose={() => setMessengerModalOpen(false)}
                file={fileToSendMessage}
            />

            <ImagePreviewModal
                isOpen={previewModalOpen}
                onClose={() => setPreviewModalOpen(false)}
                file={fileToPreview}
            />

            <CreateFileModal
                isOpen={createFileModalOpen}
                onClose={() => setCreateFileModalOpen(false)}
                type={fileTypeToCreate}
                onCreate={handleCreateFileConfirm}
            />

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".docx,.xlsx,.pdf,.pptx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                className="hidden"
            />

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                file={fileToDelete}
                onConfirm={confirmDeleteFile}
            />

            <RenameModal
                isOpen={renameModalOpen}
                onClose={() => { setRenameModalOpen(false); setFileToRename(null); }}
                file={fileToRename}
                onConfirm={confirmRename}
            />

        </motion.div>
    );
};

export default Drive;
