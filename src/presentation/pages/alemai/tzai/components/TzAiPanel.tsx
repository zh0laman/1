import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../../shared/CustomSelect";
import {
  analyzeTzMultipart, analyzeTzText, createTzTasks,
  fetchBoardDetails, fetchBoards, fetchTools, TzAiApiError,
} from "../api/client";
import type { BoardDetails, BoardOption, TzAiTaskItem } from "../types";

type InputMode = "text" | "file";
type Priority  = "low" | "medium" | "high";
const TZ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const EMPTY_TASK: TzAiTaskItem = {
  title: "", description: "", priority: "medium", original_estimate_sec: 3600,
  board_id: null, column_id: null, sprint_id: null, assignee_id: null,
};
const PRI: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  low:    { label: "Низкий",  color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
  medium: { label: "Средний", color: "#B45309", bg: "#FEF3C7", dot: "#F59E0B" },
  high:   { label: "Высокий", color: "#B91C1C", bg: "#FEE2E2", dot: "#EF4444" },
};

const toErr = (e: unknown, fb: string) => {
  if (e instanceof TzAiApiError) {
    if (e.status === 401) return { message: "Нужно заново войти.", details: e.errors };
    if (e.status === 400) return { message: `Проверьте заполнение: ${e.message}`, details: e.errors };
    if (e.status === 502) return { message: "Сервис временно недоступен.", details: e.errors };
    return { message: e.message, details: e.errors };
  }
  if (e instanceof Error) return { message: e.message, details: [] };
  return { message: fb, details: [] };
};
const norm = (t: Partial<TzAiTaskItem>): TzAiTaskItem => ({
  title: t.title ?? "", description: t.description ?? "",
  priority: t.priority === "high" || t.priority === "low" || t.priority === "medium" ? t.priority : "medium",
  original_estimate_sec: typeof t.original_estimate_sec === "number" && Number.isFinite(t.original_estimate_sec) ? t.original_estimate_sec : 3600,
  board_id: typeof t.board_id === "string" ? t.board_id : null,
  column_id: typeof t.column_id === "string" ? t.column_id : null,
  sprint_id: typeof t.sprint_id === "string" ? t.sprint_id : null,
  assignee_id: typeof t.assignee_id === "number" && Number.isFinite(t.assignee_id) ? t.assignee_id : null,
});
const fmtSec = (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h===0?`${m}м`:m===0?`${h}ч`:`${h}ч ${m}м`; };

// ─── Icons ────────────────────────────────────────────────────────────────────
const Spin  = () => <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" strokeLinecap="round"/></svg>;
const IFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IText = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>;
const IPlus = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ITrash= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
const IBrain= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>;
const ICheck= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IAlert= () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

