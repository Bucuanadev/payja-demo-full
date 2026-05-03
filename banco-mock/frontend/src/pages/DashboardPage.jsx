import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, message, Typography } from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentValidacoes, setRecentValidacoes] = useState([]);
  const [recentDesembolsos, setRecentDesembolsos] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ last_pull: null, last_loans: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientesRes, validacoesRes, desembolsosRes, syncRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/validacao/historico'),
        api.get('/desembolso/historico'),
        api.get('/sync/status'),
      ]);

      const clientes = clientesRes.data.clientes || [];
      const validacoes = validacoesRes.data.validacoes || [];
      const desembolsos = desembolsosRes.data.desembolsos || [];

      const aprovados = clientes.filter(c => c.payja_decision === 'APPROVED' || c.payja_status === 'APROVADO').length;
      const rejeitados = clientes.filter(c => c.payja_decision === 'REJECTED' || c.payja_status === 'REJEITADO').length;

      setStats({
        total_clientes: clientes.length,
        clientes_ativos: clientes.filter(c => c.status_conta === 'ATIVA').length,
        aprovados_payja: aprovados,
        rejeitados_payja: rejeitados,
        validacoes_hoje: validacoes.filter(v => 
          new Date(v.criado_em).toDateString() === new Date().toDateString()
        ).length,
        desembolsos_sucesso: desembolsos.filter(d => d.status === 'CONCLUIDO').length,
        valor_total: desembolsos
          .filter(d => d.status === 'CONCLUIDO')
          .reduce((sum, d) => sum + (d.valor || 0), 0),
        score_medio: clientes.length > 0 ? Math.round(
          clientes.reduce((sum, c) => sum + (c.score_credito || 0), 0) / clientes.length
        ) : 0,
      });

      setRecentValidacoes(validacoes.slice(0, 5));
      setRecentDesembolsos(desembolsos.slice(0, 5));
      
      const syncData = syncRes.data?.data || syncRes.data || {};
      setSyncStatus({
        last_pull: syncData.last_payja_pull_at,
        last_loans: syncData.last_payja_loans_sync_at,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      message.error('Falha ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const validacoesColumns = [
    {
      title: 'NUIT',
      dataIndex: 'nuit',
      key: 'nuit',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'APROVADO' || status === 'APPROVED' ? 'success' : 'error'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Limite',
      dataIndex: 'limite_aprovado',
      key: 'limite',
      render: (limite) => (limite !== undefined && limite !== null) ? Number(limite).toLocaleString() + ' MZN' : '-',
    },
    {
      title: 'Data',
      dataIndex: 'criado_em',
      key: 'data',
      render: (data) => new Date(data).toLocaleString('pt-MZ'),
    },
  ];

  const desembolsosColumns = [
    {
      title: 'Cliente',
      dataIndex: 'nome_completo',
      key: 'cliente',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
      render: (valor) => (valor !== undefined && valor !== null) ? Number(valor).toLocaleString() + ' MZN' : '0 MZN',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          CONCLUIDO: 'success',
          PROCESSANDO: 'processing',
          PENDENTE: 'warning',
          ERRO: 'error',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size='large' tip='Carregando Dashboard...' />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3} style={{ marginBottom: 24 }}>Dashboard Financeiro</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Total de Clientes'
              value={stats?.total_clientes || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Aprovados PayJA'
              value={stats?.aprovados_payja || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Rejeitados PayJA'
              value={stats?.rejeitados_payja || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Valor Desembolsado'
              value={stats?.valor_total || 0}
              prefix={<DollarOutlined />}
              suffix='MZN'
              precision={0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size='small'>
            <Statistic
              title='Último Pull PayJA'
              value={syncStatus.last_pull ? new Date(syncStatus.last_pull).toLocaleString('pt-MZ') : '—'}
              valueStyle={{ fontSize: 14 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size='small'>
            <Statistic
              title='Score Médio'
              value={stats?.score_medio || 0}
              valueStyle={{ fontSize: 14 }}
              prefix={<RiseOutlined />}
              suffix='/ 850'
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size='small'>
            <Statistic
              title='Validações Hoje'
              value={stats?.validacoes_hoje || 0}
              valueStyle={{ fontSize: 14 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title='Validações Recentes' size='small'>
            <Table
              dataSource={recentValidacoes}
              columns={validacoesColumns}
              rowKey='id'
              pagination={false}
              size='small'
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title='Desembolsos Recentes' size='small'>
            <Table
              dataSource={recentDesembolsos}
              columns={desembolsosColumns}
              rowKey='id'
              pagination={false}
              size='small'
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
