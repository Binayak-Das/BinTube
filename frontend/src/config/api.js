const defaultBackendUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://bintube-server.vercel.app';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || defaultBackendUrl
).replace(/\/+$/, '');

export const apiUrl = (endpoint) => {
  if (!endpoint) return API_BASE_URL;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};

export default apiUrl;
