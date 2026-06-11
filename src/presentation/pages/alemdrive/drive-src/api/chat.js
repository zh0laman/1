import client from './client';

export const getUsers = async (query = '') => {
    // Re-using the same endpoint as in auth.js if it provides the list of all users
    // The user mentioned: http://92.38.48.9:18080/swagger/index.html#/users/get_users
    const response = await client.get('/users', { params: { search: query } });
    return response.data;
};

export const createConversation = async (peerId) => {
    // Updated based on inference that if messages is at /conversations, this likely is too.
    // User previous link was #/chat/post_conversations but curl shows /api/v1/conversations/...
    const response = await client.post('/conversations', { peer_id: peerId });
    // Fallback if that 404s? We'll assume strict adherence to likely REST structure 
    // or the user's explicit curl overriding the swagger link hint.
    return response.data;
};

export const sendMessage = async (conversationId, content, type = 'file', metadata = null) => {
    const response = await client.post(`/conversations/${conversationId}/messages`, {
        content,
        type,
        metadata
    });
    return response.data;
};
