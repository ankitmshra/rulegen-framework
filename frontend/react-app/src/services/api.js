import axios from 'axios';

// Function to get CSRF token from cookie
function getCsrfToken() {
  const name = 'csrftoken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  
  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return '';
}

// Create axios instance with defaults
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies and session authentication
});

// Add CSRF token to all requests
api.interceptors.request.use(config => {
  // Only add CSRF token for non-GET requests
  if (config.method !== 'get') {
    config.headers['X-CSRFToken'] = getCsrfToken();
  }
  return config;
});

// Auth endpoints
export const authAPI = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  logout: () => api.post('/auth/logout/'),
  getCurrentUser: () => api.get('/auth/user/'),
};

// Workspace endpoints
export const workspaceAPI = {
  getAll: () => api.get('/workspaces/'),
  getSummary: () => api.get('/workspaces/summary/'),
  getById: (id) => api.get(`/workspaces/${id}/`),
  create: (data) => api.post('/workspaces/', data),
  update: (id, data) => api.put(`/workspaces/${id}/`, data),
  delete: (id) => api.delete(`/workspaces/${id}/`),
  share: (data) => api.post('/workspace-shares/share_workspace/', data),
  removeShare: (data) => api.delete('/workspace-shares/remove_share/', { data }),
};

// Email file endpoints
export const emailFileAPI = {
  getAll: () => api.get('/email-files/'),
  getByWorkspace: (workspaceId) => api.get(`/email-files/?workspace=${workspaceId}`),
  upload: (formData) => api.post('/email-files/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  delete: (id) => api.delete(`/email-files/${id}/`),
  getAvailableHeaders: (workspaceId) => api.get(`/email-files/available_headers/?workspace=${workspaceId}`),
};

// Prompt template endpoints
export const promptTemplateAPI = {
  getAll: () => api.get('/prompt-templates/'),
  getBasePrompts: () => api.get('/prompt-templates/?is_base=true'),
  getPromptModules: () => api.get('/prompt-templates/?is_module=true'),
  getById: (id) => api.get(`/prompt-templates/${id}/`),
  create: (data) => api.post('/prompt-templates/', data),
  update: (id, data) => api.put(`/prompt-templates/${id}/`, data),
  delete: (id) => api.delete(`/prompt-templates/${id}/`),
};

// Rule generation endpoints
export const ruleGenerationAPI = {
  getAll: () => api.get('/rule-generations/'),
  getByWorkspace: (workspaceId) => api.get(`/rule-generations/?workspace=${workspaceId}`),
  getById: (id) => api.get(`/rule-generations/${id}/`),
  create: (data) => api.post('/rule-generations/', data),
  getStatus: (id) => api.get(`/rule-generations/${id}/status/`),
  generateDefaultPrompt: (data) => api.post('/rule-generations/generate_default_prompt/', data),
};

// User management endpoints (admin only)
export const userAPI = {
  getAll: (query = '') => api.get(`/users/${query}`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  search: (query) => api.get(`/users/search/?q=${query}`),
};

// Setup request interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If the error is 401 Unauthorized, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
