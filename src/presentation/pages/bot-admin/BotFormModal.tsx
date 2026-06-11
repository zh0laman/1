import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Sliders, Cpu } from 'lucide-react';
import type { Bot, BotCreateInput } from '../../../domain/entities/bot';

interface BotFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BotCreateInput) => Promise<void>;
  bot?: Bot | null; // If editing, bot is provided
}

export default function BotFormModal({ isOpen, onClose, onSave, bot }: BotFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setDescription(bot.description || '');
      setSystemPrompt(bot.system_prompt || '');
      setTemperature(bot.settings?.temperature ?? 0.7);
      setMaxTokens(bot.settings?.max_tokens ?? 2000);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setTemperature(0.7);
      setMaxTokens(2000);
    }
    setError(null);
  }, [bot, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      await onSave({
        name,
        description,
        system_prompt: systemPrompt,
        settings: {
          temperature,
          max_tokens: maxTokens,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения бота');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-2xl bg-[#0E1B2E] border border-[#1E293B] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-2 text-white">
                <Cpu className="w-5 h-5 text-[#1E88E5]" />
                <h3 className="text-lg font-bold">
                  {bot ? 'Редактировать чат-бота' : 'Создать нового чат-бота'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#8497B4] hover:bg-[#1E293B] hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {error && (
                <div className="p-3 text-xs bg-red-950/50 border border-red-500/30 rounded-xl text-red-200">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-2">
                  Имя бота *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Ассистент по техподдержке"
                  className="w-full px-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-2">
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание назначения этого бота"
                  rows={2}
                  className="w-full px-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition resize-none"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-2">
                  Системный промпт (Инструкции для ИИ)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Ты — дружелюбный ассистент службы поддержки. Отвечай коротко и вежливо..."
                  rows={5}
                  className="w-full px-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition font-mono"
                />
              </div>

              {/* LLM Settings Header */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#1E293B] text-white">
                <Sliders className="w-4 h-4 text-[#1E88E5]" />
                <span className="text-sm font-semibold">Настройки LLM модели</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#070F19]/50 p-4 rounded-2xl border border-[#1E293B]">
                {/* Temperature */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-[#8497B4] uppercase tracking-wider">
                      Температура (Креативность)
                    </label>
                    <span className="text-sm font-mono text-[#1E88E5]">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#1E88E5]"
                  />
                  <div className="flex justify-between text-[10px] text-[#526685] mt-1">
                    <span>Точный</span>
                    <span>Сбалансированный</span>
                    <span>Креативный</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-2">
                    Максимум токенов (Ответ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16384"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
                    className="w-full px-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-transparent border border-[#1E293B] hover:bg-[#1E293B] text-[#8497B4] hover:text-white text-sm font-semibold rounded-xl transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white text-sm font-semibold rounded-xl hover:from-[#1976D2] hover:to-[#0D47A1] shadow-[0_4px_15px_rgba(30,136,229,0.2)] transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Сохранить
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
