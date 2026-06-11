import { HttpError } from '../../../../../infrastructure/http/HttpError'
import { getAlemAiApi } from '../../runtime'
import type {
  MeetingAiLanguage,
  MeetingAiMeetingAnalyzeResponse,
  MeetingAiSpeechToTextReportResponse,
  MeetingAiTTSReportResponse,
  MeetingAiTTSRequest,
  MeetingAiTranscriptionResponse,
} from '../types'

const AUDIO_DURATION_ERROR_RE = /unable to determine audio duration/i

export class MeetingAiApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const normalizeMimeType = (contentType: string): string => {
  const [baseType] = contentType.split(';', 1)
  return baseType?.trim().toLowerCase() ?? ''
}

const normalizeUploadFileType = (file: File): File => {
  const normalizedType = normalizeMimeType(file.type)
  if (!normalizedType || normalizedType === file.type) return file
  return new File([file], file.name, { type: normalizedType, lastModified: file.lastModified })
}

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

const mixToMono = (audioBuffer: AudioBuffer): Float32Array => {
  const length = audioBuffer.length
  const channels = audioBuffer.numberOfChannels
  if (channels === 1) return audioBuffer.getChannelData(0)

  const mono = new Float32Array(length)
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      mono[index] += (data[index] ?? 0) / channels
    }
  }
  return mono
}

const toWavFile = async (file: File): Promise<File | null> => {
  if (typeof window === 'undefined') return null

  const audioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!audioContextCtor) return null

  const audioContext = new audioContextCtor()
  try {
    const arrayBuffer = await file.arrayBuffer()
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const mono = mixToMono(decoded)
    const wavBlob = encodeWav(mono, decoded.sampleRate)
    const safeName = file.name.replace(/\.[^/.]+$/, '') || 'audio'
    return new File([wavBlob], `${safeName}.wav`, {
      type: 'audio/wav',
      lastModified: file.lastModified,
    })
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

const toApiError = (error: unknown, fallbackError: string): MeetingAiApiError => {
  if (error instanceof HttpError) {
    return new MeetingAiApiError(error.message || fallbackError, error.status)
  }

  if (error instanceof MeetingAiApiError) {
    return error
  }

  if (error instanceof Error) {
    return new MeetingAiApiError(error.message || fallbackError, 500)
  }

  return new MeetingAiApiError(fallbackError, 500)
}

const postForm = async <T>(
  path: 'speech-to-text' | 'speech-to-text/report' | 'meeting/analyze',
  file: File,
  options: { model?: string; reportLanguage?: MeetingAiLanguage },
  fallbackError: string,
): Promise<T> => {
  try {
    const api = getAlemAiApi()
    const normalizedFile = normalizeUploadFileType(file)

    if (path === 'speech-to-text') {
      return await api.speechToText(normalizedFile, options) as T
    }

    if (path === 'speech-to-text/report') {
      return await api.speechToTextReport(normalizedFile, options) as T
    }

    return await api.meetingAnalyze(normalizedFile, options) as T
  } catch (error) {
    const apiError = toApiError(error, fallbackError)
    const shouldRetryAsWav = apiError.status === 502 && AUDIO_DURATION_ERROR_RE.test(apiError.message)
    if (!shouldRetryAsWav) throw apiError

    const wavFile = await toWavFile(file).catch(() => null)
    if (!wavFile) throw apiError

    const api = getAlemAiApi()
    if (path === 'speech-to-text') {
      return await api.speechToText(wavFile, options) as T
    }

    if (path === 'speech-to-text/report') {
      return await api.speechToTextReport(wavFile, options) as T
    }

    return await api.meetingAnalyze(wavFile, options) as T
  }
}

export const analyzeText = async (_token: string, text: string, reportLanguage: MeetingAiLanguage) => {
  try {
    const api = getAlemAiApi()
    return await api.analyzeText(text, reportLanguage)
  } catch (error) {
    throw toApiError(error, 'Ошибка text-analysis')
  }
}

export const textToSpeech = async (
  _token: string,
  payload: MeetingAiTTSRequest,
): Promise<{ blob: Blob; filename: string }> => {
  void payload
  throw new MeetingAiApiError('Text-to-speech временно недоступен в SuperApp MVP', 501)
}

export const textToSpeechReport = async (_token: string, payload: MeetingAiTTSRequest): Promise<MeetingAiTTSReportResponse> => {
  void payload
  throw new MeetingAiApiError('Text-to-speech/report временно недоступен в SuperApp MVP', 501)
}

export const speechToText = (
  _token: string,
  file: File,
  options: { model?: string; reportLanguage?: MeetingAiLanguage },
) => postForm<MeetingAiTranscriptionResponse>('speech-to-text', file, options, 'Ошибка speech-to-text')

export const speechToTextReport = (
  _token: string,
  file: File,
  options: { model?: string; reportLanguage?: MeetingAiLanguage },
) => postForm<MeetingAiSpeechToTextReportResponse>('speech-to-text/report', file, options, 'Ошибка speech-to-text/report')

export const meetingAnalyze = (
  _token: string,
  file: File,
  options: { model?: string; reportLanguage?: MeetingAiLanguage },
) => postForm<MeetingAiMeetingAnalyzeResponse>('meeting/analyze', file, options, 'Ошибка meeting/analyze')
