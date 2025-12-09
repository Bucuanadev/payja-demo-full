import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import LoansPage from './pages/LoansPage';
import CustomersPage from './pages/CustomersPage';
import UssdSimulatorPage from './pages/UssdSimulatorPage';
import SmsSimulatorPage from './pages/SmsSimulatorPage';
import IntegrationsPage from './pages/IntegrationsPage';
import BankPartnersPage from './pages/BankPartnersPage';
import SettingsPage from './pages/SettingsPage';
import MockControlPage from './pages/MockControlPage';
import CrossValidationPage from './pages/CrossValidationPage';

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
                <Route path="/sms-simulator" element={<SmsSimulatorPage />} />
                <Route path="/cross-validation" element={<CrossValidationPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/bank-partners" element={<BankPartnersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/mock-control" element={<MockControlPage />} />
              </Routes>
            </DashboardLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
