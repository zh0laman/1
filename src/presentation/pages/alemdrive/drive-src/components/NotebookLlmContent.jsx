import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    ArrowLeft, X, Loader2, FileText, Send, Key, BookOpen, Lightbulb, Search, ChevronDown, Plus,
    Layers, ClipboardList, Table2, FileBarChart, Workflow, Copy, Check,
    PanelLeftClose, PanelLeft, MessageCircleMore,
    Presentation, ChevronLeft, ChevronRight, BarChart2, Download, Upload, CloudUpload,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from './Toast';
import { getDownloadUrl } from '../api/files';
import {
    createEmbeddings,
    createEmbeddingsBatched,
    chatCompletion,
    getCurrentLlmApiKey,
    FAST_CHAT_MODEL,
    THINKING_CHAT_MODEL,
} from '../api/llm';
import {
    parseDocumentFile,
    getChunkTextForEmbedding,
    getParseChunksArray,
    isDocumentParseConfigured,
} from '../api/documentParse';
import { getNotebookChatMessages, syncNotebookChat, getChatDocuments, addChatDocument, removeChatDocument } from '../api/notebookChats';
import {
    buildPresentationPptxBlob,
    buildChartPptxBlob,
    buildChartXlsxBlob,
    exportPresentationToPptx,
    exportChartToPptx,
    exportChartToXlsx,
} from '../utils/notebookExport';
import { uploadNotebookExportBlob } from '../api/notebookDriveUpload';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import { downloadMermaidDiagramAsPngFromSvg, renderMermaidSvg } from '../utils/mermaidRenderer';

const mermaidSvgClass =
    '[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:min-w-[min(100%,520px)] [&_svg]:max-w-full';

/** Рендер блоков ```mermaid из ответа ИИ */
function MermaidDiagram({ chart }) {
    const [svgHtml, setSvgHtml] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        const text = (chart || '').trim();
        if (!text) {
            setSvgHtml('');
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setSvgHtml('');

        void renderMermaidSvg(text)
            .then((svg) => {
                if (!cancelled) {
                    setSvgHtml(svg);
                    setLoading(false);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError(e?.message || String(e));
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [chart]);

    const ready = Boolean(svgHtml) && !loading && !error;

    const handleDownloadPng = async () => {
        if (!svgHtml || downloading) return;
        setDownloading(true);
        try {
            const stamp = new Date().toISOString().slice(0, 10);
            await downloadMermaidDiagramAsPngFromSvg(svgHtml, `mermaid-diagram-${stamp}.png`);
        } catch (e) {
            setError(e?.message || 'Не удалось сохранить изображение');
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        if (!previewOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setPreviewOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [previewOpen]);

    const openPreview = () => {
        if (!ready) return;
        setPreviewOpen(true);
    };

    if (error) {
        return (
            <div className="my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <span className="font-medium">Ошибка Mermaid:</span> {error}
            </div>
        );
    }

    const previewModal =
        previewOpen &&
        ready &&
        typeof document !== 'undefined' &&
        createPortal(
            <div
                className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
                onClick={() => setPreviewOpen(false)}
                role="presentation"
            >
                <div
                    className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Диаграмма Mermaid"
                >
                    <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900">Диаграмма Mermaid</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleDownloadPng()}
                                disabled={downloading}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                            >
                                {downloading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                Скачать PNG
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                title="Закрыть"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto bg-slate-50/50 p-6">
                        <div
                            className={`mx-auto w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-6 ${mermaidSvgClass}`}
                            dangerouslySetInnerHTML={{ __html: svgHtml }}
                        />
                    </div>
                </div>
            </div>,
            document.body,
        );

    return (
        <>
            <div className="my-3 w-full max-w-full overflow-hidden rounded-lg border border-indigo-100 bg-white shadow-sm">
                {ready ? (
                    <div className="flex items-center justify-between gap-2 border-b border-indigo-50 bg-slate-50/80 px-2 py-1.5">
                        <span className="text-[11px] text-gray-500">Нажмите на диаграмму, чтобы открыть</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                void handleDownloadPng();
                            }}
                            disabled={downloading}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                            title="Скачать диаграмму как PNG"
                        >
                            {downloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Download className="w-3.5 h-3.5" />
                            )}
                            <span>{downloading ? 'Сохранение...' : 'Скачать PNG'}</span>
                        </button>
                    </div>
                ) : null}
                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Построение диаграммы...
                    </div>
                ) : (
                    <div
                        role="button"
                        tabIndex={ready ? 0 : -1}
                        onClick={openPreview}
                        onKeyDown={(e) => {
                            if (!ready) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openPreview();
                            }
                        }}
                        title={ready ? 'Открыть диаграмму' : undefined}
                        className={`overflow-x-auto p-4 transition-colors ${mermaidSvgClass} ${
                            ready ? 'cursor-zoom-in hover:bg-indigo-50/40' : ''
                        }`}
                        dangerouslySetInnerHTML={ready ? { __html: svgHtml } : undefined}
                    />
                )}
            </div>
            {previewModal}
        </>
    );
}

const isDocx = (file) => {
    const n = (file.name || '').toLowerCase();
    const m = (file.mime_type || '').toLowerCase();
    return n.endsWith('.docx') || m.includes('wordprocessingml') || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
};

/** Excel / Spreadsheet — только через внешний /parse (без URL файлы не обрабатываются) */
const isSpreadsheetForRemoteParse = (file) => {
    const n = (file.name || '').toLowerCase();
    const m = (file.mime_type || '').toLowerCase();
    if (n.endsWith('.xlsx') || n.endsWith('.xlsm') || n.endsWith('.xls')) return true;
    if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return true;
    return false;
};

/** PowerPoint — через тот же /parse */
const isPresentationForRemoteParse = (file) => {
    const n = (file.name || '').toLowerCase();
    const m = (file.mime_type || '').toLowerCase();
    if (n.endsWith('.pptx') || n.endsWith('.ppt')) return true;
    if (m.includes('presentationml') || m.includes('powerpoint')) return true;
    return false;
};

/** Сколько чанков добавлено из ответа /parse (порядок API, текст из text_as_html при наличии). */
function appendChunksFromParseResponse(textChunks, file, parsed) {
    const rawChunks = getParseChunksArray(parsed);
    let added = 0;
    rawChunks.forEach((pch, idx) => {
        const t = getChunkTextForEmbedding(pch);
        if (!t) return;
        const eid = pch.element_id != null ? String(pch.element_id) : String(idx);
        textChunks.push({
            id: `${file.id}-parse-${eid}`,
            fileId: file.id,
            fileName: file.name,
            text: t,
        });
        added += 1;
    });
    return added;
}

export function formatSize(bytes) {
    if (bytes == null) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Модель часто вставляет HTML &lt;br&gt;; react-markdown не рендерит сырой HTML — превращаем в переносы для Markdown. */
export function normalizeAssistantMarkdown(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/<br\s*\/?>/gi, '\n\n')
        .replace(/&lt;br\s*\/?&gt;/gi, '\n\n');
}

/**
 * GFM-таблица «ломается», если между строками |...| есть пустая строка или модель пишет псевдо-строки «|| ячейка | ячейка ||».
 * Убираем лишние пустые строки внутри блока строк, начинающихся с |, и превращаем ||...|| в нормальные строки таблицы.
 */
export function normalizeMarkdownTables(text) {
    if (typeof text !== 'string') return text;

    // Строка с табами вместо | — превращаем в одну строку GFM (часто модель пишет TSV)
    const tabLinesToPipe = (s) =>
        s
            .split('\n')
            .map((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('|') || trimmed.startsWith('#') || trimmed.startsWith('```')) return line;
                const tabs = (line.match(/\t/g) || []).length;
                if (tabs >= 2) {
                    const parts = line.split('\t').map((p) => p.trim());
                    if (parts.length >= 3) {
                        return `| ${parts.join(' | ')} |`;
                    }
                }
                return line;
            })
            .join('\n');

    let t = tabLinesToPipe(text);

    // «Склеенные» строки: «...| Высокая | | Demo Plan.docx (фрагмент 3) | ...» — разрыв перед новой строкой с именем файла
    t = t.replace(/\|\s+\|\s+(?=([^|\n]+\.(?:docx|txt|pdf)\b))/gi, '\n| ');

    const lines = t.split('\n');
    const merged = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const prev = merged[merged.length - 1];
        const next = lines[i + 1];
        const empty = line.trim() === '';
        const prevIsTableRow = prev !== undefined && /^\s*\|/.test(prev);
        const nextIsTableRow = next !== undefined && /^\s*\|/.test(next);
        if (empty && prevIsTableRow && nextIsTableRow) {
            continue;
        }
        merged.push(line);
    }
    t = merged.join('\n');

    const pipeRowFromDoublePipe = (s) => {
        let out = s;
        out = out.replace(
            /\s*\|\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\|/g,
            '\n| $1 | $2 | $3 | $4 |'
        );
        out = out.replace(
            /\s*\|\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\|/g,
            '\n| $1 | $2 | $3 |'
        );
        out = out.replace(/\s*\|\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\|/g, '\n| $1 | $2 |');
        return out;
    };
    t = pipeRowFromDoublePipe(t);

    return t;
}

