import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, UserMinus, UserPlus, Link as LinkIcon, Copy, MessageCircle } from 'lucide-react';
import { useToast } from './Toast';
import { grantPermission, revokePermission, getUsersWithAccess, getUsersWithoutAccess, updatePermission, createShareLink, getMyPermission } from '../api/files';
import SendToMessengerModal from './SendToMessengerModal';

const ShareModal = ({ isOpen, onClose, file }) => {
    const [query, setQuery] = useState('');
    const [usersWithAccess, setUsersWithAccess] = useState([]);
    const [usersWithoutAccess, setUsersWithoutAccess] = useState([]); // All potential users to share with
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedRole, setSelectedRole] = useState('viewer');
    const [sharing, setSharing] = useState(false);
    const [messengerOpen, setMessengerOpen] = useState(false);
    const { addToast } = useToast();

    const [userToRevoke, setUserToRevoke] = useState(null);
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        if (isOpen && file) {
            fetchUsers();
            fetchMyPermission();
            setQuery('');
            setSelectedUsers([]);
            setUserToRevoke(null);
        }
    }, [isOpen, file]);

    const fetchMyPermission = async () => {
        if (!file) return;
        try {
            const resourceType = file.type === 'dir' ? 'folder' : 'file';
            const perm = await getMyPermission(file.id, resourceType);
            setIsOwner(perm?.role === 'owner');
        } catch {
            setIsOwner(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const resourceType = file.type === 'dir' ? 'folder' : 'file';
            const [withAccess, withoutAccess] = await Promise.all([
                getUsersWithAccess(file.id, resourceType),
                getUsersWithoutAccess(file.id, resourceType)
            ]);
            setUsersWithAccess(Array.isArray(withAccess) ? withAccess : []);
            setUsersWithoutAccess(Array.isArray(withoutAccess) ? withoutAccess : []);
            setFilteredUsers(Array.isArray(withoutAccess) ? withoutAccess : []);
        } catch (err) {
            console.error("Failed to fetch users", err);
            addToast("Не удалось загрузить список пользователей", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (!val) {
            setFilteredUsers(usersWithoutAccess);
        } else {
            const lower = val.toLowerCase();
            const filtered = usersWithoutAccess.filter(u =>
                (u.username && u.username.toLowerCase().includes(lower)) ||
                (u.full_name && u.full_name.toLowerCase().includes(lower)) ||
                (u.first_name && u.first_name.toLowerCase().includes(lower)) ||
                (u.last_name && u.last_name.toLowerCase().includes(lower)) ||
                (u.email && u.email.toLowerCase().includes(lower))
            );
            setFilteredUsers(filtered);
        }
    };

    const toggleUserSelection = (user) => {
        setSelectedUsers(prev => {
            const exists = prev.find(u => u.id === user.id);
            if (exists) {
                return prev.filter(u => u.id !== user.id);
            } else {
                return [...prev, user];
            }
        });
    };

    const handleShare = async () => {
        if (selectedUsers.length === 0 || !file) return;
        try {
            setSharing(true);
            const resourceType = file.type === 'dir' ? 'folder' : 'file';
            const userIds = selectedUsers.map(u => u.id);
            await grantPermission(file.id, userIds, selectedRole, resourceType);

            const names = selectedUsers
                .map(u => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.full_name || u.username)
                .join(', ');
            addToast(`Файл "${file.name}" доступен для: ${names}`, 'success');

            // Refresh lists
            fetchUsers();
            setSelectedUsers([]);
        } catch (err) {
            console.error("Share failed", err);
            addToast("Не удалось предоставить доступ", 'error');
        } finally {
            setSharing(false);
        }
    };

    const handleRevoke = (user) => {
        setUserToRevoke(user);
    };

    const confirmRevoke = async () => {
        if (!file || !userToRevoke) return;

        try {
            const resourceType = file.type === 'dir' ? 'folder' : 'file';
            await revokePermission(file.id, userToRevoke.id, resourceType);
            const userName =
                [userToRevoke.first_name, userToRevoke.last_name].filter(Boolean).join(' ').trim() ||
                userToRevoke.full_name ||
                userToRevoke.username;
            addToast(`Доступ для ${userName} закрыт`, 'success');
            fetchUsers();
        } catch (err) {
            console.error("Revoke failed", err);
            addToast("Не удалось закрыть доступ", 'error');
        } finally {
            setUserToRevoke(null);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] relative border border-gray-100"
                >
                    {/* Confirmation Overlay */}
                    <AnimatePresence>
                        {userToRevoke && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10 bg-white/95 flex items-center justify-center p-6 text-center"
                            >
                                <div className="space-y-4 max-w-sm">
                                    <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                                        <UserMinus className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Закрыть доступ?</h3>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Пользователь{' '}
                                            <span className="font-semibold text-gray-700">
                                                {[userToRevoke.first_name, userToRevoke.last_name].filter(Boolean).join(' ').trim() ||
                                                    userToRevoke.full_name ||
                                                    userToRevoke.username}
                                            </span>{' '}
                                            больше не сможет просматривать этот файл.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <button
                                            onClick={() => setUserToRevoke(null)}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            onClick={confirmRevoke}
                                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                        >
                                            Закрыть доступ
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Настройки доступа</h3>
                            <p className="text-sm text-gray-500 mt-1">{file?.name}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Section: Copy Link — только для владельца */}
                        {isOwner && (
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                        <LinkIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900">Копировать ссылку</h4>
                                        <p className="text-xs text-gray-500">Любой, у кого есть ссылка, сможет просмотреть этот файл</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={async () => {
                                            try {
                                                const resourceType = file.type === 'dir' ? 'folder' : 'file';
                                                const result = await createShareLink(file.id, resourceType);
                                                const link = result.link || result.url || (typeof result === 'string' ? result : '');

                                                if (!link) throw new Error("No link returned");

                                                if (navigator.clipboard?.writeText) {
                                                    await navigator.clipboard.writeText(link);
                                                } else {
                                                    // Fallback for insecure contexts
                                                    const textArea = document.createElement("textarea");
                                                    textArea.value = link;
                                                    textArea.style.position = "fixed";
                                                    textArea.style.left = "-9999px";
                                                    document.body.appendChild(textArea);
                                                    textArea.focus();
                                                    textArea.select();
                                                    try {
                                                        document.execCommand('copy');
                                                    } catch (err) {
                                                        console.error('Fallback copy failed', err);
                                                        throw err;
                                                    } finally {
                                                        document.body.removeChild(textArea);
                                                    }
                                                }
                                                addToast("Ссылка скопирована", 'success');
                                            } catch (err) {
                                                console.error("Failed to copy link", err);
                                                addToast("Не удалось скопировать ссылку", 'error');
                                            }
                                        }}
                                        className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm items-center"
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Копировать
                                    </button>
                                    <button
                                        onClick={() => setMessengerOpen(true)}
                                        className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium text-sm rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm flex items-center whitespace-nowrap"
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" />
                                        Отправить в Messenger
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}
                        {!isOwner && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <p className="text-sm text-gray-500">Делиться ссылкой могут только владельцы файла.</p>
                            </div>
                        )}

                        <SendToMessengerModal
                            isOpen={messengerOpen}
                            onClose={() => setMessengerOpen(false)}
                            file={file}
                        />

                        {/* Section: Who has access */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">У кого есть доступ</h4>
                            <div className="space-y-3">
                                {loading && usersWithAccess.length === 0 ? (
                                    <div className="animate-pulse space-y-3">
                                        {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>)}
                                    </div>
                                ) : usersWithAccess.length <= 1 && usersWithAccess.every(u => u.role === 'owner') ? (
                                    <div className="text-sm text-gray-500 italic">Только у вас</div>
                                ) : (
                                    usersWithAccess.map(user => {
                                        const roleNames = {
                                            viewer: 'Читатель',
                                            editor: 'Редактор',
                                            owner: 'Владелец'
                                        };
                                        return (
                                            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm mr-3">
                                                        {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {[user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    {isOwner ? (
                                                        <>
                                                            <select
                                                                value={user.role}
                                                                onChange={async (e) => {
                                                                    try {
                                                                        const newRole = e.target.value;
                                                                        const resourceType = file.type === 'dir' ? 'folder' : 'file';
                                                                        await updatePermission(file.id, user.id, newRole, resourceType);
                                                                        addToast(`Права для ${user.full_name || user.username} изменены`, 'success');
                                                                        fetchUsers();
                                                                    } catch (err) {
                                                                        console.error("Failed to update permission", err);
                                                                        addToast("Не удалось изменить права", 'error');
                                                                    }
                                                                }}
                                                                className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded border-none focus:ring-1 focus:ring-blue-500 cursor-pointer outline-none"
                                                            >
                                                                <option value="viewer">Читатель</option>
                                                                <option value="editor">Редактор</option>
                                                                <option value="owner">Владелец</option>
                                                            </select>
                                                            {user.role !== 'owner' && (
                                                                <button
                                                                    onClick={() => handleRevoke(user)}
                                                                    className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                                    title="Закрыть доступ"
                                                                >
                                                                    <UserMinus className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs font-medium text-gray-500">
                                                            {roleNames[user.role] || user.role}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {isOwner && <hr className="border-gray-100" />}

                        {/* Section: Add people — только для владельца */}
                        {isOwner && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Добавить пользователей</h4>

                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Поиск по имени..."
                                    value={query}
                                    onChange={handleSearch}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-gray-900 placeholder-gray-400"
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                                {loading && filteredUsers.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">Загрузка...</div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                        {usersWithoutAccess.length === 0 ? 'Все пользователи уже имеют доступ' : 'Ничего не найдено'}
                                    </div>
                                ) : (
                                    filteredUsers.map(user => {
                                        const isSelected = selectedUsers.some(u => u.id === user.id);
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleUserSelection(user)}
                                                className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-white shadow-sm'}`}
                                            >
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs mr-3">
                                                    {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">
                                                        {[user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username}
                                                    </div>
                                                </div>
                                                {isSelected ? (
                                                    <Check className="h-5 w-5 text-blue-600" />
                                                ) : (
                                                    <UserPlus className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex items-end space-x-3">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs font-medium text-gray-500 ml-1">Роль доступа</label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm appearance-none"
                                    >
                                        <option value="viewer">Читатель</option>
                                        <option value="editor">Редактор</option>
                                        <option value="owner">Владелец</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleShare}
                                    disabled={selectedUsers.length === 0 || sharing}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 h-[42px]"
                                >
                                    {sharing ? '...' : (selectedUsers.length > 0 ? `Добавить (${selectedUsers.length})` : 'Добавить')}
                                </button>
                            </div>
                        </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ShareModal;
