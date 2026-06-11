import client from './client';

// Временный дефолтный чат для синхронизации, пока список чатов пустой
export const DEFAULT_NOTEBOOK_CHAT_ID = 'cbea7b19-818c-4ce6-b9cb-2fefc22c0b41';

/** Получить список чатов Deep Research Assistant */
export async function listNotebookChats() {
    const res = await client.get('/notebook/chats');
    return res.data;
}

/** Получить сообщения конкретного чата Deep Research Assistant */
export async function getNotebookChatMessages(chatId) {
    if (!chatId) throw new Error('getNotebookChatMessages: chatId is required');
    const res = await client.get(`/notebook/chats/${chatId}/messages`);
    return res.data;
}

/**
 * Синхронизация чата после ответа ИИ.
 * Backend ожидает { assistant_message, assistant_type, user_message }.
 * assistant_type: 'text' | 'cards' | 'test' | 'table' | 'report' | 'presentation' | 'chart' | 'mermaid'
 */
export async function syncNotebookChat(chatId, { userMessage, assistantMessage, assistantType = 'text' }) {
    if (!chatId) throw new Error('syncNotebookChat: chatId is required');
    const payload = {
        user_message: userMessage,
        assistant_message: assistantMessage,
        assistant_type: assistantType,
    };
    const res = await client.post(`/notebook/chats/${chatId}/sync`, payload);
    return res.data;
}

/** Создать новый чат Deep Research Assistant */
export async function createNotebookChat(title) {
    const payload = { title };
    const res = await client.post('/notebook/chats', payload);
    return res.data;
}

/** Добавить документ в контекст чата */
export async function addChatDocument(chatId, documentId) {
    if (!chatId || !documentId) throw new Error('addChatDocument: chatId and documentId are required');
    const res = await client.post(`/notebook/chats/${chatId}/documents/${documentId}`);
    return res.data;
}

/** Получить документы в контексте чата */
export async function getChatDocuments(chatId) {
    if (!chatId) throw new Error('getChatDocuments: chatId is required');
    const res = await client.get(`/notebook/chats/${chatId}/documents`);
    return res.data;
}

/** Удалить документ из контекста чата */
export async function removeChatDocument(chatId, documentId) {
    if (!chatId || !documentId) throw new Error('removeChatDocument: chatId and documentId are required');
    const res = await client.delete(`/notebook/chats/${chatId}/documents/${documentId}`);
    return res.data;
}

/** Удалить чат/блокнот Deep Research Assistant */
export async function deleteNotebookChat(chatId) {
    if (!chatId) throw new Error('deleteNotebookChat: chatId is required');
    const res = await client.delete(`/notebook/chats/${chatId}`);
    return res.data;
}

