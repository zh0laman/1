import axios from 'axios';

const LLM_BASE_URL = 'https://llm.nitec.kz';

const llmClient = axios.create({
    baseURL: LLM_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

const DEFAULT_LLM_API_KEY = 'sk-xoRK7oI0JwvIDAhVFPr7-w';

function getLlmApiKey() {
    // 1) Env variable (build-time)
    const envKey = import.meta.env?.VITE_LLM_API_KEY;
    if (envKey) return envKey;

    // 2) Local storage (runtime)
    if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('llm_api_key');
        if (stored && stored !== 'undefined') return stored;
    }

    // 3) Статичный ключ по умолчанию для всех
    return DEFAULT_LLM_API_KEY;
}

llmClient.interceptors.request.use(
    (config) => {
        const apiKey = getLlmApiKey();
        if (!config.headers) config.headers = {};
        if (apiKey) {
            config.headers.Authorization = `Bearer ${apiKey}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export async function createEmbeddings(inputTexts, model = 'BAAI/bge-m3') {
    if (!Array.isArray(inputTexts)) {
        throw new Error('createEmbeddings: inputTexts must be an array of strings');
    }

    const response = await llmClient.post('/v1/embeddings', {
        model,
        input: inputTexts,
    });

    return response.data;
}

function pickEmbeddingVector(entry) {
    if (!entry) return [];
    if (Array.isArray(entry)) return entry;
    if (entry.embedding) return entry.embedding;
    if (entry.vector) return entry.vector;
    return [];
}

/** Несколько запросов подряд с сохранением порядка (длинные списки чанков). */
export async function createEmbeddingsBatched(inputTexts, model = 'BAAI/bge-m3', batchSize = 24) {
    if (!Array.isArray(inputTexts)) {
        throw new Error('createEmbeddingsBatched: inputTexts must be an array of strings');
    }
    const vectors = [];
    for (let i = 0; i < inputTexts.length; i += batchSize) {
        const slice = inputTexts.slice(i, i + batchSize);
        const data = await createEmbeddings(slice, model);
        const list = data?.data ?? data?.embeddings ?? data;
        const arr = Array.isArray(list) ? list : [];
        for (let j = 0; j < slice.length; j += 1) {
            vectors.push(pickEmbeddingVector(arr[j]));
        }
    }
    return vectors;
}

/** Модель для /v1/chat/completions (Deep Research Assistant и др.) */
const envFastModel = import.meta.env?.VITE_LLM_CHAT_MODEL_FAST;
const envThinkingModel = import.meta.env?.VITE_LLM_CHAT_MODEL_THINKING;

/** Режим «Быстрый» в UI */
export const FAST_CHAT_MODEL =
    typeof envFastModel === 'string' && envFastModel.trim() ? envFastModel.trim() : 'openai/gpt-oss-120b';

/** Режим «Thinking Mode» в UI */
export const THINKING_CHAT_MODEL =
    typeof envThinkingModel === 'string' && envThinkingModel.trim()
        ? envThinkingModel.trim()
        : 'Qwen/Qwen3.5-397B-A17B';

export const DEFAULT_CHAT_MODEL = THINKING_CHAT_MODEL;

export async function chatCompletion({ model = DEFAULT_CHAT_MODEL, messages, tools, toolChoice = 'auto' }) {
    if (!Array.isArray(messages)) {
        throw new Error('chatCompletion: messages must be an array');
    }

    const payload = {
        model,
        messages,
    };

    if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = toolChoice;
    }

    const response = await llmClient.post('/v1/chat/completions', payload);
    return response.data;
}

export function saveLlmApiKey(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('llm_api_key', key || '');
}

export function getCurrentLlmApiKey() {
    return getLlmApiKey();
}

