import React, { useState } from 'react';
import { Layout, Menu, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SafetyOutlined,
  DollarOutlined,
  HistoryOutlined,
  BankOutlined,
  ApiOutlined,
  SendOutlined,
} from '@ant-design/icons';

import DashboardPage from './pages/DashboardPage';
import ClientesPage from './pages/ClientesPage';
import ValidacoesPage from './pages/ValidacoesPage';
import DesembolsosPage from './pages/DesembolsosPage';
import IntegracoesPage from './pages/IntegracoesPage';
import WebhooksPage from './pages/WebhooksPage';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'clientes':
        return <ClientesPage />;
      case 'validacoes':
        return <ValidacoesPage />;
      case 'desembolsos':
        return <DesembolsosPage />;
      case 'integracoes':
        return <IntegracoesPage />;
      case 'webhooks':
        return <WebhooksPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          background: '#001529',
        }}
      >
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <BankOutlined style={{ fontSize: 40, color: '#1890ff' }} />
          <Title level={4} style={{ color: 'white', marginTop: 10 }}>
            Banco GHW
          </Title>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
            Sistema Bancário
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          onClick={({ key }) => setCurrentPage(key)}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: 'Dashboard',
            },
            {
              key: 'clientes',
              icon: <UserOutlined />,
              label: 'Clientes',
            },
            {
              key: 'validacoes',
              icon: <SafetyOutlined />,
              label: 'Validações',
            },
            {
              key: 'desembolsos',
              icon: <DollarOutlined />,
              label: 'Desembolsos',
            },
            {
              key: 'integracoes',
              icon: <ApiOutlined />,
              label: 'Integrações',
            },
            {
              key: 'webhooks',
              icon: <SendOutlined />,
              label: 'Webhooks PayJA',
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            Banco GHW - Painel Administrativo
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge status="success" text="Sistema Online" />
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
              API: 155.138.227.26:4500
            </span>
          </div>
        </Header>

        <Content style={{ margin: '24px', minHeight: 280 }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
