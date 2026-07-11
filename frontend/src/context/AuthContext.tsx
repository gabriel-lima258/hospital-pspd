import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import keycloak from '../services/keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | undefined;
  roles: string[];
  login: () => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required', // Redireciona para o login caso não autenticado
          pkceMethod: 'S256',
        });
        
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          // Extrai roles configuradas no Realm. 
          // O Keycloak injeta roles neste atributo
          const realmRoles = keycloak.realmAccess?.roles || [];
          setRoles(realmRoles);
        }
      } catch (error) {
        console.error('Falha ao inicializar o Keycloak', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initKeycloak();
  }, []);

  const login = () => keycloak.login();
  const logout = () => keycloak.logout();
  const hasRole = (role: string) => roles.includes(role);

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2>Iniciando sessão de autenticação...</h2>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, token: keycloak.token, roles, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
