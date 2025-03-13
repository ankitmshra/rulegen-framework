import axios from 'axios';

// Create an axios instance
const api = axios.create({
    baseURL: '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to include CSRF token
api.interceptors.request.use(
    (config) => {
        // Get CSRF token
        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            config.headers['X-CSRFToken'] = csrfToken;
        }

        // For multipart/form-data (file uploads), let the browser set the content type
        // with the correct boundary
        if (config.data instanceof FormData) {
            config.headers['Content-Type'] = undefined;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Helper function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export default api;
