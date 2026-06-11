import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import logo from "../../../../../assets/logo.png";
import { Icon } from "../../chat/components/Icons";
import { TypingDots } from "../../chat/components/TypingDots";

import { smartAgentChat, SmartAgentApiError } from "../api/client";
import { SmartAgentWidgetRenderer } from "./SmartAgentWidgetRenderer";
import type { SmartAgentChatResponse, SmartAgentWidget } from "../types";

interface SmartAgentPanelProps {
  token: string;
}

interface SmartAgentMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  widget?: SmartAgentWidget | null;
}

const isStructuredJsonReply = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
};

const stripStructuredReplyTail = (value: string): string => {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const jsonLineIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("[{") || trimmed.startsWith("{") || trimmed.startsWith("[");
  });

  if (jsonLineIndex === -1) {
    return value;
  }

  return lines
    .slice(0, jsonLineIndex)
    .join("\n")
    .trim();
};

const renderInlineMarkdown = (value: string): ReactNode[] => {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

const renderAssistantText = (text: string): ReactNode => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const match = current.match(/^\d+\.\s+(.+)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-1">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const match = current.match(/^[-*]\s+(.+)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-1">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    nodes.push(
      <p key={`p-${i}`} className="my-1">
        {renderInlineMarkdown(line)}
      </p>,
    );
    i += 1;
  }

  return nodes;
};

