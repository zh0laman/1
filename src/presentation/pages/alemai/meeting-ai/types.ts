export type MeetingAiLanguage = "ru" | "kk";
export type MeetingAiAudioFormat = "mp3" | "wav" | "opus";

export interface MeetingAiTextAnalysisRequest {
  text: string;
  report_language?: MeetingAiLanguage;
}

export interface MeetingAiTTSRequest {
  text: string;
  voice?: string | null;
  model?: string | null;
  format?: MeetingAiAudioFormat;
  speed?: number;
}

export interface MeetingAiIssue {
  severity: string;
  category: string;
  fragment: string;
  explanation: string;
  suggestion: string;
}

export interface MeetingAiTextAnalysisResult {
  summary: string;
  overall_quality: "good" | "acceptable" | "needs_revision";
  coherence_score: number;
  wording_score: number;
  meaning_score: number;
  pronunciation_risk_score: number;
  corrected_text: string;
  issues: MeetingAiIssue[];
  recommendations: string[];
}

export interface MeetingAiTranscriptionResponse {
  text: string;
  raw_text: string;
  corrected_text: string;
  model: string;
  filename: string;
  duration_seconds: number | null;
  chunk_count: number;
}

export interface MeetingAiActionItem {
  owner: string;
  task: string;
  deadline: string | null;
}

export interface MeetingAiSummary {
  short_summary: string;
  detailed_summary: string;
  topics: string[];
  decisions: string[];
  action_items: MeetingAiActionItem[];
  open_questions: string[];
  risks: string[];
}

export interface MeetingAiSpeechToTextReportResponse {
  transcription: MeetingAiTranscriptionResponse;
  analysis: MeetingAiTextAnalysisResult;
}

export interface MeetingAiMeetingAnalyzeResponse {
  transcription: MeetingAiTranscriptionResponse;
  analysis: MeetingAiTextAnalysisResult;
  summary: MeetingAiSummary;
}

export interface MeetingAiTTSReportResponse {
  analysis: MeetingAiTextAnalysisResult;
  audio_base64: string;
  content_type: string;
  filename: string;
}

export type MeetingAiAnalyzeJobStatus = "queued" | "running" | "completed" | "failed";

export interface MeetingAiAnalyzeJobActionItem {
  task?: string;
  owner?: string;
  deadline?: string | null;
}

export interface MeetingAiAnalyzeJobResult {
  transcript?: string;
  transcription?: MeetingAiTranscriptionResponse;
  summary?: string | MeetingAiSummary;
  action_items?: Array<string | MeetingAiAnalyzeJobActionItem>;
}

export interface MeetingAiAnalyzeJob {
  job_id: string;
  status: MeetingAiAnalyzeJobStatus;
  created_at?: string;
  updated_at?: string;
  filename?: string;
  result?: MeetingAiAnalyzeJobResult | null;
  error?: string | null;
}

export interface MeetingAiAnalyzeJobCreated {
  job_id: string;
  status: MeetingAiAnalyzeJobStatus;
  created_at?: string;
  updated_at?: string;
}