/** Стили для Markdown + GFM-таблиц (как в ChatGPT), без плагина @tailwindcss/typography */
const ASSISTANT_MARKDOWN_COMPONENTS = {
    table: ({ children, ...props }) => (
        <div className="my-3 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100/80">
            <table
                className="w-full min-w-[min(100%,480px)] text-sm border-collapse text-left [&_tbody_tr:nth-child(even)]:bg-slate-50/80 [&_tbody_tr:nth-child(odd)]:bg-white"
                {...props}
            >
                {children}
            </table>
        </div>
    ),
    thead: ({ children, ...props }) => (
        <thead
            className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/95 shadow-sm backdrop-blur-sm"
            {...props}
        >
            {children}
        </thead>
    ),
    tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
    tr: ({ children, ...props }) => (
        <tr className="border-b border-slate-100/90 transition-colors last:border-0 hover:bg-indigo-50/35" {...props}>
            {children}
        </tr>
    ),
    th: ({ children, ...props }) => (
        <th className="px-3 py-3 font-semibold text-slate-800 align-top text-xs sm:text-sm tracking-tight" {...props}>
            {children}
        </th>
    ),
    td: ({ children, ...props }) => (
        <td className="px-3 py-2.5 text-gray-800 align-top text-xs sm:text-sm [&_p]:my-0 [&_ul]:my-1" {...props}>
            {children}
        </td>
    ),
    p: ({ children, ...props }) => (
        <p className="my-2 first:mt-0 last:mb-0 text-gray-800" {...props}>
            {children}
        </p>
    ),
    ul: ({ children, ...props }) => (
        <ul className="my-2 pl-5 list-disc space-y-1 text-gray-800" {...props}>
            {children}
        </ul>
    ),
    ol: ({ children, ...props }) => (
        <ol className="my-2 pl-5 list-decimal space-y-1 text-gray-800" {...props}>
            {children}
        </ol>
    ),
    li: ({ children, ...props }) => (
        <li className="leading-relaxed" {...props}>
            {children}
        </li>
    ),
    h1: ({ children, ...props }) => (
        <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0" {...props}>
            {children}
        </h1>
    ),
    h2: ({ children, ...props }) => (
        <h2 className="text-base font-bold text-gray-900 mt-3 mb-2 first:mt-0" {...props}>
            {children}
        </h2>
    ),
    h3: ({ children, ...props }) => (
        <h3 className="text-sm font-semibold text-gray-900 mt-2 mb-1" {...props}>
            {children}
        </h3>
    ),
    strong: ({ children, ...props }) => (
        <strong className="font-semibold text-gray-900" {...props}>
            {children}
        </strong>
    ),
    code: ({ className, children, ...props }) => {
        const isBlock = className?.includes('language-');
        if (isBlock) {
            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
        return (
            <code className="px-1 py-0.5 rounded bg-gray-100 text-indigo-900 text-[0.85em]" {...props}>
                {children}
            </code>
        );
    },
    pre: ({ children, ...props }) => {
        const first = React.Children.toArray(children)[0];
        if (
            React.isValidElement(first) &&
            typeof first.props?.className === 'string' &&
            first.props.className.includes('language-mermaid')
        ) {
            const raw = first.props.children;
            const chart = Array.isArray(raw)
                ? raw.map((c) => (typeof c === 'string' ? c : String(c ?? ''))).join('')
                : String(raw ?? '');
            return <MermaidDiagram chart={chart} />;
        }
        return (
            <pre className="my-3 p-3 rounded-lg bg-gray-900 text-gray-100 text-xs overflow-x-auto" {...props}>
                {children}
            </pre>
        );
    },
    blockquote: ({ children, ...props }) => (
        <blockquote className="my-2 pl-3 border-l-4 border-indigo-200 text-gray-600 italic" {...props}>
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-4 border-gray-200" />,
    a: ({ href, children, ...props }) => (
        <a href={href} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
            {children}
        </a>
    ),
};

function AssistantMarkdown({ children }) {
    const raw = typeof children === 'string' ? children : String(children ?? '');
    const normalized = normalizeMarkdownTables(normalizeAssistantMarkdown(raw));
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={ASSISTANT_MARKDOWN_COMPONENTS}>
            {normalized}
        </ReactMarkdown>
    );
}

function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(text, maxChars = 1500) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

/** Не отправлять бинарные файлы в эмбеддинги — там сырые байты (PK, %PDF и т.д.) превращаются в "мусор". */
function isLikelyBinary(content) {
    if (!content || content.length < 4) return false;
    const start = content.slice(0, 8);
    if (start.startsWith('PK')) return true;   // ZIP / .docx, .xlsx, .pptx
    if (start.startsWith('%PDF')) return true; // PDF
    const controlCount = [...content.slice(0, 500)].filter((c) => {
        const code = c.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
    }).length;
    return controlCount / Math.min(500, content.length) > 0.15;
}

const SUGGESTIONS = [
    { text: 'Сделай краткое резюме документа', icon: FileText },
    { text: 'Какие ключевые моменты в документе?', icon: Key },
    { text: 'Объясни основную идею простыми словами', icon: Lightbulb },
    { text: 'Найди интересные факты в тексте', icon: Search },
];

const FLASHCARD_BORDERS = ['border-red-400', 'border-teal-400', 'border-amber-400', 'border-blue-400'];

/** Превью карточки в сетке: клик открывает окно */
function FlashCardPreview({ card, index, borderClass, onClick }) {
    const title = card.title || 'Без названия';

    return (
        <button
            type="button"
            onClick={() => onClick(index)}
            className="w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
                transform: `translate(${index * 6}px, ${index * 6}px)`,
                zIndex: 20 - index,
            }}
        >
            <div
                className={`relative w-full h-44 rounded-xl border-2 ${borderClass} bg-white shadow-lg overflow-hidden flex flex-col`}
            >
                <div className="border-t-2 border-red-400 flex-shrink-0 mt-3 mx-4" />
                <div
                    className="flex-1 flex flex-col items-center justify-center p-4 min-h-0"
                    style={{
                        background: 'repeating-linear-gradient(transparent 0, transparent 20px, rgba(147,197,253,0.1) 20px, rgba(147,197,253,0.1) 21px)',
                    }}
                >
                    <div className="font-bold text-gray-800 text-center text-base leading-tight px-2 line-clamp-3">
                        {title}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">Нажмите, чтобы открыть</p>
                </div>
            </div>
        </button>
    );
}

