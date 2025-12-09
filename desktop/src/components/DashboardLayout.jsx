import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
  DashboardOutlined,
  DollarOutlined,
  UserOutlined,
  MobileOutlined,
  MessageOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApiOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/loans',
      icon: <DollarOutlined />,
      label: 'Empréstimos',
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: 'Clientes',
    },
    {
      key: '/ussd-simulator',
      icon: <MobileOutlined />,
      label: 'Simulador USSD',
    },
    {
      key: '/sms-simulator',
      icon: <MessageOutlined />,
      label: 'Simulador SMS',
    },
    {
      key: '/cross-validation',
      icon: <CheckCircleOutlined />,
      label: 'Validação Cruzada',
    },
    {
      key: '/integrations',
      icon: <ApiOutlined />,
      label: 'Integrações',
    },
    {
      key: '/bank-partners',
      icon: <ApiOutlined />,
      label: 'Bancos Parceiros',
    },
    {
      key: '/mock-control',
      icon: <ExperimentOutlined />,
      label: 'Mock Control',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Definições',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Meu Perfil',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sair',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{ 
          height: 64, 
          margin: 16, 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'PJ' : 'PayJA'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff', marginRight: 8 }}>
                {user?.name?.charAt(0) || 'A'}
              </Avatar>
              <span>{user?.name || 'Administrador'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ 
          margin: '24px 16px',
          padding: 24,
          background: '#f0f2f5',
          overflow: 'auto',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default DashboardLayout;
