import client from './client';

export const login = async (email, password) => {
    const response = await client.post('/auth/login', { email, password });
    const { access_token, refresh_token } = response.data;
    if (!access_token) {
        throw new Error("No access token received");
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return response.data;
};

export const logout = async () => {
    try {
        await client.post('/auth/logout');
    } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/login';
    }
};

export const register = async (username, password, full_name) => {
    const response = await client.post('/auth/register', { username, password, full_name });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return response.data;
}

export const getMe = async () => {
    const response = await client.get('/auth/me');
    return response.data;
};

export const getUsers = async (query = '') => {
    const response = await client.get('/users', { params: { search: query } });
    return response.data;
};