/** Тест: правильный ответ показывается после клика; выбранный неверный вариант подсвечивается красным */
function TestView({ questions }) {
    const [revealed, setRevealed] = React.useState(new Set());
    const [clickedOption, setClickedOption] = React.useState({}); // questionIndex -> optionIndex

    const handleOptionClick = (questionIndex, optionIndex) => {
        setRevealed((prev) => new Set(prev).add(questionIndex));
        setClickedOption((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    };

    return (
        <div className="space-y-5">
            {questions.map((q, i) => {
                const isRevealed = revealed.has(i);
                const chosenOptionIndex = clickedOption[i];
                return (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="font-medium text-gray-900 mb-3 flex items-start gap-2">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold">
                                {i + 1}
                            </span>
                            <span>{q.questionText || 'Выберите правильный ответ.'}</span>
                        </div>
                        <ul className="space-y-2 ml-8">
                            {q.options.length > 0 ? (
                                q.options.map((opt, j) => {
                                    const letter = (opt.match(/^\s*([a-dа-г])[\.\)]/i) || [])[1] || '';
                                    const isCorrect = q.correct && letter.toLowerCase() === String(q.correct).toLowerCase().slice(0, 1);
                                    const showAsCorrect = isRevealed && isCorrect;
                                    const showAsWrong = isRevealed && chosenOptionIndex === j && !isCorrect;
                                    return (
                                        <li key={j}>
                                            <button
                                                type="button"
                                                onClick={() => handleOptionClick(i, j)}
                                                disabled={isRevealed}
                                                className={`w-full flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg text-left transition-colors ${
                                                    showAsCorrect
                                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                        : showAsWrong
                                                            ? 'bg-red-50 text-red-800 border border-red-200'
                                                            : isRevealed
                                                                ? 'bg-gray-50 text-gray-600 border border-gray-100'
                                                                : 'bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100 hover:border-indigo-200'
                                                } ${isRevealed ? 'cursor-default' : 'cursor-pointer'}`}
                                            >
                                                <span className="font-medium w-5">{letter.toUpperCase()})</span>
                                                <span className="flex-1">{opt.replace(/^\s*[a-dа-г][\.\)]\s*/i, '').trim()}</span>
                                                {showAsCorrect && (
                                                    <span className="text-emerald-600 text-xs font-medium">✓ Правильный ответ</span>
                                                )}
                                                {showAsWrong && (
                                                    <span className="text-red-600 text-xs font-medium">✗ Неверно</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })
                            ) : (
                                q.fallbackLines?.length > 0 ? (
                                    q.fallbackLines.map((line, j) => (
                                        <li key={j}>
                                            <button
                                                type="button"
                                                onClick={() => handleOptionClick(i, j)}
                                                disabled={isRevealed}
                                                className={`w-full text-sm py-1.5 px-3 rounded-lg text-left bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100 ${isRevealed ? 'cursor-default' : 'cursor-pointer'}`}
                                            >
                                                {line.trim()}
                                            </button>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-sm text-gray-500 italic">Варианты ответа не распознаны. Попробуйте переформулировать запрос или выберите другой формат.</li>
                                )
                            )}
                        </ul>
                        {isRevealed && q.correct && !q.options.some((o) => /^[a-dа-г][\.\)]/i.test(o) && o.toLowerCase().startsWith(q.correct.toLowerCase().slice(0, 1))) && (
                            <div className="mt-2 text-emerald-600 text-sm font-medium">Правильный ответ: {q.correct}</div>
                        )}
                        {!isRevealed && (
                            <p className="text-xs text-gray-500 mt-2 ml-8">Нажмите на любой вариант, чтобы показать правильный ответ</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Сетка карточек + модальное окно при клике */
function FlashCardsGrid({ cards }) {
    const [openIndex, setOpenIndex] = React.useState(null);
    const openCard = openIndex !== null ? cards[openIndex] : null;

    return (
        <div className="relative min-h-[12rem] pl-2 pt-2 pb-8">
            <p className="text-xs text-gray-500 mb-3">Нажмите на карточку, чтобы открыть</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {cards.map((card, i) => (
                    <FlashCardPreview
                        key={i}
                        card={card}
                        index={i}
                        borderClass={FLASHCARD_BORDERS[i % FLASHCARD_BORDERS.length]}
                        onClick={setOpenIndex}
                    />
                ))}
            </div>
            {openCard && (
                <FlashCardModal card={openCard} onClose={() => setOpenIndex(null)} />
            )}
        </div>
    );
}

/** Окно карточки: заголовок + описание, кнопка закрыть */
function FlashCardModal({ card, onClose }) {
    React.useEffect(() => {
        const handleEscape = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    if (!card) return null;
    const title = card.title || 'Без названия';
    const body = (card.body || '').trim();
    const isEmptyBody = body === '' || /^[\s\-—]+$/.test(body);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border-2 border-indigo-100"
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                        <h3 className="font-bold text-lg text-gray-900 truncate pr-4">{title}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-shrink-0 w-9 h-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            aria-label="Закрыть"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div
                        className="flex-1 overflow-auto p-5 text-sm leading-relaxed max-w-none"
                        style={{
                            background: 'repeating-linear-gradient(transparent 0, transparent 21px, rgba(147,197,253,0.08) 21px, rgba(147,197,253,0.08) 22px)',
                        }}
                    >
                        {isEmptyBody ? (
                            'Нет содержимого'
                        ) : (
                            <AssistantMarkdown>{body}</AssistantMarkdown>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

/** Разбор слайдов: разделитель `---` между слайдами или несколько блоков `## …` */
function parsePresentationSlides(markdown) {
    const raw = (markdown || '').trim();
    if (!raw) return [];
    let chunks = raw.split(/\n---\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (chunks.length <= 1) {
        const alt = raw.split(/(?=\n##\s+)/).map((s) => s.trim()).filter(Boolean);
        if (alt.length > 1) chunks = alt;
    }
    return chunks.map((body, i) => {
        let title = `Слайд ${i + 1}`;
        let rest = body;
        const m2 = body.match(/^##\s+([^\n]+)/);
        const m1 = body.match(/^#\s+([^\n]+)/);
        if (m2) {
            title = m2[1].trim();
            rest = body.slice(m2[0].length).trim();
        } else if (m1) {
            title = m1[1].trim();
            rest = body.slice(m1[0].length).trim();
        }
        return { title, body: rest || body };
    });
}

/** Фоновые темы слайдов (циклически) — разнообразие без перегруза */
const SLIDE_THEMES = [
    'from-violet-100/90 via-white to-indigo-50/95',
    'from-amber-50 via-white to-orange-50/80',
    'from-emerald-50/95 via-white to-teal-50/70',
    'from-rose-50/90 via-white to-fuchsia-50/60',
    'from-sky-50 via-white to-blue-50/85',
];

const SLIDE_BLOB_A = [
    'bg-indigo-400/25',
    'bg-amber-400/20',
    'bg-emerald-400/20',
    'bg-rose-400/20',
    'bg-sky-400/22',
];

const SLIDE_BLOB_B = [
    'bg-violet-400/20',
    'bg-orange-400/15',
    'bg-teal-400/18',
    'bg-pink-400/18',
    'bg-blue-400/18',
];

/** Кнопки экспорта графика в PPTX и таблицы в XLSX */
function ChartExportActions({ normalized }) {
    const { addToast } = useToast();
    const [busy, setBusy] = useState(false);

    const handlePptx = async () => {
        setBusy(true);
        try {
            await exportChartToPptx(normalized, `grafik-${Date.now()}.pptx`);
            addToast('Файл .pptx с графиком сохранён', 'success');
        } catch (e) {
            console.error(e);
            addToast('Не удалось создать PPTX', 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleXlsx = async () => {
        setBusy(true);
        try {
            await exportChartToXlsx(normalized, `dannye-grafika-${Date.now()}.xlsx`);
            addToast('Файл Excel сохранён', 'success');
        } catch (e) {
            console.error(e);
            addToast('Не удалось создать Excel', 'error');
        } finally {
            setBusy(false);
        }
    };

    const handlePptxToDrive = async () => {
        setBusy(true);
        try {
            const name = `grafik-${Date.now()}.pptx`;
            const blob = await buildChartPptxBlob(normalized);
            await uploadNotebookExportBlob(blob, name);
            addToast(`Файл «${name}» загружен на диск`, 'success');
        } catch (e) {
            console.error(e);
            addToast('Не удалось загрузить PPTX на диск', 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleXlsxToDrive = async () => {
        setBusy(true);
        try {
            const name = `dannye-grafika-${Date.now()}.xlsx`;
            const blob = await buildChartXlsxBlob(normalized);
            await uploadNotebookExportBlob(blob, name);
            addToast(`Файл «${name}» загружен на диск`, 'success');
        } catch (e) {
            console.error(e);
            addToast('Не удалось загрузить Excel на диск', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100/80 pt-3">
            <button
                type="button"
                onClick={handlePptx}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
                <Download className="h-3.5 w-3.5" />
                {busy ? 'Создание…' : 'Скачать .pptx'}
            </button>
            <button
                type="button"
                onClick={handlePptxToDrive}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                title="POST /drive/files — та же папка, что для импорта в блокнот"
            >
                <CloudUpload className="h-3.5 w-3.5" />
                {busy ? 'Загрузка…' : 'На диск (.pptx)'}
            </button>
            <button
                type="button"
                onClick={handleXlsx}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
                <Download className="h-3.5 w-3.5" />
                {busy ? 'Создание…' : 'Скачать .xlsx'}
            </button>
            <button
                type="button"
                onClick={handleXlsxToDrive}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50"
            >
                <CloudUpload className="h-3.5 w-3.5" />
                {busy ? 'Загрузка…' : 'На диск (.xlsx)'}
            </button>
        </div>
    );
}

/** Просмотр презентации: слайды с навигацией */
function PresentationSlidesView({ text }) {
    const { addToast } = useToast();
    const slides = useMemo(() => parsePresentationSlides(text), [text]);
    const [idx, setIdx] = useState(0);
    const [exportingPptx, setExportingPptx] = useState(false);
    const [uploadingPptxToDrive, setUploadingPptxToDrive] = useState(false);

    useEffect(() => {
        setIdx(0);
    }, [text]);

    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setIdx((i) => Math.min(Math.max(0, slides.length - 1), i + 1));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [slides.length]);

    const n = slides.length;
    if (n === 0) {
        return (
            <div className="text-sm text-gray-600 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
                Не удалось разобрать слайды. Попросите модель разделить слайды строкой <code className="text-xs bg-white px-1 rounded">---</code> и
                начинать каждый слайд с <code className="text-xs bg-white px-1 rounded">## Заголовок</code>.
            </div>
        );
    }
    const safeIdx = Math.min(Math.max(0, idx), n - 1);
    const slide = slides[safeIdx];
    const themeIdx = safeIdx % SLIDE_THEMES.length;
    const grad = SLIDE_THEMES[themeIdx];
    const blobA = SLIDE_BLOB_A[themeIdx];
    const blobB = SLIDE_BLOB_B[themeIdx];

    const slideBodyClass =
        'text-[15px] leading-relaxed text-slate-700 max-w-none [&_p]:mb-3 [&_p]:last:mb-0 [&_strong]:font-semibold [&_strong]:text-slate-900 ' +
        '[&_ul]:my-2 [&_ul]:list-none [&_ul]:space-y-2.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 ' +
        '[&_li]:relative [&_ul_li]:pl-7 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:top-[0.55em] [&_ul_li]:before:h-2 [&_ul_li]:before:w-2 [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-gradient-to-br [&_ul_li]:before:from-indigo-500 [&_ul_li]:before:to-violet-500 [&_ul_li]:before:shadow-sm ' +
        '[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900';

    return (
        <div className="space-y-4">
            <div className="relative aspect-[16/10] max-h-[min(480px,62vh)] w-full overflow-hidden rounded-3xl border border-white/70 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/40">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grad}`} />
                <div
                    className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl ${blobA}`}
                />
                <div
                    className={`pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full blur-3xl ${blobB}`}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

                <div className="relative z-10 flex h-full flex-col p-5 sm:p-7 md:p-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 pr-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500/90">
                                Презентация
                            </p>
                            <motion.h3
                                key={`t-${safeIdx}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22 }}
                                className="mt-1.5 text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl"
                            >
                                {slide.title}
                            </motion.h3>
                            <div
                                className="mt-3 h-1 w-20 rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-400 shadow-sm"
                                aria-hidden
                            />
                        </div>
                        <div className="flex-shrink-0 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-center shadow-md backdrop-blur-md">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Слайд</div>
                            <div className="text-sm font-bold tabular-nums text-slate-800">
                                {safeIdx + 1} <span className="text-slate-400">/</span> {n}
                            </div>
                        </div>
                    </div>

                    <motion.div
                        key={safeIdx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="mt-5 flex min-h-0 flex-1 flex-col"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/60 bg-white/75 p-5 shadow-inner backdrop-blur-sm sm:p-6">
                            <div className={slideBodyClass}>
                                <AssistantMarkdown>{slide.body}</AssistantMarkdown>
                            </div>
                        </div>
                    </motion.div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex justify-center gap-1.5 sm:justify-start">
                            {slides.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setIdx(i)}
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        i === safeIdx
                                            ? 'w-8 bg-gradient-to-r from-indigo-600 to-violet-500 shadow-sm'
                                            : 'w-2 bg-slate-300/90 hover:bg-slate-400'
                                    }`}
                                    aria-label={`Слайд ${i + 1}`}
                                />
                            ))}
                        </div>
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 sm:max-w-[200px] sm:flex-1"
                            title="Прогресс"
                        >
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400 transition-all duration-500 ease-out"
                                style={{ width: `${((safeIdx + 1) / n) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    disabled={safeIdx === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Предыдущий слайд"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Назад
                </button>
                <span className="text-xs font-medium tabular-nums text-slate-500">
                    {safeIdx + 1} / {n}
                </span>
                <button
                    type="button"
                    onClick={() => setIdx((i) => Math.min(n - 1, i + 1))}
                    disabled={safeIdx >= n - 1}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Следующий слайд"
                >
                    Далее
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
            <p className="text-center text-[11px] text-slate-400">← → на клавиатуре · точки — быстрый переход</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                    type="button"
                    onClick={async () => {
                        if (!slides.length) return;
                        setExportingPptx(true);
                        try {
                            const safeTitle = (slides[0]?.title || 'prezentatsiya')
                                .slice(0, 40)
                                .replace(/[/\\?%*:|"<>]/g, '-');
                            await exportPresentationToPptx(slides, `${safeTitle}-${Date.now()}.pptx`);
                            addToast('Файл .pptx скачан', 'success');
                        } catch (e) {
                            console.error(e);
                            addToast('Не удалось создать презентацию', 'error');
                        } finally {
                            setExportingPptx(false);
                        }
                    }}
                    disabled={exportingPptx || uploadingPptxToDrive}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 shadow-sm hover:bg-indigo-100 disabled:opacity-50"
                >
                    <Download className="h-3.5 w-3.5" />
                    {exportingPptx ? 'Создание…' : 'Скачать все слайды (.pptx)'}
                </button>
                <button
                    type="button"
                    onClick={async () => {
                        if (!slides.length) return;
                        setUploadingPptxToDrive(true);
                        try {
                            const safeTitle = (slides[0]?.title || 'prezentatsiya')
                                .slice(0, 40)
                                .replace(/[/\\?%*:|"<>]/g, '-');
                            const fname = `${safeTitle}-${Date.now()}.pptx`;
                            const blob = await buildPresentationPptxBlob(slides, fname);
                            await uploadNotebookExportBlob(blob, fname);
                            addToast(`Презентация «${fname}» загружена на диск`, 'success');
                        } catch (e) {
                            console.error(e);
                            addToast('Не удалось загрузить презентацию на диск', 'error');
                        } finally {
                            setUploadingPptxToDrive(false);
                        }
                    }}
                    disabled={exportingPptx || uploadingPptxToDrive}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 shadow-sm hover:bg-violet-100 disabled:opacity-50"
                    title="POST /drive/files — папка как в импорте блокнота"
                >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {uploadingPptxToDrive ? 'Загрузка…' : 'На диск (.pptx)'}
                </button>
            </div>
        </div>
    );
}

const CHART_PALETTE = ['#6366f1', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#22c55e'];

function parseChartSpecFromText(raw) {
    const t = (raw || '').trim();
    if (!t) return null;
    const block = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = block ? block[1].trim() : t;
    try {
        const obj = JSON.parse(jsonStr);
        return obj && typeof obj === 'object' ? obj : null;
    } catch {
        return null;
    }
}

/** Нормализует ответ модели в spec для Recharts */
function normalizeChartSpec(spec) {
    if (!spec || typeof spec !== 'object') return null;
    const kindRaw = spec.kind || spec.chart || spec.type;
    const kind = String(kindRaw || 'bar').toLowerCase();
    const data = Array.isArray(spec.data) ? spec.data : null;
    if (!data || data.length === 0) return null;

    if (kind === 'pie') {
        const nameKey = spec.nameKey || 'name';
        const valueKey = spec.valueKey || 'value';
        return { kind: 'pie', title: spec.title, data, nameKey, valueKey };
    }

    if (kind !== 'bar' && kind !== 'line') return null;

    const xKey = spec.xKey || spec.categoryKey || 'name';
    const series =
        Array.isArray(spec.series) && spec.series.length > 0
            ? spec.series.map((s, i) => ({
                  key: s.key,
                  name: s.name || s.key,
                  color: s.color || CHART_PALETTE[i % CHART_PALETTE.length],
              }))
            : [{ key: spec.valueKey || 'value', name: spec.yLabel || 'Значение', color: CHART_PALETTE[0] }];

    if (!series.every((s) => s.key)) return null;

    return { kind, title: spec.title, data, xKey, series };
}

/** true, если текст — валидная спека графика (в т.ч. в ```json), даже без assistant_type с бэкенда */
function isLikelyChartJsonContent(text) {
    if (!text || typeof text !== 'string') return false;
    const spec = parseChartSpecFromText(text);
    if (!spec) return false;
    if (isEmptyChartDataSpec(spec)) return true;
    return normalizeChartSpec(spec) != null;
}

/** Нормализация типа ответа из API (регистр, алиасы, лишние поля) */
function normalizeNotebookMessageFormat(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().toLowerCase();
    const aliases = {
        graph: 'chart',
        diagram: 'chart',
        barchart: 'chart',
        bar_chart: 'chart',
        linechart: 'chart',
        piechart: 'chart',
    };
    const mapped = aliases[s] || s;
    const allowed = new Set(['cards', 'test', 'table', 'report', 'presentation', 'chart', 'mermaid', 'text']);
    if (!allowed.has(mapped)) return null;
    return mapped === 'text' ? null : mapped;
}

/**
 * Формат отрисовки ответа ассистента: учитывает сохранённый format и подстраховку по JSON графика
 * (если бэкенд не вернул assistant_type при загрузке истории).
 */
function getAssistantMessageFormat(msg) {
    if (msg.role !== 'assistant') return null;
    const explicit = msg.format;
    const explicitUseful = explicit && explicit !== 'text';
    if (explicitUseful) return explicit;
    if (isLikelyChartJsonContent(msg.content)) return 'chart';
    return null;
}

/** Валидный объект графика, но без строк в data — не ошибка формата */
function isEmptyChartDataSpec(spec) {
    if (!spec || typeof spec !== 'object') return false;
    const kind = spec.kind || spec.chart || spec.type;
    if (!kind) return false;
    const data = spec.data;
    return Array.isArray(data) && data.length === 0;
}

/** График по JSON (bar / line / pie) */
function ChartResponseView({ text }) {
    const spec = useMemo(() => parseChartSpecFromText(text), [text]);
    const normalized = useMemo(() => normalizeChartSpec(spec), [spec]);

    const fallbackMd = (
        <div className="text-sm text-gray-700 max-w-none">
            <AssistantMarkdown>{normalizeMarkdownTables(normalizeAssistantMarkdown(text))}</AssistantMarkdown>
        </div>
    );

    if (!normalized) {
        if (isEmptyChartDataSpec(spec)) {
            const title =
                typeof spec.title === 'string' && spec.title.trim()
                    ? spec.title.trim()
                    : 'Недостаточно данных для построения графика.';
            return (
                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                        <p className="text-sm font-medium text-slate-900">{title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                            В источниках не нашлось числовых рядов для оси и значений. Пожалуйста, добавьте в документы таблицу или список с числами (например, «Январь: 10, Февраль: 20») и повторите запрос.
                        </p>
                    </div>
                    <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer select-none text-slate-600 hover:text-slate-800">
                            Показать ответ модели
                        </summary>
                        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-950/95 p-3 font-mono text-[11px] text-slate-200">
                            <AssistantMarkdown>{normalizeMarkdownTables(normalizeAssistantMarkdown(text))}</AssistantMarkdown>
                        </div>
                    </details>
                </div>
            );
        }
        return (
            <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 leading-relaxed">
                    <strong>Не удалось построить график.</strong> ИИ не обнаружил в документах данных, пригодных для визуализации.
                    Пожалуйста, убедитесь, что в источниках есть числовые данные (например, таблица или список вида «Январь: 10, Февраль: 20»), и повторите запрос.
                </div>
                {fallbackMd}
            </div>
        );
    }

    const tooltipStyle = {
        borderRadius: '12px',
        border: '1px solid rgb(226 232 240)',
        fontSize: '12px',
    };

    if (normalized.kind === 'pie') {
        const { data, nameKey, valueKey, title } = normalized;
        return (
            <div className="space-y-0">
                <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-md ring-1 ring-slate-100">
                    {title ? <h4 className="mb-3 text-center text-sm font-semibold tracking-tight text-slate-900">{title}</h4> : null}
                    <div className="h-[min(300px,40vh)] w-full min-w-0" style={{ minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey={valueKey}
                                    nameKey={nameKey}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    paddingAngle={2}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {data.map((_, i) => (
                                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke="#fff" strokeWidth={1} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <ChartExportActions normalized={normalized} />
            </div>
        );
    }

    const { kind, title, data, xKey, series } = normalized;
    const ChartComp = kind === 'line' ? LineChart : BarChart;

    return (
        <div className="space-y-0">
            <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-md ring-1 ring-slate-100">
                {title ? <h4 className="mb-3 text-center text-sm font-semibold tracking-tight text-slate-900">{title}</h4> : null}
                <div className="h-[min(300px,40vh)] w-full min-w-0" style={{ minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <ChartComp data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} width={40} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {series.map((s) =>
                                kind === 'line' ? (
                                    <Line
                                        key={s.key}
                                        type="monotone"
                                        dataKey={s.key}
                                        name={s.name}
                                        stroke={s.color}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                ) : (
                                    <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={48} />
                                )
                            )}
                        </ChartComp>
                    </ResponsiveContainer>
                </div>
            </div>
            <ChartExportActions normalized={normalized} />
        </div>
    );
}

/** Красивый рендер ответа по формату: карточки, тест, таблица, отчёт, Mermaid */
function FormattedMessage({ content, format }) {
    if (!content || typeof content !== 'string') return <span>{String(content)}</span>;
    const text = normalizeMarkdownTables(normalizeAssistantMarkdown(content));

    // Диаграммы Mermaid: markdown с блоками ```mermaid (рендер в AssistantMarkdown)
    if (format === 'mermaid') {
        return (
            <div className="text-sm text-gray-800 leading-relaxed max-w-none">
                <AssistantMarkdown>{text}</AssistantMarkdown>
            </div>
        );
    }

    if (format === 'presentation') {
        return <PresentationSlidesView text={text} />;
    }

    if (format === 'chart') {
        return <ChartResponseView text={text} />;
    }

    // Карточки: клик открывает карточку в модальном окне
    if (format === 'cards') {
        const blocks = text.split(/\n\n+/).filter(Boolean);
        const cards = blocks.map((block) => {
            const trimmed = block.trim();
            const m = trimmed.match(/^\s*\*\*([^*]+)\*\*\s*[—\-]?\s*\n?(.*)$/s);
            let title;
            let body;
            if (m) {
                title = m[1].trim();
                body = m[2].trim();
            } else {
                // Нет **Заголовок** — берём первую строку как заголовок, остальное как описание
                const firstNewline = trimmed.indexOf('\n');
                if (firstNewline === -1) {
                    title = trimmed || null;
                    body = '';
                } else {
                    title = trimmed.slice(0, firstNewline).trim() || null;
                    body = trimmed.slice(firstNewline + 1).trim();
                }
            }
            // Пустое тело (только дефисы/пробелы) не показываем как "---"
            if (/^[\s\-—]+$/.test(body)) body = '';
            // Заголовок из одних дефисов/пробелов считаем пустым
            if (title !== null && /^[\s\-—]+$/.test(title)) title = null;
            return { title, body };
        });
        return <FlashCardsGrid cards={cards} />;
    }

    // Тест: правильный ответ показывается только после клика по варианту
    if (format === 'test') {
        const optionRegex = /^\s*[a-dа-г]\s*[\.\)]\s*/i;
        // Поддержка форматов: "1. текст", "**Вопрос 1:** текст", "Вопрос 1: текст"
        const partsByNum = text.split(/(?=\d+\.\s)/).filter((p) => /^\d+\.\s/.test(p.trim()));
        const partsByBold = text.split(/(?=\*\*Вопрос\s+\d+\*\*:?\s*)/i).filter((p) => {
            const t = p.trim();
            return t.length > 0 && /^\*\*Вопрос\s+\d+\*\*:?\s*/i.test(t);
        });
        const partsByPlain = text.split(/(?=Вопрос\s+\d+\s*:?\s*)/i).filter((p) => {
            const t = p.trim();
            return t.length > 0 && /^Вопрос\s+\d+\s*:?\s*/i.test(t);
        });
        let parts = partsByBold.length >= partsByNum.length ? partsByBold : partsByNum;
        if (partsByPlain.length > parts.length) parts = partsByPlain;

        const extractCorrectAnswer = (text) => {
            if (!text || typeof text !== 'string') return null;
            // Явная буква после двоеточия (в т.ч. **A**, «A», A.)
            const direct = text.match(
                /(?:\*\*)?Правильный ответ(?:\*\*)?\s*:\s*(?:\*\*)?([A-Da-dа-г])(?:\*\*)?/i
            );
            if (direct?.[1]) return direct[1].toLowerCase();
            // Строка «Правильный ответ: …» — берём хвост и вытаскиваем первую букву a–d / а–г
            const tail = text.match(/Правильный ответ\s*:\s*(.+)$/im);
            if (tail?.[1]) {
                const cleaned = tail[1].replace(/\*\*/g, '').trim();
                const letter = cleaned.match(/([a-dа-г])/i);
                if (letter) return letter[1].toLowerCase();
            }
            return null;
        };

        const questions = parts.map((part) => {
            const rawLines = part.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
            const lines = rawLines.filter((l) => !/Правильный ответ\s*:\s*/i.test(l));
            const correct = extractCorrectAnswer(part);

            const first = lines[0] || '';
            let questionText = '';
            let optionLines = [];

            const boldHeaderMatch = first.match(/^\*\*Вопрос\s+\d+\*\*:?\s*(.*)$/i);
            const plainHeaderMatch = first.match(/^Вопрос\s+\d+\s*:?\s*(.*)$/i);
            if (boldHeaderMatch) {
                questionText = boldHeaderMatch[1].trim();
                const rest = lines.slice(1);
                const optionStart = rest.findIndex((l) => optionRegex.test(l));
                if (optionStart >= 0) {
                    const questionRest = rest.slice(0, optionStart).filter((l) => !optionRegex.test(l));
                    if (questionRest.length) questionText += ' ' + questionRest.join(' ').trim();
                    optionLines = rest.slice(optionStart);
                } else {
                    optionLines = rest;
                }
            } else if (plainHeaderMatch) {
                questionText = plainHeaderMatch[1].trim();
                const rest = lines.slice(1);
                const optionStart = rest.findIndex((l) => optionRegex.test(l));
                if (optionStart >= 0) {
                    const questionRest = rest.slice(0, optionStart).filter((l) => !optionRegex.test(l));
                    if (questionRest.length) questionText += ' ' + questionRest.join(' ').trim();
                    optionLines = rest.slice(optionStart);
                } else {
                    optionLines = rest;
                }
            } else {
                const numMatch = first.match(/^(\d+)\.\s*(.*)$/);
                questionText = numMatch ? numMatch[2].trim() : first.trim();
                optionLines = lines.slice(1).filter((l) => !/Правильный ответ\s*:\s*/i.test(l));
                if (questionText && optionRegex.test(questionText)) {
                    optionLines = [questionText, ...optionLines];
                    questionText = '';
                }
            }

            const options = optionLines.filter((l) => optionRegex.test(l));
            const fallbackLines = options.length === 0 ? optionLines : [];
            return { questionText, options, correct, fallbackLines };
        });
        const hasVisibleQuestions = questions.some((q) => q.options.length > 0 || q.fallbackLines?.length > 0);
        if (questions.length === 0 || !hasVisibleQuestions) {
            return (
                <div className="text-sm text-gray-800 max-w-none">
                    <AssistantMarkdown>{text}</AssistantMarkdown>
                </div>
            );
        }
        return <TestView questions={questions} />;
    }

    // Таблица: markdown | A | B |
    if (format === 'table') {
        const lines = text.split(/\n/).filter((l) => l.includes('|'));
        const rows = lines.map((l) => l.split(/\|/).map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1));
        const head = rows[0] || [];
        const body = rows.slice(1).filter((r) => r.length && !r.every((c) => /^-+$/.test((c || '').trim())));
        if (head.length > 0) {
            return (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100/80">
                    <table className="w-full text-sm text-left border-collapse [&_tbody_tr:nth-child(even)]:bg-slate-50/80 [&_tbody_tr:nth-child(odd)]:bg-white">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/95 shadow-sm">
                            <tr>
                                {head.map((h, i) => (
                                    <th
                                        key={i}
                                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-800 sm:text-sm"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {body.map((row, i) => (
                                <tr
                                    key={i}
                                    className="border-b border-slate-100/90 transition-colors hover:bg-indigo-50/35 last:border-0"
                                >
                                    {head.map((_, j) => (
                                        <td key={j} className="px-4 py-3 text-slate-800">
                                            {row[j] ?? ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    // Отчёт / по умолчанию: полный markdown (жирный, списки, заголовки, GFM-таблицы)
    return (
        <div className="text-sm text-gray-800 leading-relaxed max-w-none">
            <AssistantMarkdown>{text}</AssistantMarkdown>
        </div>
    );
}

const GENERATION_FORMATS = [
    {
        id: 'cards',
        label: 'Карточки',
        icon: Layers,
        instruction:
            'Ответь в виде набора карточек. Каждая карточка: краткий заголовок и 1–2 предложения. Разделяй карточки пустой строкой. Используй формат: **Заголовок** — описание.',
    },
    {
        id: 'test',
        label: 'Тест',
        icon: ClipboardList,
        instruction:
            'Ответь в виде теста: несколько вопросов по содержимому. Для каждого вопроса: текст вопроса, варианты ответа (a, b, c, d), отдельной строкой в конце вопроса: «Правильный ответ: A» (одна латинская буква A–D без markdown вокруг буквы).',
    },
    {
        id: 'table',
        label: 'Таблица',
        icon: Table2,
        instruction:
            'Только GFM-таблица Markdown. Первая строка — заголовки колонок со смысловыми названиями на русском (например: «Документ», «Релевантность», «Фрагмент» или под задачу пользователя). Не используй буквы A, B, C как заголовки — это был лишь пример структуры. Затем строка-разделитель | --- | --- | --- | (по числу колонок), затем строки данных. Каждая строка — с | в начале и конце. Без списков внутри таблицы; без пустых строк между строками таблицы. При необходимости после таблицы — краткий вывод текстом.',
    },
    {
        id: 'report',
        label: 'Отчёт',
        icon: FileBarChart,
        instruction:
            'Ответь кратким отчётом: разделы **Цель**, **Основные пункты**, **Выводы**. Для сравнения документов или сводок по файлам используй GFM-таблицу (| заголовок | … |, строка |---|---|, строки данных). Опирайся только на контекст документов.',
    },
    {
        id: 'presentation',
        label: 'Презентация',
        icon: Presentation,
        instruction:
            'Составь презентацию по материалу документов. Каждый слайд — отдельный блок: первая строка слайда — заголовок в виде ## Краткий заголовок, затем 2–5 тезисов маркированным списком или короткий абзац. Слайды строго разделяй одной строкой из трёх дефисов --- на отдельной строке (между слайдами). Не вставляй строку --- внутри слайда. Обычно 5–12 слайдов. Первый слайд может быть титульным (тема). Без HTML, только Markdown.',
    },
    {
        id: 'chart',
        label: 'График',
        icon: BarChart2,
        instruction:
            'Верни ТОЛЬКО один блок кода ```json (без текста до и после), с валидным JSON для графика по данным из документов. Схема: { "title": "краткий заголовок", "kind": "bar" | "line" | "pie", "data": [ ... ] }. Для bar/line: "xKey" — имя поля категории на оси X (например "name"), "series": [ { "key": "поле_числа", "name": "Подпись в легенде" } ] — одна или несколько серий; каждая строка в data содержит xKey и ключи из series. Для pie: "nameKey": "name", "valueKey": "value", data: [ { "name": "…", "value": число } ]. Числа — реальные из контекста или агрегированные; если точных чисел нет — оцени и подпиши в title что это оценка.',
    },
    {
        id: 'mermaid',
        label: 'Диаграмма Mermaid',
        icon: Workflow,
        instruction:
            'Дай краткое пояснение и одну или несколько диаграмм в блоках кода с языком mermaid: ```mermaid ... ```. Используй подходящий синтаксис: graph TD/LR, flowchart, sequenceDiagram, stateDiagram и т.д. по смыслу вопроса и контекста документов. ВАЖНО: любые текстовые значения узлов (особенно с пробелами, слэшами / или кириллицей) обязательно заключай в двойные кавычки, например: A["Текст блока / API"]. Без лишнего текста вне диаграммы, кроме короткого вступления или итога при необходимости.',
    },
];

function readStoredGenerationFormat() {
    if (typeof window === 'undefined') return null;
    const ids = new Set(GENERATION_FORMATS.map((f) => f.id));
    const raw = window.localStorage.getItem('notebook_generation_format');
    return raw && ids.has(raw) ? raw : null;
}

/** Пастельные подложки для карточек «Студии» (светлая тема, стиль NotebookLM). */
const STUDIO_CARD_THEMES = [
    'bg-gradient-to-br from-amber-50 to-orange-50/90 border-amber-100/90',
    'bg-gradient-to-br from-violet-50 to-fuchsia-50/90 border-violet-100/90',
    'bg-gradient-to-br from-sky-50 to-cyan-50/90 border-sky-100/90',
    'bg-gradient-to-br from-emerald-50 to-teal-50/90 border-emerald-100/90',
    'bg-gradient-to-br from-rose-50 to-pink-50/90 border-rose-100/90',
    'bg-gradient-to-br from-indigo-50 to-blue-50/90 border-indigo-100/90',
    'bg-gradient-to-br from-cyan-50 to-sky-50/90 border-cyan-100/90',
];

function sourcesCountLabel(n) {
    const x = Math.abs(n) % 100;
    const x1 = x % 10;
    if (x > 10 && x < 20) return 'источников';
    if (x1 === 1) return 'источник';
    if (x1 >= 2 && x1 <= 4) return 'источника';
    return 'источников';
}

/** Встраиваемый блок чата Deep Research Assistant. embedded=true — режим страницы (без overlay, без кнопки закрыть, загрузка док. при смене files). */
const NotebookLlmContent = ({
    files = [],
    embedded = false,
    onClose = null,
    isOpen = true,
    activeChatId = null,
    chats = [],
    onCreateChat = null,
    onSelectChat = () => {},
    creatingChat = false,
    chatSearchQuery = '',
    onChatSearchChange = () => {},
    onImportNotebookFile = null,
    notebookImportBusy = false,
    onBack = null,
}) => {
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [docChunks, setDocChunks] = useState([]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [docDropdownOpen, setDocDropdownOpen] = useState(false);
    const [docSearch, setDocSearch] = useState('');
    // По умолчанию документы НЕ выбраны — embeddings считаем только после явного выбора
    const [activeFileIds, setActiveFileIds] = useState(() => new Set());
    const [chatId, setChatId] = useState(null);
    const [generationFormat, setGenerationFormatState] = useState(() => readStoredGenerationFormat()); // 'cards' | 'test' | ...
    const setGenerationFormat = useCallback((value) => {
        setGenerationFormatState(value);
        if (typeof window !== 'undefined') {
            if (value == null) {
                window.localStorage.removeItem('notebook_generation_format');
            } else {
                window.localStorage.setItem('notebook_generation_format', value);
            }
        }
    }, []);
    const [chatModelMode, setChatModelMode] = useState(() => {
        if (typeof window === 'undefined') return 'thinking';
        const s = window.localStorage.getItem('notebook_chat_model_mode');
        return s === 'fast' ? 'fast' : 'thinking';
    });
    const { addToast } = useToast();
    const messagesScrollRef = useRef(null);
    const notebookImportInputRef = useRef(null);
    const copyFeedbackTimeoutRef = useRef(null);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const navigate = useNavigate();
    const [sourcesOpen, setSourcesOpen] = useState(true);
    const [studioOpen, setStudioOpen] = useState(true);

    const chatSearchLower = (chatSearchQuery || '').trim().toLowerCase();
    const visibleChats = useMemo(() => {
        if (!chatSearchLower) return chats;
        return chats.filter((c) => (c.title || c.name || '').toLowerCase().includes(chatSearchLower));
    }, [chats, chatSearchLower]);

    const filteredFiles = useMemo(
        () => (files || []).filter((f) => (f.name || '').toLowerCase().includes(docSearch.trim().toLowerCase())),
        [files, docSearch]
    );

    const copyAssistantText = useCallback(
        async (text, idx) => {
            const plain = typeof text === 'string' ? text : String(text ?? '');
            try {
                await navigator.clipboard.writeText(plain);
                if (copyFeedbackTimeoutRef.current) {
                    clearTimeout(copyFeedbackTimeoutRef.current);
                }
                setCopiedIndex(idx);
                addToast('Ответ скопирован', 'success');
                copyFeedbackTimeoutRef.current = window.setTimeout(() => {
                    setCopiedIndex(null);
                    copyFeedbackTimeoutRef.current = null;
                }, 2000);
            } catch {
                addToast('Не удалось скопировать', 'error');
            }
        },
        [addToast]
    );

    // Прокрутка к последнему сообщению после ответа ИИ (и после длинных таблиц в DOM)
    useEffect(() => {
        if (messages.length === 0) return;
        const el = messagesScrollRef.current;
        if (!el) return;
        const scrollToBottom = () => {
            el.scrollTop = el.scrollHeight;
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(scrollToBottom);
        });
        const t = setTimeout(scrollToBottom, 100);
        const t2 = setTimeout(scrollToBottom, 400);
        return () => {
            clearTimeout(t);
            clearTimeout(t2);
        };
    }, [messages, sending]);

    const currentFile = files?.length ? files[currentFileIndex] : null;
    const fileModifiedLabel = currentFile
        ? (() => {
            const d = currentFile.last_modified || currentFile.updated_at || currentFile.created_at;
            if (!d) return '';
            try {
                return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ru });
            } catch {
                return '';
            }
        })()
        : '';

    // Сброс / синхронизация выбора при смене списка файлов
    useEffect(() => {
        if (!files || files.length === 0) {
            setActiveFileIds(new Set());
            setCurrentFileIndex(0);
            return;
        }
        // Если какие‑то файлы уже были выбраны — оставляем только существующие в новом списке
        setActiveFileIds((prev) => {
            if (!prev || prev.size === 0) return new Set();
            const next = new Set();
            const ids = new Set(files.map((f) => f.id));
            prev.forEach((id) => {
                if (ids.has(id)) next.add(id);
            });
            return next;
        });
        setCurrentFileIndex(0);
    }, [files]);

    const loadDocuments = useCallback(
        async (driveFiles) => {
            setLoadingDocs(true);
            try {
                const textChunks = [];
                const parseConfigured = isDocumentParseConfigured();
                let parseUnavailableWarned = false;
                let skippedBinary = 0;
                for (const file of driveFiles) {
                    try {
                        const url = getDownloadUrl(file.id);
                        const res = await fetch(url);
                        if (!res.ok) {
                            addToast(`Не удалось скачать файл "${file.name}" (HTTP ${res.status})`, 'error');
                            continue;
                        }

                        if (isSpreadsheetForRemoteParse(file)) {
                            if (!parseConfigured) {
                                skippedBinary += 1;
                                if (!parseUnavailableWarned) {
                                    parseUnavailableWarned = true;
                                    addToast('Разбор DOCX/XLSX/PPTX недоступен: не настроен document-parse endpoint для текущего окружения.', 'warning');
                                }
                                continue;
                            }
                            const buf = await res.arrayBuffer();
                            const blob = new Blob([buf], {
                                type:
                                    file.mime_type ||
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            });
                            const parsed = await parseDocumentFile(blob, file.name);
                            const addedFromParse = appendChunksFromParseResponse(textChunks, file, parsed);
                            if (addedFromParse === 0) {
                                addToast(`Разбор "${file.name}" не дал фрагментов с text / text_as_html.`, 'warning');
                            }
                            continue;
                        }

                        /* .docx — тот же /parse, что и для Excel */
                        if (isDocx(file)) {
                            if (!parseConfigured) {
                                skippedBinary += 1;
                                if (!parseUnavailableWarned) {
                                    parseUnavailableWarned = true;
                                    addToast('Разбор DOCX/XLSX/PPTX недоступен: не настроен document-parse endpoint для текущего окружения.', 'warning');
                                }
                                continue;
                            }
                            const buf = await res.arrayBuffer();
                            const blob = new Blob([buf], {
                                type:
                                    file.mime_type ||
                                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            });
                            const parsed = await parseDocumentFile(blob, file.name);
                            const addedFromParse = appendChunksFromParseResponse(textChunks, file, parsed);
                            if (addedFromParse === 0) {
                                addToast(`Разбор "${file.name}" не дал фрагментов с text / text_as_html.`, 'warning');
                            }
                            continue;
                        }

                        if (isPresentationForRemoteParse(file)) {
                            if (!parseConfigured) {
                                skippedBinary += 1;
                                if (!parseUnavailableWarned) {
                                    parseUnavailableWarned = true;
                                    addToast('Разбор DOCX/XLSX/PPTX недоступен: не настроен document-parse endpoint для текущего окружения.', 'warning');
                                }
                                continue;
                            }
                            const buf = await res.arrayBuffer();
                            const blob = new Blob([buf], {
                                type:
                                    file.mime_type ||
                                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                            });
                            const parsed = await parseDocumentFile(blob, file.name);
                            const addedFromParse = appendChunksFromParseResponse(textChunks, file, parsed);
                            if (addedFromParse === 0) {
                                addToast(`Разбор "${file.name}" не дал фрагментов с text / text_as_html.`, 'warning');
                            }
                            continue;
                        }

                        const content = await res.text();
                        if (!content || !content.trim()) {
                            textChunks.push({
                                id: `${file.id}-empty`,
                                fileId: file.id,
                                fileName: file.name,
                                text: '[Пустой файл: нет содержимого]',
                            });
                            continue;
                        }
                        if (!isDocx(file) && isLikelyBinary(content)) {
                            skippedBinary += 1;
                            continue;
                        }
                        const chunks = chunkText(content);
                        chunks.forEach((chunkTextValue, idx) => {
                            textChunks.push({
                                id: `${file.id}-${idx}`,
                                fileId: file.id,
                                fileName: file.name,
                                text: chunkTextValue,
                            });
                        });
                    } catch (err) {
                        console.error('Failed to load file for Deep Research Assistant', file, err);
                        addToast(`Ошибка чтения файла "${file.name}"`, 'error');
                    }
                }
                if (textChunks.length === 0) {
                    if (skippedBinary > 0 && skippedBinary === driveFiles.length) {
                        addToast('Не удалось извлечь текст из выбранных файлов.', 'warning');
                    } else {
                        addToast('Не удалось подготовить содержимое документов (нет текста или возникли ошибки скачивания)', 'warning');
                    }
                    setDocChunks([]);
                    return;
                }
                const embeddingVectors = await createEmbeddingsBatched(textChunks.map((c) => c.text));
                const enriched = textChunks.map((chunk, idx) => ({
                    ...chunk,
                    embedding: embeddingVectors[idx] || [],
                }));
                setDocChunks(enriched);
                addToast(`Загружено ${enriched.length} текстовых фрагментов из документов`, 'success');
            } catch (err) {
                console.error('Failed to load documents for Deep Research Assistant', err);
                addToast('Ошибка при подготовке документов для Deep Research Assistant', 'error');
            } finally {
                setLoadingDocs(false);
            }
        },
        [addToast]
    );

    // Загрузка сообщений и документов выбранного чата при смене activeChatId
    useEffect(() => {
        if (!activeChatId) return;

        const loadChatData = async () => {
            try {
                setChatId(activeChatId);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem('notebook_chat_id', activeChatId);
                }

                const [messagesData, documentsData] = await Promise.all([
                    getNotebookChatMessages(activeChatId),
                    getChatDocuments(activeChatId).catch((e) => {
                        console.warn('getChatDocuments failed', e);
                        return null;
                    }),
                ]);

                const rawMessages = Array.isArray(messagesData?.data)
                    ? messagesData.data
                    : Array.isArray(messagesData?.messages)
                        ? messagesData.messages
                        : Array.isArray(messagesData)
                            ? messagesData
                            : [];

                if (rawMessages.length > 0) {
                    const normalized = rawMessages.map((m) => {
                        const role = m.role || (m.sender === 'user' || m.is_user ? 'user' : 'assistant');
                        const content = m.content || m.text || m.message || '';
                        const rawFormat =
                            m.assistant_type ?? m.format ?? m.type ?? m.message_type ?? m.response_type;
                        let format = normalizeNotebookMessageFormat(rawFormat);
                        if (role === 'assistant' && !format && isLikelyChartJsonContent(content)) {
                            format = 'chart';
                        }
                        return { role, content, format };
                    });
                    setMessages(normalized);
                } else {
                    setMessages([]);
                }

                if (documentsData != null) {
                    let docList = [];
                    if (Array.isArray(documentsData)) docList = documentsData;
                    else if (documentsData?.data && Array.isArray(documentsData.data)) docList = documentsData.data;
                    else if (documentsData?.documents && Array.isArray(documentsData.documents)) docList = documentsData.documents;
                    const fileIds = new Set((files || []).map((f) => f.id));
                    const docIds = new Set(
                        docList
                            .map((d) => (typeof d === 'string' ? d : d.id || d.file_id || d.document_id))
                            .filter((id) => id && fileIds.has(id))
                    );
                    setActiveFileIds(docIds);
                    if (docIds.size > 0 && files?.length > 0) {
                        const firstInContextIdx = files.findIndex((f) => docIds.has(f.id));
                        if (firstInContextIdx >= 0) setCurrentFileIndex(firstInContextIdx);
                    }
                }
            } catch (err) {
                console.error('Failed to load chat data', err);
            }
        };

        loadChatData();
    }, [activeChatId]);

    // Режим страницы: при смене выбранных документов слева или набора активных файлов — перезагружаем контекст
    useEffect(() => {
        if (!embedded || !files?.length) return;

        const selectedFiles = files.filter((f) => activeFileIds.has(f.id));
        if (selectedFiles.length > 0) {
            loadDocuments(selectedFiles);
        } else {
            // Нет выбранных документов — ничего не грузим и контекст очищаем
            setDocChunks([]);
        }
    }, [embedded, files, activeFileIds, loadDocuments]);

    // Режим модалки: при открытии — сброс и загрузка
    useEffect(() => {
        if (!embedded && isOpen) {
            setMessages([]);
            setInput('');
            setDocChunks([]);
            setCurrentFileIndex(0);
            setDocDropdownOpen(false);
            if (files?.length) {
                const selectedFiles = files.filter((f) => activeFileIds.has(f.id));
                if (selectedFiles.length > 0) {
                    loadDocuments(selectedFiles);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [embedded, isOpen]);

    const handleNewChat = () => {
        setMessages([]);
        setInput('');
        setGenerationFormat(null);
    };

    const requireActiveChat = useCallback(() => {
        const effectiveChatId = chatId || activeChatId;
        if (effectiveChatId) {
            return effectiveChatId;
        }

        addToast('Сначала создайте блокнот, затем добавляйте документы в контекст.', 'warning');
        onCreateChat?.();
        return null;
    }, [chatId, activeChatId, addToast, onCreateChat]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const effectiveChatId = requireActiveChat();
        if (!effectiveChatId) return;
        if (!getCurrentLlmApiKey()) {
            addToast('Укажите API ключ LLM перед использованием Deep Research Assistant', 'error');
            return;
        }
        const question = input.trim();
        setMessages((prev) => [...prev, { role: 'user', content: question }]);
        setInput('');
        setSending(true);
        try {
            let context = '';
            if (docChunks.length > 0) {
                const embResp = await createEmbeddings([question]);
                const queryEmb = (embResp.data?.[0]?.embedding || embResp.embeddings?.[0]?.embedding || embResp[0]) || [];
                const scored = docChunks
                    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmb, chunk.embedding) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5);
                context = scored
                    .map((c) => `Документ: ${c.fileName}\nФрагмент (score=${c.score.toFixed(3)}):\n${c.text}`)
                    .join('\n\n---\n\n');
            }
            // Под капотом подставляем системный промпт по формату (тест, таблица и т.д.)
            const formatPromptPrefix = {
                test: 'Сделай тест. ',
                table: 'Сделай таблицу. ',
                cards: 'Сделай карточки. ',
                report: 'Сделай отчёт. ',
                presentation: 'Сделай презентацию. ',
                chart: 'Построй график по данным (JSON для диаграммы). ',
                mermaid: 'Сделай диаграмму Mermaid. ',
            }[generationFormat] || '';
            const promptQuestion = formatPromptPrefix + question;

            const userContent = context
                ? `Контекст из документов Alem Drive:\n\n${context}\n\nВопрос: ${promptQuestion}`
                : `Вопрос: ${promptQuestion}`;
            const formatSpec = GENERATION_FORMATS.find((f) => f.id === generationFormat);
            const tableOnlyWhenFormatSelected =
                generationFormat === 'table'
                    ? ' Если пользователь просит таблицу по документам: ВСЕ строки с данными — только как строки GFM-таблицы (каждая начинается с |). Не выноси пункты в маркеры • или списки — каждый документ = одна строка таблицы. Длинный текст клади в ячейку, без переноса таблицы в список.'
                    : '';
            const systemContent =
                'Ты помощник Deep Research Assistant. Отвечай строго на основе предоставленных фрагментов документов Alem Drive, если они релевантны, и явно говори, когда информации недостаточно. Пиши в Markdown: не используй HTML (в т.ч. <br>); для новых абзацев — пустая строка, для списков — маркеры или нумерация. Для схем, блок-схем и связей сущностей можешь вставлять блок ```mermaid с синтаксисом Mermaid (например graph TD, flowchart, sequenceDiagram), интерфейс отрисует диаграмму. ВАЖНО: любые текстовые значения узлов (особенно с пробелами, слэшами / или кириллицей) обязательно заключай в двойные кавычки, например: A["Текст блока / API"]. По умолчанию отвечай связным текстом и списками; не оформляй ответ как таблицу, если пользователь не выбрал формат «Таблица» и вопрос не просит явно табличного сравнения.' +
                tableOnlyWhenFormatSelected +
                (formatSpec ? `\n\nФормат ответа: ${formatSpec.instruction}` : '');
            const response = await chatCompletion({
                model: chatModelMode === 'fast' ? FAST_CHAT_MODEL : THINKING_CHAT_MODEL,
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: userContent },
                ],
            });
            const assistantMessage =
                response.choices?.[0]?.message || response.choices?.[0] || { role: 'assistant', content: 'Нет ответа от модели.' };
            const content = typeof assistantMessage.content === 'string' ? assistantMessage.content : String(assistantMessage.content ?? '');
            const formatUsed = generationFormat;
            setMessages((prev) => [...prev, { ...assistantMessage, content, format: formatUsed }]);

            // После успешного ответа синхронизируем чат с backend.
            // Если пользователь ещё не выбрал чат слева, используем дефолтный ID.
            try {
                await syncNotebookChat(effectiveChatId, {
                    userMessage: question,
                    assistantMessage: content,
                    assistantType: formatUsed || 'text',
                });
            } catch (syncErr) {
                console.error('Failed to sync Notebook chat', syncErr);
            }
        } catch (err) {
            console.error('Deep Research Assistant chat failed', err);
            addToast('Ошибка при обращении к LLM', 'error');
        } finally {
            setSending(false);
        }
    };

    const toggleFileSelection = useCallback(
        async (f) => {
            const fullIndex = files.indexOf(f);
            const effectiveChatId = requireActiveChat();
            if (!effectiveChatId) return;
            const wasSelected = activeFileIds.has(f.id);
            setActiveFileIds((prev) => {
                const next = new Set(prev);
                if (wasSelected) next.delete(f.id);
                else next.add(f.id);
                return next;
            });
            setCurrentFileIndex(fullIndex >= 0 ? fullIndex : 0);
            if (effectiveChatId) {
                try {
                    if (wasSelected) {
                        await removeChatDocument(effectiveChatId, f.id);
                    } else {
                        await addChatDocument(effectiveChatId, f.id);
                    }
                } catch (err) {
                    console.error('Failed to update chat documents', err);
                    setActiveFileIds((prev) => {
                        const revert = new Set(prev);
                        if (wasSelected) revert.add(f.id);
                        else revert.delete(f.id);
                        return revert;
                    });
                    addToast('Не удалось обновить документы в контексте чата', 'error');
                }
            }
        },
        [files, activeFileIds, addToast, requireActiveChat]
    );

    const handleSelectAllVisible = useCallback(async () => {
        const list = filteredFiles;
        if (!list.length) return;
        const effectiveChatId = requireActiveChat();
        if (!effectiveChatId) return;
        const allOn = list.every((f) => activeFileIds.has(f.id));
        if (allOn) {
            const toRemove = list.filter((f) => activeFileIds.has(f.id));
            setActiveFileIds((prev) => {
                const next = new Set(prev);
                toRemove.forEach((file) => next.delete(file.id));
                return next;
            });
            if (effectiveChatId && toRemove.length) {
                try {
                    for (const file of toRemove) {
                        await removeChatDocument(effectiveChatId, file.id);
                    }
                } catch (err) {
                    console.error(err);
                    addToast('Не удалось снять выбор документов', 'error');
                }
            }
        } else {
            const toAdd = list.filter((f) => !activeFileIds.has(f.id));
            setActiveFileIds((prev) => {
                const next = new Set(prev);
                toAdd.forEach((file) => next.add(file.id));
                return next;
            });
            if (effectiveChatId && toAdd.length) {
                try {
                    for (const file of toAdd) {
                        await addChatDocument(effectiveChatId, file.id);
                    }
                } catch (err) {
                    console.error(err);
                    addToast('Не удалось добавить документы в контекст', 'error');
                }
            }
        }
    }, [filteredFiles, activeFileIds, addToast, requireActiveChat]);

    const visibleFilesAllSelected =
        filteredFiles.length > 0 && filteredFiles.every((f) => activeFileIds.has(f.id));

    const recentChatForStudio = visibleChats[0] || chats[0];
    const recentChatLabel = recentChatForStudio
        ? (() => {
              const d = recentChatForStudio.updated_at || recentChatForStudio.created_at;
              if (!d) return '';
              try {
                  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ru });
              } catch {
                  return '';
              }
          })()
        : '';

    const persistChatModelMode = (mode) => {
        const v = mode === 'fast' ? 'fast' : 'thinking';
        setChatModelMode(v);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('notebook_chat_model_mode', v);
        }
    };

    if (embedded) {
        return (
            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-[#f8f9fa] text-gray-900 rounded-none shadow-none">
                <header className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200/90 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="mr-1 p-1.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all flex items-center justify-center"
                                title="Назад к блокнотам"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            A
                        </div>
                        <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                            <span className="font-semibold text-gray-900 truncate">Alem Drive</span>
                            <span className="text-sm text-gray-500 truncate hidden sm:inline">Deep Research</span>
                        </div>
                    </div>
                </header>

                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-nowrap gap-2 overflow-hidden p-2">
                    {sourcesOpen ? (
                        <aside className="relative z-10 flex w-[min(100%,300px)] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm sm:w-[288px]">
                            <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold text-gray-900">Источники</h2>
                                <button
                                    type="button"
                                    onClick={() => setSourcesOpen(false)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                                    title="Свернуть панель"
                                >
                                    <PanelLeftClose className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="px-3 pb-2 flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/drive')}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Добавить источники
                                </button>
                                {onImportNotebookFile && (
                                    <>
                                        <input
                                            ref={notebookImportInputRef}
                                            type="file"
                                            accept=".txt,.md,.docx,.pptx,.ppt,.xlsx,.xls,.xlsm"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                e.target.value = '';
                                                if (f) onImportNotebookFile(f);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            disabled={notebookImportBusy}
                                            onClick={() => notebookImportInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                                        >
                                            {notebookImportBusy ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4" />
                                            )}
                                            Импорт файла
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="px-3 pb-2 space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={docSearch}
                                        onChange={(e) => setDocSearch(e.target.value)}
                                        placeholder="Найдите источники по названию..."
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:border-transparent"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <span className="flex-1 text-center text-[11px] py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200/80">
                                        Диск
                                    </span>
                                    <span className="flex-1 text-center text-[11px] py-1.5 rounded-lg bg-gray-50 text-gray-400 border border-gray-100">
                                        Поиск в сети
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
                                {files?.length > 0 && (
                                    <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={visibleFilesAllSelected}
                                                onChange={() => handleSelectAllVisible()}
                                                className="rounded border-gray-300 text-slate-800 focus:ring-slate-400"
                                            />
                                            Выбрать все
                                        </label>
                                        {loadingDocs && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto" />}
                                    </div>
                                )}
                                {files?.length === 0 ? (
                                    <p className="text-xs text-gray-500 px-2 py-4 text-center leading-relaxed">
                                        {onImportNotebookFile
                                            ? 'Загрузите файл кнопкой «Импорт файла» или добавьте документы на диск.'
                                            : 'Загрузите .docx или .txt на главной странице диска, затем вернитесь сюда.'}
                                    </p>
                                ) : (
                                    <ul className="space-y-1">
                                        {filteredFiles.map((f) => {
                                            const selected = activeFileIds.has(f.id);
                                            return (
                                                <li key={f.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleFileSelection(f)}
                                                        className={`w-full flex items-start gap-2 px-2 py-2 rounded-xl text-left text-sm transition-colors ${
                                                            selected ? 'bg-slate-100 text-slate-900' : 'hover:bg-gray-50 text-gray-800'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                                                selected
                                                                    ? 'border-slate-700 bg-slate-800 text-white'
                                                                    : 'border-gray-300 bg-white text-transparent'
                                                            }`}
                                                        >
                                                            ✓
                                                        </span>
                                                        <FileText className="w-4 h-4 flex-shrink-0 text-slate-500 mt-0.5" />
                                                        <span className="truncate leading-snug">{f.name}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </aside>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setSourcesOpen(true)}
                            className="flex-shrink-0 w-10 self-stretch flex items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:bg-gray-50"
                            title="Показать источники"
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>
                    )}

                    <main className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
                        <div className="flex items-center px-4 py-3 border-b border-gray-100 flex-shrink-0">
                            <h2 className="text-sm font-semibold text-gray-900">Чат</h2>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#fafbfc]">
                            {messages.length === 0 ? (
                                <div className="flex-1 overflow-auto flex flex-col items-center justify-center px-4 py-8">
                                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                        <BookOpen className="w-7 h-7 text-slate-600" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
                                        Задайте вопрос по документам
                                    </h2>
                                    <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                                        Выберите источники слева и напишите сообщение — ответ опирается на контекст файлов.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                                        {SUGGESTIONS.map((s, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setInput(s.text)}
                                                className="flex items-start gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-left text-sm text-gray-700 shadow-sm"
                                            >
                                                <s.icon className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                                <span>{s.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div ref={messagesScrollRef} className="flex-1 overflow-auto p-4 space-y-3 min-h-0">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'user' ? (
                                                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-slate-100 text-slate-900 border border-slate-200/80 rounded-br-md">
                                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-stretch gap-1.5 max-w-[85%]">
                                                    <div className="rounded-2xl px-4 py-3 text-sm shadow-sm bg-white text-gray-800 rounded-bl-md border border-gray-200 select-text">
                                                        {(() => {
                                                            const af = getAssistantMessageFormat(msg);
                                                            const useFormatted =
                                                                af === 'cards' ||
                                                                af === 'test' ||
                                                                af === 'table' ||
                                                                af === 'report' ||
                                                                af === 'presentation' ||
                                                                af === 'chart' ||
                                                                af === 'mermaid';
                                                            return useFormatted ? (
                                                                <FormattedMessage content={msg.content} format={af} />
                                                            ) : (
                                                                <div className="max-w-none">
                                                                    <AssistantMarkdown>
                                                                        {normalizeAssistantMarkdown(msg.content)}
                                                                    </AssistantMarkdown>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex items-center gap-1 px-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => copyAssistantText(msg.content, idx)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-white/80 transition-colors"
                                                            title="Копировать"
                                                        >
                                                            {copiedIndex === idx ? (
                                                                <>
                                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                                    <span>Скопировано</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                    <span>Копировать</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border-t border-gray-200 bg-white flex-shrink-0">
                                <div className="p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <div className="min-w-0 flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Введите текст..."
                                            className="w-full min-w-0 px-4 py-3 rounded-full border border-gray-200 text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent placeholder:text-gray-400"
                                        />
                                    </div>
                                    <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                                        <select
                                            value={chatModelMode}
                                            onChange={(e) => persistChatModelMode(e.target.value)}
                                            className="text-[11px] sm:text-xs rounded-full border border-gray-200 bg-white px-2.5 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-300 max-w-[148px] sm:max-w-[180px]"
                                            aria-label="Режим ответа модели"
                                        >
                                            <option value="fast">Быстрый</option>
                                            <option value="thinking">Thinking Mode</option>
                                        </select>
                                        <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                                            {activeFileIds.size} {sourcesCountLabel(activeFileIds.size)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleSend}
                                            disabled={sending || !input.trim()}
                                            className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                        >
                                            {sending ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Send className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <p className="border-t border-gray-100 px-3 py-2 text-center text-[11px] leading-snug text-gray-500">
                                    Ответы Deep Research Assistant могут быть неточны. Обязательно проверяйте их.
                                </p>
                            </div>
                        </div>
                    </main>

                    {studioOpen ? (
                        <aside className="relative z-10 flex w-[min(100%,300px)] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm sm:w-[280px]">
                            <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold text-gray-900">Студия</h2>
                                <button
                                    type="button"
                                    onClick={() => setStudioOpen(false)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                                    title="Свернуть панель"
                                >
                                    <PanelLeftClose className="w-4 h-4 rotate-180" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
                                <p className="text-[11px] text-gray-500 leading-snug">
                                    Формат сохраняется для всех следующих сообщений, пока не отмените (нажмите ту же кнопку ещё раз).
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {GENERATION_FORMATS.map((f, i) => {
                                        const active = generationFormat === f.id;
                                        const Icon = f.icon;
                                        const theme = STUDIO_CARD_THEMES[i % STUDIO_CARD_THEMES.length];
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setGenerationFormat(active ? null : f.id)}
                                                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all shadow-sm ${
                                                    active ? 'ring-2 ring-slate-800 ring-offset-1 ' : ''
                                                } ${theme}`}
                                                title={f.instruction.slice(0, 100) + '…'}
                                            >
                                                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/70 border border-white/80 flex items-center justify-center text-slate-700">
                                                    <Icon className="w-5 h-5" />
                                                </span>
                                                <span className="text-sm font-medium text-gray-900 leading-tight">{f.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setStudioOpen(true)}
                            className="flex-shrink-0 w-10 self-stretch flex items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:bg-gray-50"
                            title="Показать студию"
                        >
                            <PanelLeft className="w-5 h-5 rotate-180" />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col overflow-hidden bg-white ${embedded ? 'h-full rounded-none shadow-none' : ''}`}>
            {/* Шапка */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#7c3aed] flex items-center justify-center text-white font-bold text-lg">
                        N
                    </div>
                    <span className="font-semibold text-gray-800 hidden sm:block">Deep Research Assistant</span>
                    {files?.length > 0 && (
                        <div className="relative min-w-0 flex-1 max-w-[320px] sm:max-w-[360px]">
                            <button
                                type="button"
                                onClick={() => setDocDropdownOpen((v) => !v)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 hover:bg-white hover:shadow-sm text-left truncate transition-colors"
                            >
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate text-sm text-gray-800">
                                        {currentFile?.name || 'Документ'}
                                    </span>
                                    <span className="text-[11px] text-gray-500">
                                        В контексте: {activeFileIds.size} из {files.length} док.
                                    </span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-auto" />
                            </button>
                            <AnimatePresence>
                                {docDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setDocDropdownOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 max-h-72 flex flex-col"
                                        >
                                            <div className="px-3 pb-1 text-[11px] text-gray-500 uppercase tracking-wide">
                                                Документы в контексте
                                            </div>
                                            <div className="px-3 pb-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={docSearch}
                                                        onChange={(e) => setDocSearch(e.target.value)}
                                                        placeholder="Поиск по названию..."
                                                        className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-auto">
                                            {files
                                                .filter((f) => (f.name || '').toLowerCase().includes(docSearch.trim().toLowerCase()))
                                                .map((f) => {
                                                const selected = activeFileIds.has(f.id);
                                                const isCurrent = f.id === currentFile?.id;
                                                const fullIndex = files.indexOf(f);
                                                return (
                                                    <button
                                                        key={f.id}
                                                        type="button"
                                                        onClick={() => toggleFileSelection(f)}
                                                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${
                                                            selected ? 'bg-indigo-50/60 text-indigo-800' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`flex-shrink-0 w-4 h-4 rounded-[6px] border flex items-center justify-center text-[9px] ${
                                                                selected
                                                                    ? 'border-indigo-500 bg-indigo-500 text-white'
                                                                    : 'border-gray-300 bg-white text-transparent'
                                                            }`}
                                                        >
                                                            ✓
                                                        </div>
                                                        <FileText className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                                        <span className="truncate flex-1">{f.name}</span>
                                                        {isCurrent && (
                                                            <span className="text-[10px] text-indigo-600 font-medium flex-shrink-0">
                                                                текущий
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    {/* Встраиваемый режим: доп. подпись не нужна — счётчик в дропдауне */}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Кнопка «Новый чат» убрана — управление чатами слева в списке */}
                    {!embedded && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Приветствие или чат */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
                {messages.length === 0 ? (
                    <div className="flex-1 overflow-auto flex flex-col items-center justify-center px-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                            Привет! Готов работать с документом
                        </h2>
                        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                            Задавайте вопросы о содержимом документа, и я помогу вам найти нужную информацию и получить инсайты.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setInput(s.text)}
                                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-indigo-200 text-left text-sm text-gray-700"
                                >
                                    <s.icon className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                                    <span>{s.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                                <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-4 space-y-3">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'user' ? (
                                                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-indigo-600 text-white rounded-br-sm">
                                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                                </div>
                                            ) : (
                                                <div
                                                    className={`flex flex-col items-stretch gap-1.5 ${
                                                        getAssistantMessageFormat(msg) === 'mermaid'
                                                            ? 'w-full max-w-full'
                                                            : 'max-w-[85%]'
                                                    }`}
                                                >
                                        <div className="rounded-2xl px-4 py-3 text-sm shadow-sm bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100 select-text">
                                            {(() => {
                                                const af = getAssistantMessageFormat(msg);
                                                const useFormatted =
                                                    af === 'cards' ||
                                                    af === 'test' ||
                                                    af === 'table' ||
                                                    af === 'report' ||
                                                    af === 'presentation' ||
                                                    af === 'chart' ||
                                                    af === 'mermaid';
                                                return useFormatted ? (
                                                    <FormattedMessage content={msg.content} format={af} />
                                                ) : (
                                                    <div className="max-w-none">
                                                        <AssistantMarkdown>
                                                            {normalizeAssistantMarkdown(msg.content)}
                                                        </AssistantMarkdown>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-1 px-0.5">
                                            <button
                                                type="button"
                                                onClick={() => copyAssistantText(msg.content, idx)}
                                                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                                title="Копировать"
                                            >
                                                {copiedIndex === idx ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Скопировано</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Копировать</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-t border-gray-100 flex-shrink-0">
                    <div className="px-3 pt-2 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500">Формат ответа (необязательно):</span>
                            {GENERATION_FORMATS.map((f) => {
                                const active = generationFormat === f.id;
                                const Icon = f.icon;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setGenerationFormat(active ? null : f.id)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            active
                                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                        }`}
                                        title={f.instruction.slice(0, 80) + '…'}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                        {generationFormat && (
                            <p className="text-[11px] text-amber-800/90 mt-1.5 leading-snug">
                                Формат действует для следующих сообщений, пока не отмените — нажмите ту же кнопку ещё раз.
                            </p>
                        )}
                    </div>
                    <div className="p-3 pt-1 flex items-center gap-2 flex-wrap">
                    <select
                        value={chatModelMode}
                        onChange={(e) => persistChatModelMode(e.target.value)}
                        className="text-xs rounded-xl border border-gray-200 bg-white px-2.5 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
                        aria-label="Режим ответа модели"
                    >
                        <option value="fast">Быстрый</option>
                        <option value="thinking">Thinking Mode</option>
                    </select>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Спросите что-нибудь о документе..."
                        className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !input.trim()}
                        className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotebookLlmContent;
