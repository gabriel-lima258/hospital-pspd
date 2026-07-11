import axios from 'axios';
import keycloak from './keycloak';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL,
});

// Interceptor para injetar o Token Bearer em todas as requisições
api.interceptors.request.use(
  async (config) => {
    if (keycloak.token) {
      try {
        // Atualiza o token se expirar em menos de 30 segundos
        await keycloak.updateToken(30);
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      } catch (error) {
        console.error('Falha ao atualizar token. Redirecionando para login...', error);
        keycloak.login();
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
