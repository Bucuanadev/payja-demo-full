import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import LoansPage from './pages/LoansPage';
import CustomersPage from './pages/CustomersPage';
import UssdSimulatorPage from './pages/UssdSimulatorPage';
import IntegrationsPage from './pages/IntegrationsPage';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/ussd-simulator" element={<UssdSimulatorPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
              </Routes>
            </DashboardLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
