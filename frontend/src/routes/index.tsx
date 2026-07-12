import React from "react"
import { Routes, Route } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { DashboardLayout } from "@/layouts/DashboardLayout"

// Lazy-loaded pages
import { Dashboard } from "@/pages/Dashboard"
import { Patients } from "@/pages/Patients"
import { PatientDetail } from "@/pages/PatientDetail"
import { Profile } from "@/pages/Profile"
import { Settings } from "@/pages/Settings"
import { Favorites } from "@/pages/Favorites"
import { History } from "@/pages/History"
import { AccessDeniedPage, NotFoundPage } from "@/pages/Errors"

interface ProtectedRouteProps {
  children: React.ReactElement
  allowedRoles?: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, roles } = useAuth()

  if (!isAuthenticated) {
    // Redirecionamento automático gerenciado no AuthProvider (Keycloak.init onLoad: 'login-required')
    return null
  }

  if (allowedRoles) {
    const hasPermission = allowedRoles.some((role) => roles.includes(role))
    if (!hasPermission) {
      return (
        <DashboardLayout>
          <AccessDeniedPage />
        </DashboardLayout>
      )
    }
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Home / Dashboard (Acessível por todos autenticados) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Listagem de Pacientes (Médico e Estagiário) */}
      <Route
        path="/patients"
        element={
          <ProtectedRoute allowedRoles={["MEDICO", "ESTAGIARIO"]}>
            <Patients />
          </ProtectedRoute>
        }
      />

      {/* Detalhes do Paciente */}
      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute allowedRoles={["MEDICO", "ESTAGIARIO"]}>
            <PatientDetail />
          </ProtectedRoute>
        }
      />

      {/* Perfil (Acessível por todos) */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Configurações (Acessível por todos) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Favoritos (Acessível por todos) */}
      <Route
        path="/favorites"
        element={
          <ProtectedRoute>
            <Favorites />
          </ProtectedRoute>
        }
      />

      {/* Histórico de buscas (Acessível por todos) */}
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />

      {/* Fallback 404 */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFoundPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
