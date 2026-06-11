import { useEffect, useMemo, useRef, useState } from "react";
import { CustomSelect } from "../../shared/CustomSelect";
import { meetingAnalyze, MeetingAiApiError, speechToText, speechToTextReport } from "../api/client";
import type {
  MeetingAiLanguage, MeetingAiMeetingAnalyzeResponse,
  MeetingAiSpeechToTextReportResponse, MeetingAiTextAnalysisResult, MeetingAiTranscriptionResponse,
} from "../types";

type AudioMode = "speech-to-text" | "speech-to-text-report" | "meeting-analyze";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Spin   = () => <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" strokeLinecap="round"/></svg>;
const IMic   = ({ size=16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IStop  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const IPlay  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IUp    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IWave  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2"/></svg>;
const IFAud  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13l2 2 4-4"/></svg>;
const IAlert = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const ICaret = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SL = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold text-[#BDBDBD] uppercase tracking-widest mb-3">{children}</p>
);

function Collapse({ title, count, children, open: defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2 w-full text-left mb-2">
        <span className="text-[12px] font-bold text-[#9E9E9E] uppercase tracking-wide">{title}</span>
        {count !== undefined && <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1E88E5] text-[11px] font-bold">{count}</span>}
        <span className={`ml-auto text-[#BDBDBD] transition-transform ${open?"rotate-180":""}`}><ICaret /></span>
      </button>
      {open && children}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | string }) {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  const [color, bg] = isNaN(n) ? ["#6B7280","#F3F4F6"] : n>=8 ? ["#065F46","#D1FAE5"] : n>=6 ? ["#92400E","#FEF3C7"] : ["#991B1B","#FEE2E2"];
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 gap-1" style={{ backgroundColor: bg }}>
      <span className="text-[20px] font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: color+"cc" }}>{label}</span>
    </div>
  );
}

// ─── Result cards ─────────────────────────────────────────────────────────────
function AnalysisCard({ a }: { a: MeetingAiTextAnalysisResult }) {
  return (
    <div>
      <SL>Анализ качества</SL>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white" style={{ background:"linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)" }}><IWave /></div>
          <div>
            <p className="text-[13px] font-bold text-[#1C1C1E]">Результат</p>
            <p className="text-[11px] text-[#6B7280]">{a.overall_quality}</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Score label="Связность" value={a.coherence_score} />
            <Score label="Ясность" value={a.wording_score} />
            <Score label="Точность" value={a.meaning_score} />
            <Score label="Риск ошибок" value={a.pronunciation_risk_score} />
          </div>
          <Collapse title="Краткий итог"><p className="text-[13px] text-[#374151] leading-relaxed">{a.summary}</p></Collapse>
          <Collapse title="Исправленный текст" open={false}>
            <div className="bg-[#F9FAFB] rounded-xl px-4 py-3 border border-[#E5E7EB]">
              <p className="text-[13px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{a.corrected_text}</p>
            </div>
          </Collapse>
          {a.issues.length > 0 && (
            <Collapse title="Что стоит поправить" count={a.issues.length}>
              <div className="space-y-2">
                {a.issues.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-[#FEE2E2] text-[#DC2626] text-[11px] font-bold uppercase tracking-wide">{item.severity}</span>
                      <span className="text-[12px] text-[#B91C1C] font-semibold">{item.category}</span>
                    </div>
                    <p className="text-[12px] text-[#7F1D1D]">{item.explanation}</p>
                    <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wide font-semibold">Фрагмент</p>
                    <p className="text-[12px] text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-2 py-1 font-mono">«{item.fragment}»</p>
                    <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wide font-semibold">Рекомендация</p>
                    <p className="text-[12px] text-[#374151]">{item.suggestion}</p>
                  </div>
                ))}
              </div>
            </Collapse>
          )}
          {a.recommendations.length > 0 && (
            <Collapse title="Рекомендации" count={a.recommendations.length}>
              <ul className="space-y-1.5">
                {a.recommendations.map(r => (
                  <li key={r} className="flex gap-2 text-[13px] text-[#374151]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E88E5] mt-1.5 shrink-0" />{r}
                  </li>
                ))}
              </ul>
            </Collapse>
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptionCard({ data }: { data: MeetingAiTranscriptionResponse }) {
  return (
    <div>
      <SL>Транскрипция</SL>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="grid grid-cols-1 border-b border-[#E5E7EB]">
          {[
            { l:"Длительность", v:data.duration_seconds !== undefined ? `${data.duration_seconds}с` : "—" },
          ].map(({l,v})=>(
            <div key={l} className="px-3 py-2">
              <p className="text-[10px] font-semibold text-[#BDBDBD] uppercase tracking-wide">{l}</p>
              <p className="text-[12px] font-semibold text-[#1C1C1E] truncate mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <div className="p-4 space-y-4">
          <Collapse title="Исходный текст" open={false}>
            <div className="bg-[#F9FAFB] rounded-xl px-4 py-3 border border-[#E5E7EB]">
              <p className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{data.raw_text}</p>
            </div>
          </Collapse>
          <Collapse title="Исправленный текст">
            <div className="bg-[#EFF6FF] rounded-xl px-4 py-3 border border-[#BFDBFE]">
              <p className="text-[13px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{data.corrected_text}</p>
            </div>
          </Collapse>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ s }: { s: MeetingAiMeetingAnalyzeResponse["summary"] }) {
  return (
    <div>
      <SL>Резюме встречи</SL>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3 bg-[#F0FDF4] border-b border-[#BBF7D0]">
          <p className="text-[11px] font-bold text-[#065F46] uppercase tracking-wide mb-1">Кратко</p>
          <p className="text-[13px] text-[#1C1C1E] leading-relaxed">{s.short_summary}</p>
        </div>
        <div className="p-4 space-y-4">
          <Collapse title="Подробно" open={false}>
            <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">{s.detailed_summary}</p>
          </Collapse>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key:"topics", label:"Темы", items:s.topics, c:"#1E88E5", bg:"#EFF6FF", b:"#BFDBFE" },
              { key:"decisions", label:"Решения", items:s.decisions, c:"#059669", bg:"#F0FDF4", b:"#BBF7D0" },
              { key:"open_questions", label:"Открытые вопросы", items:s.open_questions, c:"#D97706", bg:"#FFFBEB", b:"#FDE68A" },
              { key:"risks", label:"Риски", items:s.risks, c:"#DC2626", bg:"#FEF2F2", b:"#FECACA" },
            ].map(({key,label,items,c,bg,b}) => items.length > 0 ? (
              <div key={key} className="rounded-xl border p-3" style={{ backgroundColor:bg, borderColor:b }}>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color:c }}>{label}</p>
                <ul className="space-y-1">
                  {items.map(item=>(
                    <li key={item} className="flex gap-2 text-[12px]" style={{ color:c+"cc" }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor:c }} />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null)}
          </div>
          {s.action_items.length > 0 && (
            <Collapse title="Следующие шаги" count={s.action_items.length}>
              <div className="space-y-2">
                {s.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[#1E88E5]">{idx+1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#1C1C1E]">{item.task}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {item.owner && <span className="text-[11px] font-semibold text-[#6B7280]">👤 {item.owner}</span>}
                        {item.deadline && <span className="text-[11px] font-semibold text-[#D97706]">📅 до {item.deadline}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Collapse>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function MeetingAiPanel({ token }: { token: string }) {
  const [mode, setMode]             = useState<AudioMode>("speech-to-text");
  const [file, setFile]             = useState<File | null>(null);
  const [lang, setLang]             = useState<MeetingAiLanguage>("ru");
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [hint, setHint]             = useState("");
  const [sttRes, setSttRes]         = useState<MeetingAiTranscriptionResponse | null>(null);
  const [sttRep, setSttRep]         = useState<MeetingAiSpeechToTextReportResponse | null>(null);
  const [meetRes, setMeetRes]       = useState<MeetingAiMeetingAnalyzeResponse | null>(null);
  const [analysis, setAnalysis]     = useState<MeetingAiTextAnalysisResult | null>(null);
  const [isRec, setIsRec]           = useState(false);
  const [recSec, setRecSec]         = useState(0);
  const mrRef  = useRef<MediaRecorder | null>(null);
  const stRef  = useRef<MediaStream | null>(null);
  const chRef  = useRef<Blob[]>([]);
  const tmRef  = useRef<number | null>(null);

  const hasResult = !!(analysis || sttRes || sttRep || meetRes);
  const canRun = useMemo(() => !!token.trim() && !!file && !isRec, [token, file, isRec]);

  const reset = () => { setSttRes(null); setSttRep(null); setMeetRes(null); setAnalysis(null); };
  const clearTm = () => { if (tmRef.current!==null) { window.clearInterval(tmRef.current); tmRef.current=null; } };
  const stopSt  = () => { stRef.current?.getTracks().forEach(t=>t.stop()); stRef.current=null; };

  const run = async (fo?: File | null) => {
    const tgt = fo ?? file;
    if (!token.trim() || !tgt) return;
    setError(null); setIsLoading(true); setHint(""); reset();
    try {
      setHint("Обрабатываем аудио. Это может занять до пары минут.");
      const opts = { model: undefined as string | undefined, reportLanguage: lang };
      if (mode === "speech-to-text") {
        setSttRes(await speechToText(token.trim(), tgt, opts));
      } else if (mode === "speech-to-text-report") {
        const r = await speechToTextReport(token.trim(), tgt, opts);
        setSttRep(r); setAnalysis(r.analysis);
      } else {
        const r = await meetingAnalyze(token.trim(), tgt, opts);
        setMeetRes(r); setAnalysis(r.analysis);
      }
    } catch(e) {
      if (e instanceof MeetingAiApiError) {
        if (e.status===401) setError("Сессия истекла. Войдите снова.");
        else if (e.status===422) setError(`Проверьте данные: ${e.message}`);
        else if (e.status===502) setError("Сервис временно недоступен.");
        else if (e.status===503) setError("Сервис не настроен. Обратитесь к администратору.");
        else setError(e.message);
      } else setError(e instanceof Error ? e.message : "Не удалось выполнить запрос.");
    } finally { setHint(""); setIsLoading(false); }
  };

  const startRec = async () => {
    if (isRec || isLoading) return;
    if (!("mediaDevices" in navigator) || !("MediaRecorder" in window)) { setError("Запись не поддерживается в этом браузере."); return; }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stRef.current = stream; chRef.current = []; setRecSec(0);
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size>0) chRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chRef.current, { type: rec.mimeType||"audio/webm" });
        const f = new File([blob], `meeting-${Date.now()}.webm`, { type: blob.type||"audio/webm" });
        setFile(f); setIsRec(false); clearTm(); stopSt(); void run(f);
      };
      rec.start(1000); setIsRec(true);
      tmRef.current = window.setInterval(()=>setRecSec(p=>p+1), 1000);
    } catch { setError("Нет доступа к микрофону."); setIsRec(false); clearTm(); stopSt(); }
  };

  const stopRec = () => {
    if (!isRec) return;
    const rec = mrRef.current;
    if (rec && rec.state !== "inactive") { rec.stop(); return; }
    setIsRec(false); clearTm(); stopSt();
  };

  useEffect(() => () => { stopSt(); clearTm(); }, []);

  const mm = Math.floor(recSec/60).toString().padStart(2,"0");
  const ss = (recSec%60).toString().padStart(2,"0");

  return (
    <div className="space-y-7 pb-8">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}>
          <IMic size={16} />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-[#1C1C1E]">Помощник встреч</h2>
          <p className="text-[12px] text-[#9E9E9E]">Расшифровка записи, проверка текста и краткий итог</p>
        </div>
      </div>

      {/* Controls card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-5">

        {/* Mode tabs */}
        <div className="flex flex-wrap bg-[#F3F4F6] p-1 rounded-xl gap-1">
          {([
            ["speech-to-text","Транскрипт"],
            ["speech-to-text-report","Транскрипт + анализ"],
            ["meeting-analyze","Анализ встречи"],
          ] as [AudioMode,string][]).map(([m,lbl])=>(
            <button key={m} onClick={()=>setMode(m)}
              className={`flex-1 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all whitespace-nowrap ${
                mode===m ? "bg-white text-[#1C1C1E] shadow-sm border border-[#E5E7EB]" : "text-[#9E9E9E] hover:text-[#1C1C1E]"
              }`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Upload + Record — side by side, NO extra card borders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Upload zone */}
          <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all ${
            file ? "border-[#BFDBFE] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#F9FAFB]"
          }`}>
            <input type="file" className="hidden"
              accept=".mp3,.wav,.ogg,.webm,.mp4,.m4a,audio/*"
              onChange={e=>setFile(e.target.files?.[0]??null)} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${file?"text-[#1E88E5]":"text-[#BDBDBD]"}`}
              style={{ backgroundColor: file?"#DBEAFE":"#F3F4F6" }}>
              {file ? <IFAud /> : <IUp />}
            </div>
            {file ? (
              <>
                <p className="text-[13px] font-semibold text-[#1E88E5] text-center truncate max-w-full px-2">{file.name}</p>
                <button onClick={e=>{e.preventDefault();setFile(null);}}
                  className="text-[11px] text-[#BDBDBD] hover:text-[#EF4444] transition-colors">Удалить</button>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-[#1C1C1E]">Загрузить аудио</p>
                <p className="text-[11px] text-[#BDBDBD]">mp3 · wav · ogg · webm · m4a</p>
              </>
            )}
          </label>

          {/* Mic zone — matches upload zone visually */}
          <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition-all ${
            isRec ? "border-red-200 bg-red-50" : "border-[#E5E7EB]"
          }`}>
            <button
              onClick={isRec ? stopRec : ()=>void startRec()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isRec ? "bg-red-500 text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#1E88E5]"
              }`}>
              {isRec ? <IStop /> : <IMic size={20} />}
            </button>
            {isRec ? (
              <div className="flex items-center gap-2">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[13px] font-bold text-[#DC2626] tabular-nums">{mm}:{ss}</span>
                <span className="text-[12px] text-[#9E9E9E]">идёт запись</span>
              </div>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-[#1C1C1E]">Запись с микрофона</p>
                <p className="text-[11px] text-[#BDBDBD]">Нажмите, чтобы начать</p>
              </>
            )}
          </div>
        </div>

        {/* Language + run */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <SL>Язык результата</SL>
            <CustomSelect value={lang} onChange={(v: string) => setLang(v as MeetingAiLanguage)}
              options={[{ value:"ru", label:"Русский" }, { value:"kk", label:"Қазақша" }]} />
          </div>
          <button onClick={()=>void run()} disabled={!canRun||isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}>
            {isLoading ? <><Spin /> Обрабатываем...</> : <><IPlay /> Запустить</>}
          </button>
          {!isLoading && <p className="text-[12px] text-[#BDBDBD] self-center">Длинные аудио обрабатываются дольше</p>}
        </div>
      </div>

      {/* Status */}
      {isLoading && hint && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-3">
          <Spin /><p className="text-[13px] text-[#1E88E5]">{hint}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-2">
          <div className="shrink-0 mt-0.5 text-[#DC2626]"><IAlert /></div>
          <p className="text-[13px] font-semibold text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && !hasResult && (
        <div className="rounded-2xl border-2 border-dashed border-[#E5E7EB] px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-3 text-[#BDBDBD]"><IWave /></div>
          <p className="text-[14px] font-semibold text-[#1C1C1E]">Готов к работе</p>
          <p className="text-[12px] text-[#BDBDBD] mt-1">Загрузите аудио или запишите разговор</p>
        </div>
      )}

      {/* Results — each result section has its own SL label */}
      {hasResult && (
        <div className="space-y-6">
          {sttRes      && <TranscriptionCard data={sttRes} />}
          {sttRep      && <TranscriptionCard data={sttRep.transcription} />}
          {meetRes     && <TranscriptionCard data={meetRes.transcription} />}
          {meetRes?.summary && <SummaryCard s={meetRes.summary} />}
          {analysis    && <AnalysisCard a={analysis} />}
        </div>
      )}
    </div>
  );
}
