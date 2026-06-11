import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot as BotIcon,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  LogOut,
  Sliders,
  User,
  Shield,
  FileText,
  MessageSquare
} from 'lucide-react';
import type { Bot, BotCreateInput } from '../../../domain/entities/bot';
import type { RagUser } from '../../../domain/entities/rag-auth';
import { ragAuthApi } from '../../../infrastructure/auth/ragAuthApi';
import { botAdminRepository } from '../../../infrastructure/repositories/HttpBotAdminRepository';
import BotFormModal from './BotFormModal';

export default function BotAdminPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<RagUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);

  const navigate = useNavigate();

  // Check roles helper
  const canModify = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  useEffect(() => {
    const init = async () => {
      try {
        const user = ragAuthApi.getUser();
        setCurrentUser(user);

        // Fetch bots list
        const list = await botAdminRepository.listBots();
        setBots(list);
        setFilteredBots(list);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Filter bots by search query
  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setFilteredBots(bots);
    } else {
      setFilteredBots(
        bots.filter(
          (bot) =>
            bot.name.toLowerCase().includes(query) ||
            (bot.description && bot.description.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, bots]);

  const handleLogout = () => {
    ragAuthApi.logout();
    navigate('/rag-admin/login');
  };

  const handleCreateBot = () => {
    setEditingBot(null);
    setIsModalOpen(true);
  };

  const handleEditBot = (bot: Bot) => {
    setEditingBot(bot);
    setIsModalOpen(true);
  };

  const handleSaveBot = async (data: BotCreateInput) => {
    try {
      if (editingBot) {
        // Update Bot
        const updated = await botAdminRepository.updateBot(editingBot.id, data);
        setBots(bots.map((b) => (b.id === editingBot.id ? updated : b)));
      } else {
        // Create Bot
        const created = await botAdminRepository.createBot(data);
        setBots([created, ...bots]);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Ошибка при сохранении бота');
    }
  };

  const handleDeleteBot = async (id: string) => {
    if (!window.confirm('Вы действительно хотите удалить этого бота?')) return;

    try {
      await botAdminRepository.deleteBot(id);
      setBots(bots.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(err.message || 'Ошибка при удалении бота');
    }
  };

  const handleToggleActive = async (bot: Bot) => {
    if (!canModify) return;

    try {
      const updated = await botAdminRepository.updateBot(bot.id, {
        is_active: !bot.is_active,
      });
      setBots(bots.map((b) => (b.id === bot.id ? updated : b)));
    } catch (err: any) {
      alert(err.message || 'Ошибка при переключении статуса');
    }
  };

  // Card list animations
  const listContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const cardItem = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
    <div className="min-h-screen bg-[#070F19] text-gray-200 font-sans pb-16 relative overflow-hidden">
      {/* Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#1E88E5]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#9C27B0]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation header */}
      <nav className="border-b border-[#1E293B] bg-[#0E1B2E]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-[#1E88E5] to-[#1565C0] rounded-xl shadow-[0_4px_12px_rgba(30,136,229,0.3)]">
            <BotIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Alem RAG</h1>
            <span className="text-xs text-[#8497B4]">Панель управления ботами</span>
          </div>
        </div>

        {/* User profile & Actions */}
        <div className="flex items-center gap-6">
          {currentUser && (
            <div className="flex items-center gap-3 bg-[#070F19]/60 px-4 py-2 border border-[#1E293B] rounded-2xl">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#9C27B0] to-[#1E88E5] flex items-center justify-center text-xs font-bold text-white">
                {currentUser.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-white leading-none">{currentUser.full_name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Shield className="w-3 h-3 text-[#1E88E5]" />
                  <span className="text-[10px] text-[#8497B4] capitalize font-medium">
                    {currentUser.role === 'owner' ? 'Владелец' : currentUser.role === 'admin' ? 'Администратор' : 'Наблюдатель'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 rounded-xl text-[#8497B4] hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition"
            title="Выйти"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main body content */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        {/* Controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          {/* Search */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526685]" />
            <input
              type="text"
              placeholder="Поиск по имени или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0E1B2E] border border-[#1E293B] rounded-2xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
            />
          </div>

          {/* Create button */}
          {canModify && (
            <button
              onClick={handleCreateBot}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white text-sm font-semibold rounded-2xl hover:from-[#1976D2] hover:to-[#0D47A1] shadow-[0_4px_15px_rgba(30,136,229,0.25)] transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Создать бота
            </button>
          )}
        </div>

        {/* Loading / Error states */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-t-[#1E88E5] border-[#1E293B] rounded-full animate-spin" />
            <span className="text-sm text-[#8497B4]">Загрузка ботов...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-2xl text-red-200 text-center max-w-lg mx-auto py-8">
            <p className="font-semibold">Ошибка загрузки</p>
            <p className="text-sm text-red-400 mt-2">{error}</p>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="text-center py-24 bg-[#0E1B2E]/40 border border-[#1E293B] rounded-3xl p-8 max-w-xl mx-auto">
            <div className="w-16 h-16 bg-[#1E293B]/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#8497B4]">
              <BotIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Чат-боты не найдены</h3>
            <p className="text-sm text-[#8497B4] max-w-sm mx-auto">
              {searchQuery
                ? 'Нет ботов, соответствующих вашему поисковому запросу.'
                : 'В вашей организации еще нет созданных ботов. Начните с создания первого!'}
            </p>
            {!searchQuery && canModify && (
              <button
                onClick={handleCreateBot}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white text-sm font-semibold rounded-2xl hover:from-[#1976D2] hover:to-[#0D47A1] transition"
              >
                <Plus className="w-4 h-4" />
                Создать первого бота
              </button>
            )}
          </div>
        ) : (
          /* Cards Grid */
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {filteredBots.map((bot) => (
                <motion.div
                  key={bot.id}
                  variants={cardItem}
                  layout
                  className={`bg-[#0E1B2E]/60 border border-[#1E293B] rounded-3xl overflow-hidden hover:border-[#1E88E5]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 flex flex-col justify-between ${
                    !bot.is_active ? 'opacity-70' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="p-3 bg-[#070F19]/80 rounded-2xl border border-[#1E293B] text-[#1E88E5]">
                        <BotIcon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            bot.is_active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {bot.is_active ? 'Активен' : 'Отключен'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white truncate" title={bot.name}>
                      {bot.name}
                    </h3>
                    <p className="text-xs text-[#8497B4] mt-2 line-clamp-2 min-h-[2rem]">
                      {bot.description || 'Нет описания'}
                    </p>

                    {/* Metadata items */}
                    <div className="space-y-2.5 mt-5 pt-4 border-t border-[#1E293B]/50">
                      {bot.system_prompt && (
                        <div className="flex items-start gap-2 text-[11px] text-[#8497B4]">
                          <FileText className="w-3.5 h-3.5 mt-0.5 text-[#526685] shrink-0" />
                          <span className="line-clamp-1 italic">
                            Промпт: "{bot.system_prompt}"
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-[#8497B4]">
                        <Sliders className="w-3.5 h-3.5 text-[#526685] shrink-0" />
                        <span>
                          Temp: {bot.settings?.temperature ?? 0.7} | Max Tokens:{' '}
                          {bot.settings?.max_tokens ?? 2000}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-6 py-4 border-t border-[#1E293B]/50 bg-[#070F19]/30 flex items-center justify-between">
                    {/* Toggle Active Switch */}
                    <button
                      onClick={() => handleToggleActive(bot)}
                      disabled={!canModify}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl transition ${
                        bot.is_active
                          ? 'text-[#8497B4] hover:bg-yellow-500/10 hover:text-yellow-400'
                          : 'text-[#8497B4] hover:bg-green-500/10 hover:text-green-400'
                      } disabled:opacity-50`}
                      title={bot.is_active ? 'Отключить бота' : 'Включить бота'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{bot.is_active ? 'Отключить' : 'Включить'}</span>
                    </button>

                    {/* Edit/Delete icons */}
                    {canModify && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditBot(bot)}
                          className="p-1.5 rounded-xl text-[#8497B4] hover:bg-[#1E293B] hover:text-white transition"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBot(bot.id)}
                          className="p-1.5 rounded-xl text-[#8497B4] hover:bg-red-500/10 hover:text-red-400 transition"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Form modal */}
      <BotFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveBot}
        bot={editingBot}
      />
    </div>
  );
}
