import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, Send, MessageCircle, ChevronRight, Users, MessageSquare, Hash } from 'lucide-react';
import { useToast } from './Toast';
import { grantPermission } from '../api/files';
import client from '../api/client';
import MessengerAvatar from '../../../../components/messenger/MessengerAvatar';

const SendToMessengerModal = ({ isOpen, onClose, file }) => {
    const [query, setQuery] = useState('');
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedChats, setSelectedChats] = useState([]);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const { addToast } = useToast();
    const [selectedRole, setSelectedRole] = useState('viewer');

    useEffect(() => {
        if (isOpen) {
            fetchChats();
            setQuery('');
            setSelectedChats([]);
            setActiveTab('all');
        }
    }, [isOpen]);

    const fetchChats = async () => {
        setLoading(true);
        try {
            const response = await client.get('/chats/unified');
            setChats(response.data || []);
        } catch (err) {
            console.error("Failed to fetch chats", err);
            addToast("Не удалось загрузить список чатов", 'error');
        } finally {
            setLoading(false);
        }
    };

    const getChatName = (chat) => chat.peer_full_name || chat.group_name || chat.channel_name || 'Чат';
    
    const getInitials = (name) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const getChatAvatarProps = (chat) => {
        const name = getChatName(chat);
        const initials = getInitials(name);
        const imageUrl = chat.peer_avatar || chat.group_avatar || chat.channel_avatar;
        const seed = chat.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return { initials, imageUrl, seed };
    };

    const getChatSubtitle = (chat) => {
        switch (chat.type) {
            case 'personal': return 'Личный чат';
            case 'group': return 'Группа';
            case 'channel': return 'Канал';
            default: return 'Чат';
        }
    };

    const filteredChats = chats.filter(chat => {
        if (chat.type === 'channel') return false;
        const name = getChatName(chat).toLowerCase();
        const matchesSearch = name.includes(query.toLowerCase());
        const matchesTab = activeTab === 'all' || chat.type === activeTab;
        return matchesSearch && matchesTab;
    });

    const toggleChat = (chat) => {
        setSelectedChats(prev => {
            const exists = prev.find(c => c.id === chat.id);
            if (exists) {
                return prev.filter(c => c.id !== chat.id);
            } else {
                return [...prev, chat];
            }
        });
    };

    const handleSend = async () => {
        if (selectedChats.length === 0 || !file) return;
        try {
            setSending(true);

            // 1. Ensure file is public
            try {
                await grantPermission(file.id, 'public', selectedRole);
            } catch (err) {
                console.warn("Failed to grant public access", err);
            }

            // 2. Prepare message
            const metadata = JSON.stringify({
                type: 'drive_file',
                fileId: file.id,
                fileName: file.name,
                fileSize: file.size,
                fileMime: file.mime_type,
                sharedVia: 'drive_modal'
            });
            const content = `📄 Alem Drive: ${file.name}`;

            // 3. Send to each selected chat
            let successCount = 0;
            const promises = selectedChats.map(async (chat) => {
                try {
                    let endpoint = '';
                    if (chat.type === 'group') {
                        endpoint = `/groups/${chat.id}/messages`;
                    } else if (chat.type === 'channel') {
                        endpoint = `/channels/${chat.id}/messages`;
                    } else {
                        endpoint = `/conversations/${chat.id}/messages`;
                    }

                    await client.post(endpoint, {
                        content,
                        type: 'text',
                        metadata
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to send to chat ${chat.id}`, err);
                }
            });

            await Promise.allSettled(promises);

            if (successCount === selectedChats.length) {
                addToast(`Файл отправлен в ${selectedChats.length} чатов`, 'success');
            } else if (successCount > 0) {
                addToast(`Отправлено в ${successCount} из ${selectedChats.length} чатов`, 'warning');
            } else {
                addToast("Не удалось отправить файл", 'error');
            }

            onClose();
        } catch (err) {
            console.error("Send failed", err);
            addToast("Ошибка при отправке", 'error');
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
                    style={{ fontFamily: '"Inter", "Roboto", sans-serif' }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <MessageCircle className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Отправить в Messenger</h3>
                                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[240px]">Файл: {file?.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs and Search */}
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 space-y-4">
                        <div className="flex p-1 bg-gray-100/80 rounded-2xl">
                            {[
                                { id: 'all', label: 'Все' },
                                { id: 'personal', label: 'Чаты' },
                                { id: 'group', label: 'Группы' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                                        activeTab === tab.id 
                                            ? 'bg-white text-indigo-600 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Поиск чатов..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                        </div>

                        {/* Role Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-indigo-50/40 border border-indigo-100/60 rounded-2xl gap-3">
                            <div className="flex items-center gap-2">
                                <Hash className="w-5 h-5 text-indigo-500" />
                                <span className="text-[13px] font-semibold text-gray-700">Права доступа:</span>
                            </div>
                            <div className="flex bg-white rounded-xl p-0.5 border border-gray-200">
                                {[
                                    { id: 'viewer', label: 'Просмотр' },
                                    { id: 'commenter', label: 'Коммент.' },
                                    { id: 'editor', label: 'Редакт.' }
                                ].map((role) => (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => setSelectedRole(role.id)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            selectedRole === role.id 
                                                ? 'bg-indigo-600 text-white shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {role.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-medium">Загрузка чатов...</span>
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                                <Search className="w-10 h-10 opacity-20" />
                                <span className="text-sm">Чаты не найдены</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1">
                                {filteredChats.map((chat) => {
                                    const isSelected = selectedChats.some(c => c.id === chat.id);
                                    const avatarProps = getChatAvatarProps(chat);
                                    return (
                                        <button
                                            key={chat.id}
                                            onClick={() => toggleChat(chat)}
                                            className={`flex items-center gap-3.5 p-3 px-4 rounded-2xl text-left transition-all group border border-transparent ${
                                                isSelected ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <MessengerAvatar {...avatarProps} size={44} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                                                    {getChatName(chat)}
                                                </div>
                                                <div className="text-[13px] text-gray-500 mt-0.5 truncate font-normal">
                                                    {getChatSubtitle(chat)}
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-200 group-hover:border-indigo-300'
                                            }`}>
                                                {isSelected && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div className="text-xs text-gray-500">
                            {selectedChats.length > 0 ? (
                                <span>Выбрано: <b>{selectedChats.length}</b></span>
                            ) : (
                                "Выберите чаты для отправки"
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={selectedChats.length === 0 || sending}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 flex items-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Отправка...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Отправить {selectedChats.length > 0 && `(${selectedChats.length})`}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SendToMessengerModal;