export function SmartAgentPanel({ token }: SmartAgentPanelProps) {
  const [messages, setMessages] = useState<SmartAgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<unknown[]>([]);
  const [startFreshOnNextSend, setStartFreshOnNextSend] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const appendAssistant = (payload: SmartAgentChatResponse) => {
    const normalizedReply = payload.widget
      ? payload.widget.type === "task_created"
        ? "Подтверждено."
        : isStructuredJsonReply(payload.reply)
          ? ""
          : stripStructuredReplyTail(payload.reply)
      : payload.reply;
    const text = normalizedReply || "\u0413\u043e\u0442\u043e\u0432\u043e.";

    setSessionId(payload.session_id || null);
    setConversationHistory(Array.isArray(payload.conversation_history) ? payload.conversation_history : []);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "assistant",
        text,
        widget: payload.widget,
      },
    ]);
  };

  const resetChat = () => {
    generationRef.current += 1;
    setMessages([]);
    setSessionId(null);
    setConversationHistory([]);
    setStartFreshOnNextSend(true);
    setError(null);
    setIsSending(false);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const send = async (message: string, displayText?: string) => {
    if (!message.trim() || isSending) {
      return;
    }

    const requestGeneration = generationRef.current;
    setIsSending(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() - 1,
        role: "user",
        text: displayText || message.trim(),
      },
    ]);

    try {
      const response = await smartAgentChat(token, {
        message: message.trim(),
        conversation_history: startFreshOnNextSend ? [] : conversationHistory,
        session_id: startFreshOnNextSend ? null : sessionId,
        force_new_session: startFreshOnNextSend,
      });

      if (requestGeneration !== generationRef.current) {
        return;
      }

      setStartFreshOnNextSend(false);
      appendAssistant(response);
    } catch (requestError) {
      if (requestGeneration !== generationRef.current) {
        return;
      }
      if (requestError instanceof SmartAgentApiError) {
        setError(requestError.message);
      } else {
        setError("Не удалось выполнить действие. Попробуйте ещё раз.");
      }
    } finally {
      if (requestGeneration === generationRef.current) {
        setIsSending(false);
      }
    }
  };

  const onSubmit = async () => {
    if (!input.trim()) {
      return;
    }
    const message = input;
    const lastAssistantWidget = [...messages].reverse().find((item) => item.role === "assistant" && item.widget)?.widget;
    const normalizedMessage =
      lastAssistantWidget?.type === "action_confirmation"
        ? /^(да|д|ок|ага|yes|y)$/i.test(message.trim())
          ? "yes"
          : /^(нет|не|no|n)$/i.test(message.trim())
            ? "no"
            : message
        : message;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await send(normalizedMessage, message);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSubmit();
    }
  };

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  };

  return (
    <div className="mb-4 sm:mb-5 min-h-[calc(100vh-220px)] flex flex-col">
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={() => setShowNewChatConfirm(true)}
          className="ui-ghost-btn btn-pop px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#334064]"
        >
          Новый чат
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full min-h-80 flex items-start justify-center pt-8 text-center msg-enter">
            <div>
              <div
                className="w-19 h-19 rounded-[1.25rem] mx-auto mb-5 flex items-center justify-center shadow-[0_18px_36px_rgba(17,81,190,0.3)]"
                style={{ background: "linear-gradient(135deg, #0F4CBD 0%, #1A7EF0 100%)" }}
              >
                <img src={logo} alt="Alem AI" className="w-20 h-20 object-contain" />
              </div>
              <h2 className="text-[28px] font-extrabold tracking-tight text-[#0F1B3D] mb-1">Чем вам помочь?</h2>
              <p className="text-[14px] text-[#5F6B88]">Напишите ваш вопрос внизу</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {messages.map((msg) => (
              <div key={msg.id} className="msg-enter">
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div
                      className="max-w-[78%] rounded-[20px] rounded-tr-lg px-4 py-3 text-[14px] text-white shadow-[0_12px_28px_rgba(16,79,186,0.34)] card-interactive"
                      style={{ background: "linear-gradient(135deg, #1A7EF0 0%, #0E46B7 100%)" }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div
                      className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center mt-0.5 shadow-[0_10px_20px_rgba(17,83,193,0.3)]"
                      style={{ background: "linear-gradient(135deg, #0F4CBD 0%, #1A7EF0 100%)" }}
                    >
                      <img src={logo} alt="Alem AI" className="w-10 h-10 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {msg.text.trim() ? (
                        <div className="glass-card rounded-[20px] rounded-tl-lg px-4 py-3 border border-[#CDDBF2] shadow-[0_8px_20px_rgba(20,53,112,0.11)] max-w-[92%]">
                          <div className="text-[14px] text-[#122247] leading-relaxed wrap-break-word">{renderAssistantText(msg.text)}</div>
                        </div>
                      ) : null}

                      {msg.widget ? (
                        <SmartAgentWidgetRenderer
                          token={token}
                          widget={msg.widget}
                          isSending={isSending}
                          onConfirm={() => {
                            void send("yes", "Подтвердить");
                          }}
                          onCancel={() => {
                            void send("no", "Отменить");
                          }}
                          onSelect={(selectionValue, displayText) => {
                            void send(selectionValue, displayText);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 mb-4 msg-enter">
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0F4CBD 0%, #1A7EF0 100%)" }}
                >
                  <img src={logo} alt="Alem AI" className="w-4.5 h-4.5 object-contain" />
                </div>
                <div className="glass-card rounded-[18px] rounded-tl-md border border-[#D7E0F0] shadow-[0_8px_18px_rgba(20,53,112,0.14)]">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-end gap-2 bg-white/88 rounded-3xl px-4 py-2.5 border border-[#CDDBF2] shadow-[0_12px_28px_rgba(18,44,102,0.12)] focus-within:border-[#8FB3F2] focus-within:bg-white transition-all input-glow">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              autoResize();
            }}
            onKeyDown={onKeyDown}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-transparent text-[15px] text-[#0F1B3D] placeholder:text-[#8C9BBB] outline-none leading-relaxed py-0.5 resize-none min-h-6.5 max-h-35"
          />
          <button
            onClick={() => {
              void onSubmit();
            }}
            disabled={isSending || !input.trim()}
            className="ui-primary-btn btn-pop w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #1A7EF0 0%, #0E46B7 100%)" }}
          >
            <Icon.Send />
          </button>
        </div>
        {error && <p className="text-[12px] text-[#B9364A] mt-2">{error}</p>}
      </div>

      {showNewChatConfirm && (
        <div className="fixed inset-0 z-90 bg-[#0A1F4D]/35 flex items-center justify-center p-4">
          <div className="w-full max-w-115 rounded-2xl border border-[#D7E0F0] bg-white p-4 shadow-[0_24px_56px_rgba(15,42,94,0.22)]">
            <p className="text-[16px] font-bold text-[#102451] mb-2">Начать новый чат?</p>
            <p className="text-[13px] text-[#5F6B88]">
              Если создать новый чат, история текущего диалога будет очищена. Вы точно хотите продолжить?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="ui-ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#334064]"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setShowNewChatConfirm(false);
                  resetChat();
                }}
                className="ui-primary-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
              >
                Да, начать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
