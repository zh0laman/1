import axios from 'axios';
import { API_URL } from '../config/runtime';

const client = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add access token
client.interceptors.request.use(
    (config) => {
        config.withCredentials = true;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // specific check for 401 and that we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Call the refresh endpoint
                await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
                originalRequest.withCredentials = true;
                return client(originalRequest);
            } catch (refreshError) {
                // Refresh failed, logout
                console.error("Token refresh failed", refreshError);
                handleLogout();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Do not redirect to login if viewing a public editor page
    // Do not redirect to login if viewing a public editor page or public share page
    if (!window.location.pathname.startsWith('/editor/') &&
        !window.location.pathname.startsWith('/editor-external/') &&
        !window.location.pathname.startsWith('/share/')) {
        window.location.href = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/login';


    }
}

export default client;
