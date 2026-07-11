import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import api from './services/api';

const App: React.FC = () => {
  const { isAuthenticated, roles, logout, hasRole, token } = useAuth();
  const [patientData, setPatientData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const fetchPatients = async () => {
    try {
      setError('');
      // Testando a rota do API Gateway para carregar pacientes. 
      // O interceptor injetará o Bearer Token automaticamente!
      const response = await api.get('/fhir/Patient');
      setPatientData(response.data);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar pacientes. Verifique o console.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <h1>Hospital Dashboard</h1>
        <p>Iniciando autenticação com Keycloak...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Hospital Dashboard</h1>
        <button onClick={logout} style={styles.logoutBtn}>Sair</button>
      </header>

      <section style={styles.card}>
        <h2>Seu Perfil</h2>
        <p><strong>Status:</strong> Autenticado</p>
        <p>
          <strong>Permissões (Roles):</strong> {roles.length > 0 ? roles.join(', ') : 'Nenhuma Role detectada'}
        </p>

        <div style={styles.rolesContainer}>
          {hasRole('MEDICO') && <span style={{...styles.badge, backgroundColor: '#005f73'}}>Médico</span>}
          {hasRole('ESTAGIARIO') && <span style={{...styles.badge, backgroundColor: '#0a9396'}}>Estagiário</span>}
          {hasRole('PESQUISADOR') && <span style={{...styles.badge, backgroundColor: '#94d2bd'}}>Pesquisador</span>}
        </div>
      </section>

      <section style={styles.card}>
        <h2>Teste de API Integrada (Gateway)</h2>
        <p>Ao clicar no botão abaixo, o <code>Axios</code> utilizará o token automaticamente.</p>
        <button onClick={fetchPatients} style={styles.actionBtn}>
          Buscar <code>/fhir/Patient</code>
        </button>

        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

        {patientData && (
          <div style={styles.responseContainer}>
            <pre>{JSON.stringify(patientData, null, 2)}</pre>
          </div>
        )}
      </section>
      
      {/* 
        Para debug visual do Token Bearer:
        <details>
          <summary>Ver Token Bruto</summary>
          <pre>{token}</pre>
        </details>
      */}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    marginBottom: '20px'
  },
  badge: {
    padding: '5px 10px',
    borderRadius: '15px',
    color: '#fff',
    fontSize: '14px',
    marginRight: '10px'
  },
  rolesContainer: {
    marginTop: '10px',
    display: 'flex'
  },
  actionBtn: {
    padding: '10px 15px',
    backgroundColor: '#0a9396',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  logoutBtn: {
    padding: '8px 12px',
    backgroundColor: '#e63946',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  responseContainer: {
    marginTop: '15px',
    backgroundColor: '#f1f1f1',
    padding: '15px',
    borderRadius: '8px',
    overflowX: 'auto' as 'auto',
    fontSize: '14px'
  }
};

export default App;
