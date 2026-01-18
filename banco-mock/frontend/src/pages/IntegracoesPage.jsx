import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Statistic, Badge, Button, message, Spin, Typography, Divider, Alert, Space, Descriptions, Tabs } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  CodeOutlined,
  SendOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

function IntegracoesPage() {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [apiStatus, setApiStatus] = useState({});
  const [apiLogs, setApiLogs] = useState([]);

  const endpoints = [
    {
      key: 'health',
      nome: 'Health Check',
      endpoint: '/api/health',
      metodo: 'GET',
      descricao: 'Verifica status do sistema',
    },
    {
      key: 'validacao',
      nome: 'Validação de Elegibilidade',
      endpoint: '/api/validacao/verificar',
      metodo: 'POST',
      descricao: 'Verifica se cliente é elegível para empréstimo',
    },
    {
      key: 'capacidade',
      nome: 'Capacidade Financeira',
      endpoint: '/api/capacidade/consultar',
      metodo: 'POST',
      descricao: 'Consulta capacidade financeira do cliente',
    },
    {
      key: 'desembolso',
      nome: 'Desembolso',
      endpoint: '/api/desembolso/executar',
      metodo: 'POST',
      descricao: 'Executa desembolso para cliente',
    },
    {
      key: 'emprestimos',
      nome: 'Consulta Empréstimos',
      endpoint: '/api/emprestimos/consultar',
      metodo: 'POST',
      descricao: 'Consulta empréstimos do cliente',
    },
    {
      key: 'webhook',
      nome: 'Webhook Pagamento',
      endpoint: '/api/webhooks/pagamento',
      metodo: 'POST',
      descricao: 'Recebe notificação de pagamento',
    },
  ];

  const checkEndpointHealth = async (endpoint) => {
    const startTime = Date.now();
    
    try {
      let response;
      
      if (endpoint.metodo === 'GET') {
        response = await fetch(`http://155.138.227.26:4500${endpoint.endpoint}`);
      } else {
        // Para POST, fazer uma requisição de teste vazia
        response = await fetch(`http://155.138.227.26:4500${endpoint.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }
      
      const latency = Date.now() - startTime;
      const isOnline = response.status < 500;
      
      return {
        status: isOnline ? 'online' : 'offline',
        latency,
        statusCode: response.status,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        status: 'offline',
        latency,
        statusCode: 0,
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  };

  const loadHealthData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/health');
      setHealthData(response.data);
      
      // Verificar status de cada endpoint
      const statusPromises = endpoints.map(async (endpoint) => {
        const status = await checkEndpointHealth(endpoint);
        return { key: endpoint.key, ...status };
      });
      
      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(s => {
        statusMap[s.key] = s;
      });
      setApiStatus(statusMap);
      
    } catch (error) {
      console.error('Erro ao carregar health:', error);
      message.error('Erro ao verificar status das APIs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealthData();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusTag = (status) => {
    if (!status) return <Tag color="default">Verificando...</Tag>;
    
    switch (status.status) {
      case 'online':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Online • {status.latency}ms
          </Tag>
        );
      case 'offline':
        return (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Offline
          </Tag>
        );
      default:
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Verificando...
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: 'API',
      dataIndex: 'nome',
      key: 'nome',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (text, record) => (
        <Text code>
          <Tag color={record.metodo === 'GET' ? 'blue' : 'green'}>{record.metodo}</Tag>
          {text}
        </Text>
      ),
    },
    {
      title: 'Descrição',
      dataIndex: 'descricao',
      key: 'descricao',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => getStatusTag(apiStatus[record.key]),
    },
    {
      title: 'Última Verificação',
      key: 'lastCheck',
      render: (_, record) => {
        const status = apiStatus[record.key];
        if (!status?.lastCheck) return '-';
        
        const time = new Date(status.lastCheck);
        return time.toLocaleTimeString('pt-BR');
      },
    },
  ];

  const onlineCount = Object.values(apiStatus).filter(s => s.status === 'online').length;
  const offlineCount = Object.values(apiStatus).filter(s => s.status === 'offline').length;
  const avgLatency = Object.values(apiStatus).length > 0
    ? Object.values(apiStatus).reduce((sum, s) => sum + (s.latency || 0), 0) / Object.values(apiStatus).length
    : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <ApiOutlined /> Integrações API
          </Title>
          <Text type="secondary">Monitoramento e status das APIs do Banco Welli</Text>
        </div>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadHealthData}
          loading={loading}
        >
          Atualizar Status
        </Button>
      </div>

      {/* Health Overview */}
      {healthData && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Status do Sistema"
                value={healthData.status}
                valueStyle={{ color: healthData.status === 'online' ? '#3f8600' : '#cf1322' }}
                prefix={healthData.status === 'online' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Uptime"
                value={healthData.uptime_formatted}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Banco de Dados"
                value={healthData.database_status}
                valueStyle={{ color: healthData.database_status === 'online' ? '#3f8600' : '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Versão da API"
                value={healthData.api_version}
                prefix={<ApiOutlined />}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* API Status Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="APIs Online"
              value={onlineCount}
              suffix={`/ ${endpoints.length}`}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="APIs Offline"
              value={offlineCount}
              suffix={`/ ${endpoints.length}`}
              valueStyle={{ color: offlineCount > 0 ? '#cf1322' : '#999' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Latência Média"
              value={avgLatency.toFixed(0)}
              suffix="ms"
              valueStyle={{ color: avgLatency < 100 ? '#3f8600' : avgLatency < 500 ? '#faad14' : '#cf1322' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* API Endpoints Table */}
      <Card title="Endpoints Disponíveis" loading={loading}>
        <Table
          columns={columns}
          dataSource={endpoints}
          rowKey="key"
          pagination={false}
        />
      </Card>

      {/* Statistics */}
      {healthData?.statistics && (
        <Card title="Estatísticas de Uso" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total de Clientes"
                value={healthData.statistics.total_clientes}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total de Validações"
                value={healthData.statistics.total_validacoes}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total de Desembolsos"
                value={healthData.statistics.total_desembolsos}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Consultas de Capacidade"
                value={healthData.statistics.total_consultas_capacidade}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
}

export default IntegracoesPage;
