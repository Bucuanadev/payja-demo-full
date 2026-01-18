import axios from 'axios';

const API_BASE_URL = 'http://155.138.227.26:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const authStore = JSON.parse(localStorage.getItem('payja-auth') || '{}');
  if (authStore?.state?.token) {
    config.headers.Authorization = `Bearer ${authStore.state.token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('payja-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
