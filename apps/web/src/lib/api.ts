import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

function requestHadAuthorization(config: { headers?: unknown } | undefined): boolean {
  const headers = config?.headers;
  if (!headers || typeof headers !== 'object') return false;
  if ('get' in headers && typeof (headers as { get: (k: string) => unknown }).get === 'function') {
    const h = headers as { get: (k: string) => unknown };
    const a = h.get('Authorization') ?? h.get('authorization');
    return typeof a === 'string' && a.length > 0;
  }
  const rec = headers as Record<string, unknown>;
  const a = rec.Authorization ?? rec.authorization;
  return typeof a === 'string' && a.length > 0;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('askora_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadAuth = requestHadAuthorization(error.config);
      localStorage.removeItem('askora_token');
      if (hadAuth) {
        globalThis.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