// ─── Section label ────────────────────────────────────────────────────────────
const SL = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold text-[#BDBDBD] uppercase tracking-widest mb-3">{children}</p>
);

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, boards, boardMeta, onUpdate, onDelete, onLoadBoard }: {
  task: TzAiTaskItem; boards: BoardOption[]; boardMeta: Record<string, BoardDetails>;
  onUpdate: (p: Partial<TzAiTaskItem>) => void; onDelete: () => void;
  onLoadBoard: (id: string | null) => void;
}) {
  const d = task.board_id ? boardMeta[task.board_id] : undefined;
  const cols = d?.columns ?? [], sprs = d?.sprints ?? [], asns = d?.assignees ?? [];
  return (
    <div className="group bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3 transition-all hover:border-[#BFDBFE] hover:shadow-[0_0_0_4px_rgba(30,136,229,0.05)]">
      <div className="flex items-start gap-3">
        <input value={task.title} onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Название задачи..."
          className="flex-1 text-[14px] font-semibold text-[#1C1C1E] placeholder:text-[#BDBDBD] outline-none border-b border-transparent focus:border-[#BFDBFE] pb-0.5 bg-transparent transition-colors" />
        <button onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-[#BDBDBD] hover:bg-[#FEF2F2] hover:text-[#EF4444]">
          <ITrash />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["low","medium","high"] as Priority[]).map(p => (
          <button key={p} onClick={() => onUpdate({ priority: p })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              task.priority === p ? "border-transparent" : "border-[#E5E7EB] text-[#BDBDBD] hover:border-[#D1D5DB]"
            }`} style={task.priority === p ? { backgroundColor: PRI[p].bg, color: PRI[p].color } : {}}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.priority === p ? PRI[p].dot : "#D1D5DB" }} />
            {PRI[p].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[12px] text-[#9E9E9E]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <input type="number" min={0} value={task.original_estimate_sec}
            onChange={e => onUpdate({ original_estimate_sec: Math.max(0, Number(e.target.value)||0) })}
            className="w-14 bg-transparent outline-none text-right font-medium text-[#1C1C1E]" />
          <span>с · {fmtSec(task.original_estimate_sec)}</span>
        </div>
      </div>

      <textarea value={task.description} onChange={e => onUpdate({ description: e.target.value })}
        rows={2} placeholder="Описание..."
        className="w-full bg-[#F9FAFB] rounded-xl px-3 py-2 text-[13px] text-[#374151] placeholder:text-[#BDBDBD] outline-none border border-transparent focus:border-[#BFDBFE] focus:bg-white transition-all resize-none leading-relaxed" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { lbl:"Доска", val:task.board_id??"", opts:[{value:"",label:"—"},...boards.map(b=>({value:b.id,label:b.name}))],
            fn:(v:string)=>{ const id=v||null; onUpdate({board_id:id,column_id:null,sprint_id:null,assignee_id:null}); onLoadBoard(id); }},
          { lbl:"Колонка", val:task.column_id??"", opts:[{value:"",label:"—"},...cols.map(c=>({value:c.id,label:c.name}))],
            fn:(v:string)=>onUpdate({column_id:v||null})},
          { lbl:"Спринт", val:task.sprint_id??"", opts:[{value:"",label:"—"},...sprs.map(s=>({value:s.id,label:s.name}))],
            fn:(v:string)=>onUpdate({sprint_id:v||null})},
          { lbl:"Исполнитель", val:task.assignee_id?String(task.assignee_id):"", opts:[{value:"",label:"—"},...asns.map(a=>({value:String(a.id),label:a.name}))],
            fn:(v:string)=>onUpdate({assignee_id:v?Number(v):null})},
        ].map(({lbl,val,opts,fn})=>(
          <div key={lbl}>
            <p className="text-[10px] font-semibold text-[#BDBDBD] uppercase tracking-wide mb-1">{lbl}</p>
            <CustomSelect value={val} onChange={fn} options={opts} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function TzAiPanel({ token }: { token: string }) {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [text, setText]           = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [boards, setBoards]       = useState<BoardOption[]>([]);
  const [boardMeta, setBoardMeta] = useState<Record<string, BoardDetails>>({});
  const [summary, setSummary]     = useState("");
  const [tasks, setTasks]         = useState<TzAiTaskItem[]>([]);
  const [createResult, setCreateResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const [isCreating, setIsCreating]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [errorDetails, setErrorDetails]   = useState<string[]>([]);

  const canAnalyze = useMemo(() => !token.trim() ? false : inputMode === "text" ? !!text.trim() : !!file || !!text.trim(), [token, inputMode, text, file]);
  const canCreate  = useMemo(() => !!token.trim() && tasks.length > 0, [token, tasks]);

  useEffect(() => {
    const boot = async () => {
      if (!token.trim()) { setError("Войдите в систему."); return; }
      setIsBootLoading(true); setError(null); setErrorDetails([]);
      try {
        const [tools, bl] = await Promise.all([fetchTools(token.trim()), fetchBoards(token.trim()).catch(()=>[])]);
        if (!tools.some(t=>t.id==="tzai")) throw new Error("Инструмент планирования недоступен.");
        setBoards(Array.isArray(bl)?bl:[]);
      } catch(e) {
        const n = toErr(e,"Не удалось загрузить данные.");
        setError(n.message);
        setErrorDetails(n.details);
      } finally {
        setIsBootLoading(false);
      }
    };

    void boot();
  }, [token]);

  const loadBoard = async (id: string | null) => {
    if (!id || boardMeta[id]) return;
    try {
      const details = await fetchBoardDetails(token.trim(), id);
      setBoardMeta((p) => ({ ...p, [id]: details }));
    }
    catch { setBoardMeta(p=>({...p,[id]:{columns:[],sprints:[],assignees:[]}})); }
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true); setError(null); setErrorDetails([]); setCreateResult(null);
    try {
      const res = inputMode==="text"
        ? await analyzeTzText(token.trim(), text.trim(), TZ_DEFAULT_MODEL)
        : await analyzeTzMultipart(token.trim(), { text, file: file??undefined, model: TZ_DEFAULT_MODEL });
      const next = Array.isArray(res.tasks) ? res.tasks.map(norm) : [];
      setSummary(typeof res.answer==="string" ? res.answer : "");
      setTasks(next);
      await Promise.all([...new Set(next.map(t=>t.board_id).filter((id):id is string=>!!id))].map(loadBoard));
    } catch(e) { const n=toErr(e,"Ошибка при анализе ТЗ."); setError(n.message); setErrorDetails(n.details); }
    finally { setIsAnalyzing(false); }
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true); setError(null); setErrorDetails([]);
    try {
      const r = await createTzTasks(token.trim(), tasks);
      setCreateResult({ created: Number.isFinite(r.created_tasks)?r.created_tasks:0, errors: Array.isArray(r.errors)?r.errors:[] });
    } catch(e) { const n=toErr(e,"Ошибка при создании задач."); setError(n.message); setErrorDetails(n.details); }
    finally { setIsCreating(false); }
  };

  const upd = (i: number, p: Partial<TzAiTaskItem>) => setTasks(prev=>prev.map((t,idx)=>idx===i?{...t,...p}:t));

  return (
    <div className="space-y-7 pb-8">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #082EA8 0%, #1E88E5 100%)" }}>
          <IBrain />
        </div>
        <div className="flex-1">
          <h2 className="text-[18px] font-bold text-[#1C1C1E]">AlemAi.tasks</h2>
          <p className="text-[12px] text-[#9E9E9E]">Анализирует описание и готовит задачи для доски</p>
        </div>
        {isBootLoading && <span className="flex items-center gap-1.5 text-[12px] text-[#BDBDBD]"><Spin /> Загрузка...</span>}
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-4">
        <div className="flex bg-[#F3F4F6] p-1 rounded-xl gap-1 w-fit">
          {(["text","file"] as InputMode[]).map(m => (
            <button key={m} onClick={()=>setInputMode(m)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all ${
                inputMode===m ? "bg-white text-[#1E88E5] shadow-sm border border-[#E5E7EB]" : "text-[#9E9E9E] hover:text-[#1C1C1E]"
              }`}>
              {m==="text" ? <IText /> : <IFile />} {m==="text" ? "Текст" : "Файл"}
            </button>
          ))}
        </div>

        {inputMode==="file" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#374151] cursor-pointer hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#1E88E5] transition-all">
              <IFile /> Выбрать файл
              <input type="file" className="hidden" accept=".txt,.md,.pdf,.docx" onChange={e=>setFile(e.target.files?.[0]??null)} />
            </label>
            {file
              ? <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[13px] text-[#1E88E5] font-medium">
                  <IFile /> {file.name}
                  <button onClick={()=>setFile(null)} className="ml-1 text-[#BFDBFE] hover:text-[#1E88E5]">×</button>
                </span>
              : <span className="text-[12px] text-[#BDBDBD]">.txt, .md, .pdf, .docx</span>
            }
          </div>
        )}

        <div>
          <SL>{inputMode==="text" ? "Текст задания" : "Комментарий к файлу (необязательно)"}</SL>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={5}
            placeholder={inputMode==="text" ? "Вставьте описание задачи, ТЗ или бриф..." : "Дополнительный контекст..."}
            className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#BDBDBD] outline-none border border-[#E5E7EB] focus:border-[#BFDBFE] focus:bg-white transition-all resize-none leading-relaxed" />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={()=>void handleAnalyze()} disabled={!canAnalyze||isAnalyzing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(135deg, #1E88E5 0%, #082EA8 100%)" }}>
            {isAnalyzing ? <><Spin /> Анализирую...</> : <><IBrain /> {inputMode==="text" ? "Подготовить задачи" : "Подготовить по файлу"}</>}
          </button>
          <button onClick={()=>setTasks(p=>[...p,{...EMPTY_TASK}])}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all">
            <IPlus /> Добавить задачу
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div>
          <SL>Результат анализа</SL>
          <div className="bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] px-5 py-4">
            <p className="text-[13px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <SL>Задачи</SL>
            <span className="-mt-3 px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1E88E5] text-[11px] font-bold">{tasks.length}</span>
          </div>
          <div className="space-y-3">
            {tasks.map((t,i)=>(
              <TaskCard key={`t${i}`} task={t} boards={boards} boardMeta={boardMeta}
                onUpdate={p=>upd(i,p)} onDelete={()=>setTasks(p=>p.filter((_,idx)=>idx!==i))} onLoadBoard={loadBoard} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button onClick={()=>void handleCreate()} disabled={!canCreate||isCreating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}>
              {isCreating ? <><Spin /> Сохраняем...</> : <><ICheck /> Создать задачи</>}
            </button>
            {createResult && createResult.created > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D1FAE5] border border-[#6EE7B7] text-[#065F46] text-[12px] font-semibold">
                <ICheck /> Создано: {createResult.created}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {(error || (createResult?.errors.length ?? 0) > 0) && (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-[#DC2626]">
            <IAlert />
            <p className="text-[13px] font-semibold">{error ?? "Не удалось создать часть задач"}</p>
          </div>
          {[...(createResult?.errors??[]),...errorDetails].map(d=>(
            <p key={d} className="text-[12px] text-[#B91C1C] pl-5 ml-0.5 border-l-2 border-[#FECACA]">{d}</p>
          ))}
        </div>
      )}
    </div>
  );
}
