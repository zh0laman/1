import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot as BotIcon,
  Send,
  ArrowLeft,
  Search,
  FileText,
  Sparkles,
  AlertCircle,
  Loader2,
  Power,
} from 'lucide-react';
import type { Bot } from '../../../domain/entities/bot';
import { botAdminRepository } from '../../../infrastructure/repositories/HttpBotAdminRepository';
import {
  ragChatApi,
  type RagChatMessage,
  type RagChatSource,
} from '../../../infrastructure/repositories/HttpRagChatRepository';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagChatSource[];
  pending?: boolean;
}

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function RagChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bots, setBots] = useState<Bot[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [messagesByBot, setMessagesByBot] = useState<Record<string, UiMessage[]>>({});
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeBot = useMemo(
    () => bots.find((b) => b.id === activeBotId) || null,
    [bots, activeBotId],
  );
  const messages = activeBotId ? messagesByBot[activeBotId] ?? [] : [];

  const filteredBots = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return bots;
    return bots.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)),
    );
  }, [bots, search]);

  // Load bots once
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list = await botAdminRepository.listBots();
        if (!alive) return;
        setBots(list);

        const requested = searchParams.get('bot');
        const initial =
          (requested && list.find((b) => b.id === requested)?.id) ||
          list.find((b) => b.is_active)?.id ||
          list[0]?.id ||
          null;
        setActiveBotId(initial);
      } catch (err) {
        if (alive) setBotsError(err instanceof Error ? err.message : 'Не удалось загрузить ботов');
      } finally {
        if (alive) setLoadingBots(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSelectBot = (botId: string) => {
    setActiveBotId(botId);
    setSearchParams({ bot: botId }, { replace: true });
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const updateAssistant = (botId: string, msgId: string, patch: Partial<UiMessage>) => {
    setMessagesByBot((prev) => ({
      ...prev,
      [botId]: (prev[botId] ?? []).map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
    }));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeBotId || isSending) return;

    const botId = activeBotId;
    const history: RagChatMessage[] = (messagesByBot[botId] ?? [])
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: UiMessage = { id: createId(), role: 'user', content: text };
    const assistantId = createId();
    const assistantMsg: UiMessage = { id: assistantId, role: 'assistant', content: '', pending: true };

    setMessagesByBot((prev) => ({
      ...prev,
      [botId]: [...(prev[botId] ?? []), userMsg, assistantMsg],
    }));
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsSending(true);

    let streamed = '';
    try {
      await ragChatApi.askStream(
        { botId, message: text, history, topK: 5 },
        {
          onSources: (sources) => updateAssistant(botId, assistantId, { sources }),
          onDelta: (delta) => {
            streamed += delta;
            updateAssistant(botId, assistantId, { content: streamed, pending: true });
          },
          onError: (message) => {
            updateAssistant(botId, assistantId, {
              content: streamed || `Ошибка: ${message}`,
              pending: false,
            });
          },
        },
      );
      updateAssistant(botId, assistantId, {
        content: streamed || 'Пустой ответ от модели.',
        pending: false,
      });
    } catch (err) {
      updateAssistant(botId, assistantId, {
        content:
          streamed ||
          (err instanceof Error ? err.message : 'Не удалось получить ответ от бота.'),
        pending: false,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#070F19] text-gray-200 font-sans overflow-hidden">
      {/* Bot sidebar */}
      <aside className="w-72 shrink-0 border-r border-[#1E293B] bg-[#0E1B2E]/60 flex flex-col">
        <div className="px-4 py-4 border-b border-[#1E293B] flex items-center gap-2">
          <button
            onClick={() => navigate('/rag-admin/bots')}
            className="p-2 rounded-xl text-[#8497B4] hover:bg-[#1E293B] hover:text-white transition"
            title="К панели ботов"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Чат с ботами</h1>
            <span className="text-[11px] text-[#8497B4]">Выберите бота для диалога</span>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526685]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск бота..."
              className="w-full pl-9 pr-3 py-2 bg-[#070F19] border border-[#1E293B] rounded-xl text-xs text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {loadingBots ? (
            <div className="flex items-center justify-center py-10 text-[#8497B4] gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
            </div>
          ) : botsError ? (
            <div className="m-2 p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{botsError}</span>
            </div>
          ) : filteredBots.length === 0 ? (
            <div className="m-2 p-4 text-center text-xs text-[#8497B4]">
              {bots.length === 0 ? (
                <>
                  <p>У вас пока нет ботов.</p>
                  <button
                    onClick={() => navigate('/rag-admin/bots')}
                    className="mt-3 text-[#1E88E5] hover:underline font-medium"
                  >
                    Создать бота
                  </button>
                </>
              ) : (
                'Ничего не найдено.'
              )}
            </div>
          ) : (
            filteredBots.map((bot) => {
              const isActive = bot.id === activeBotId;
              return (
                <button
                  key={bot.id}
                  onClick={() => handleSelectBot(bot.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition flex items-center gap-3 ${
                    isActive
                      ? 'bg-[#1E88E5]/10 border-[#1E88E5]/40'
                      : 'bg-transparent border-transparent hover:bg-[#1E293B]/50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isActive ? 'bg-[#1E88E5] text-white' : 'bg-[#070F19] text-[#1E88E5] border border-[#1E293B]'
                    }`}
                  >
                    <BotIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-white truncate">{bot.name}</p>
                      {!bot.is_active && (
                        <Power className="w-3 h-3 text-[#526685] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#8497B4] truncate">
                      {bot.description || 'Без описания'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {!activeBot ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-[#1E293B]/50 rounded-2xl flex items-center justify-center mb-4 text-[#8497B4]">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Выберите бота слева</h2>
            <p className="text-sm text-[#8497B4] max-w-sm">
              Начните диалог с одним из ваших чат-ботов. Ответы формируются из загруженной базы знаний.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <header className="border-b border-[#1E293B] bg-[#0E1B2E]/80 backdrop-blur-md px-6 py-4 flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-[#1E88E5] to-[#1565C0] rounded-xl shadow-[0_4px_12px_rgba(30,136,229,0.3)]">
                <BotIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{activeBot.name}</h2>
                <span className="text-[11px] text-[#8497B4]">
                  {activeBot.is_active ? 'Активен • RAG-поиск по базе знаний' : 'Бот отключён'}
                </span>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 bg-[#1E293B]/50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#1E88E5]">
                      <BotIcon className="w-6 h-6" />
                    </div>
                    <p className="text-sm text-[#8497B4]">
                      Задайте вопрос боту «{activeBot.name}». Он ответит на основе своей базы знаний.
                    </p>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-tr from-[#9C27B0] to-[#1E88E5] text-white'
                            : 'bg-[#070F19] border border-[#1E293B] text-[#1E88E5]'
                        }`}
                      >
                        {msg.role === 'user' ? 'Я' : <BotIcon className="w-4 h-4" />}
                      </div>

                      <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            msg.role === 'user'
                              ? 'bg-[#1E88E5] text-white rounded-tr-sm'
                              : 'bg-[#0E1B2E] border border-[#1E293B] text-gray-200 rounded-tl-sm'
                          }`}
                        >
                          {msg.content || (msg.pending ? '' : '—')}
                          {msg.pending && (
                            <span className="inline-flex items-center gap-1 align-middle">
                              <span className="w-1.5 h-1.5 bg-[#1E88E5] rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 bg-[#1E88E5] rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 bg-[#1E88E5] rounded-full animate-bounce" />
                            </span>
                          )}
                        </div>

                        {/* Sources */}
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.sources.map((src, i) => (
                              <span
                                key={`${src.filename}-${i}`}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#070F19] border border-[#1E293B] rounded-lg text-[10px] text-[#8497B4]"
                                title={`Сходство: ${(src.similarity * 100).toFixed(0)}%`}
                              >
                                <FileText className="w-3 h-3 text-[#526685]" />
                                {src.filename}
                                {src.page_number ? `, стр. ${src.page_number}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-[#1E293B] bg-[#0E1B2E]/60 px-4 md:px-8 py-4">
              <div className="max-w-3xl mx-auto flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={activeBot.is_active ? 'Напишите сообщение...' : 'Бот отключён — включите его в панели ботов'}
                  disabled={!activeBot.is_active || isSending}
                  className="flex-1 resize-none px-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-2xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition disabled:opacity-50 max-h-40"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || !activeBot.is_active || isSending}
                  className="p-3 bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white rounded-2xl hover:from-[#1976D2] hover:to-[#0D47A1] shadow-[0_4px_15px_rgba(30,136,229,0.25)] transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  title="Отправить"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
              <p className="max-w-3xl mx-auto mt-2 text-[10px] text-[#526685] text-center">
                Enter — отправить, Shift+Enter — новая строка. Ответы основаны на базе знаний бота.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
