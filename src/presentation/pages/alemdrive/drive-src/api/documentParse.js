/**
 * ?????? ????????? ????? AI tools endpoint `/tools/document-parse/parse`.
 *
 * Dev: Vite ?????????? `/api/tools` ?? AI backend.
 * Prod: ????? ?????? ?????? ? ??? ?? backend ????? `/api/tools/...`, ??? ? ????????? AlemAI ???????????.
 *
 * Auth is cookie-based.
 */

/** ?? ????????? ?????????? ??? ?? tools base path, ??? ? ????????? AI frontend. */
export const DOCUMENT_PARSE_BASE_URL = '/api/tools/document-parse';

function isLocalDevHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function shouldUseLocalProxy(raw) {
    if (typeof window === 'undefined' || !raw) return false;
    if (!isLocalDevHost(window.location.hostname)) return false;
    try {
        const url = new URL(String(raw).trim(), window.location.origin);
        return url.origin !== window.location.origin;
    } catch {
        return false;
    }
}

function normalizeParseBaseFromEnv(raw) {
    let u = String(raw).trim().replace(/\/$/, '');
    if (!u) return '';
    if (u.startsWith('/')) return u;
    try {
        const url = new URL(u);
        let path = url.pathname.replace(/\/$/, '') || '';
        if (path === '/parse' || path.endsWith('/parse')) {
            path = path.replace(/\/parse$/, '') || '';
        }
        if (!path || path === '/') return url.origin;
        return `${url.origin}${path}`;
    } catch {
        return u;
    }
}

function getParseBaseUrl() {
    const env = import.meta.env?.VITE_DOCUMENT_PARSE_URL;
    if (typeof env === 'string' && env.trim()) {
        if (shouldUseLocalProxy(env)) {
            return DOCUMENT_PARSE_BASE_URL.replace(/\/$/, '');
        }
        return normalizeParseBaseFromEnv(env);
    }
    return DOCUMENT_PARSE_BASE_URL.replace(/\/$/, '');
}

function getParseAuthHeader() {
    return {};
}

export function getParseChunksArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.chunks)) return payload.chunks;
    if (Array.isArray(payload.elements)) return payload.elements;
    if (Array.isArray(payload)) return payload;
    return [];
}

/** ????? ??? ?????????? ? RAG: ????????? HTML-??????? ?? ?????????? ?????. */
export function getChunkTextForEmbedding(chunk) {
    if (!chunk || typeof chunk !== 'object') return '';
    const meta = chunk.metadata && typeof chunk.metadata === 'object' ? chunk.metadata : {};
    const html = meta.text_as_html;
    if (typeof html === 'string' && html.trim()) return html.trim();
    if (typeof chunk.text === 'string' && chunk.text.trim()) return chunk.text.trim();
    return '';
}

export function isDocumentParseConfigured() {
    return Boolean(getParseBaseUrl());
}

function buildParseUrl(base, chunkByTitleEnabled) {
    const params = new URLSearchParams({
        chunk_by_title_enabled: chunkByTitleEnabled ? 'true' : 'false',
        infer_table_structure: 'true',
    });
    return `${base}/parse?${params.toString()}`;
}

function shouldRetryWithoutTitleChunking(errorText) {
    if (!errorText) return false;
    return (
        errorText.includes('en_core_web_sm') ||
        errorText.includes('spaCy model') ||
        errorText.includes('chunk_by_title_enabled=false')
    );
}

async function requestDocumentParse(url, form, headers, signal) {
    const res = await fetch(url, {
        method: 'POST',
        body: form,
        headers,
        signal,
        credentials: 'include',
    });

    if (res.ok) {
        return res.json();
    }

    const contentType = res.headers.get('content-type') || '';
    let errText = '';
    if (contentType.includes('application/json')) {
        const payload = await res.json().catch(() => null);
        if (payload && typeof payload === 'object') {
            errText = String(payload.detail || payload.message || '').trim();
        }
    }
    if (!errText) {
        errText = await res.text().catch(() => '');
    }
    const error = new Error(errText || `Document parse failed: HTTP ${res.status}`);
    error.status = res.status;
    error.responseText = errText;
    throw error;
}

/**
 * POST multipart file ? JSON ? ???????? chunks.
 * @param {Blob} fileBlob
 * @param {string} fileName
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function parseDocumentFile(fileBlob, fileName, options = {}) {
    const base = getParseBaseUrl();
    const form = new FormData();
    form.append('file', fileBlob, fileName || 'document');

    const headers = { ...getParseAuthHeader() };

    try {
        return await requestDocumentParse(buildParseUrl(base, true), form, headers, options.signal);
    } catch (error) {
        if (!shouldRetryWithoutTitleChunking(error?.responseText || error?.message || '')) {
            throw error;
        }
    }

    return requestDocumentParse(buildParseUrl(base, false), form, headers, options.signal);
}

export function extractEmbeddingTextsFromParseResult(parseJson) {
    const chunks = getParseChunksArray(parseJson);
    return chunks.map((ch) => getChunkTextForEmbedding(ch)).filter((t) => t.length > 0);
}
