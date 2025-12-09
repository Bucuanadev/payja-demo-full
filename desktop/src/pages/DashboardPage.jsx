import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Typography } from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

function DashboardPage() {
  const [stats, setStats] = useState({});
  const [recentLoans, setRecentLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data.stats);
      setRecentLoans(response.data.recentLoans);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Cliente',
      dataIndex: ['customer', 'phoneNumber'],
      key: 'customer',
    },
    {
      title: 'Canal',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel) => (
        <Tag color={channel === 'MOVITEL' ? 'blue' : 'green'}>
          {channel || 'APP'}
        </Tag>
      ),
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `${amount.toLocaleString('pt-MZ')} MZN`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          PENDING: 'orange',
          ANALYZING: 'blue',
          APPROVED: 'green',
          REJECTED: 'red',
          DISBURSED: 'cyan',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Score',
      dataIndex: ['scoring', 'finalScore'],
      key: 'score',
      render: (score) => score || '-',
    },
    {
      title: 'Data',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString('pt-PT'),
    },
  ];

  return (
    <div>
      <Title level={2}>Dashboard</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total de Clientes"
              value={stats.totalCustomers}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Empréstimos Pendentes"
              value={stats.pendingLoans}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Empréstimos Aprovados"
              value={stats.approvedLoans}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Desembolsado"
              value={stats.totalDisbursed}
              prefix={<DollarOutlined />}
              suffix="MZN"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Empréstimos Recentes" loading={loading}>
        <Table
          columns={columns}
          dataSource={recentLoans}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default DashboardPage;
