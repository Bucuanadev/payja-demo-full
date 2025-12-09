import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Button, Select, Switch, Alert, Statistic, 
  Table, Tag, Space, message, Divider, Tooltip 
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SafetyOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  SettingOutlined,
  ApiOutlined,
  UserOutlined,
  BarChartOutlined,
  BellOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const MockControlPage = () => {
  const [activeScenario, setActiveScenario] = useState('HAPPY_PATH');
  const [mockApisEnabled, setMockApisEnabled] = useState(true);
  const [responseTime, setResponseTime] = useState(1000);
  const [successRate, setSuccessRate] = useState(95);
  const [statistics, setStatistics] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 1000,
  });
  const [mockCustomers, setMockCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const scenarios = [
    { 
      value: 'HAPPY_PATH', 
      label: 'Fluxo Feliz (Tudo funciona)', 
      color: 'green',
      icon: <CheckCircleOutlined />,
    },
    { 
      value: 'DATA_MISMATCH', 
      label: 'Dados Não Batem', 
      color: 'orange',
      icon: <WarningOutlined />,
    },
    { 
      value: 'BANK_REJECTION', 
      label: 'Banco Rejeita', 
      color: 'red',
      icon: <CloseCircleOutlined />,
    },
    { 
      value: 'EMOLA_TIMEOUT', 
      label: 'Timeout Emola', 
      color: 'purple',
      icon: <ClockCircleOutlined />,
    },
    { 
      value: 'INSUFFICIENT_FUNDS', 
      label: 'Fundos Insuficientes', 
      color: 'volcano',
      icon: <DollarOutlined />,
    },
    { 
      value: 'FRAUD_DETECTED', 
      label: 'Fraude Detectada', 
      color: 'magenta',
      icon: <SafetyOutlined />,
    },
  ];

  useEffect(() => {
    loadMockCustomers();
    loadStatistics();
  }, []);

  const loadMockCustomers = async () => {
    try {
      const response = await api.get('/mock/customers');
      setMockCustomers(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes mock:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await api.get('/mock/statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleScenarioChange = async (scenario) => {
    setLoading(true);
    try {
      await api.post('/mock/scenario/set', { scenario });
      setActiveScenario(scenario);
      message.success(`Cenário alterado para: ${scenarios.find(s => s.value === scenario)?.label}`);
    } catch (error) {
      message.error('Erro ao alterar cenário');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseTimeChange = async (time) => {
    try {
      await api.post('/mock/scenario/response-time', { responseTime: time });
      setResponseTime(time);
      message.success(`Tempo de resposta alterado para ${time}ms`);
    } catch (error) {
      message.error('Erro ao alterar tempo de resposta');
    }
  };

  const handleResetScenario = async () => {
    setLoading(true);
    try {
      await api.post('/mock/scenario/reset');
      setActiveScenario('HAPPY_PATH');
      setResponseTime(1000);
      setSuccessRate(95);
      message.success('Cenário resetado para padrão');
    } catch (error) {
      message.error('Erro ao resetar cenário');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerWebhook = async (type) => {
    setLoading(true);
    try {
      const response = await api.post('/mock/webhook/simulate', { type });
      message.success(`Webhook ${type} simulado com sucesso`);
      console.log('Webhook data:', response.data);
    } catch (error) {
      message.error('Erro ao simular webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyNuit = (nuit) => {
    navigator.clipboard.writeText(nuit);
    message.success('NUIT copiado!');
  };

  const customerColumns = [
    {
      title: 'NUIT',
      dataIndex: 'nuit',
      key: 'nuit',
      render: (nuit) => (
        <Space>
          <code style={{ fontSize: '12px' }}>{nuit}</code>
          <Button 
            size="small" 
            icon={<CopyOutlined />}
            onClick={() => handleCopyNuit(nuit)}
          />
        </Space>
      ),
    },
    {
      title: 'Nome',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Instituição',
      dataIndex: 'institution',
      key: 'institution',
      ellipsis: true,
    },
    {
      title: 'Salário',
      dataIndex: 'salary',
      key: 'salary',
      render: (salary) => `${salary.toLocaleString()} MZN`,
    },
    {
      title: 'Score',
      dataIndex: 'creditScore',
      key: 'creditScore',
      render: (score) => (
        <Tag color={score > 700 ? 'green' : score > 600 ? 'orange' : 'red'}>
          {score}
        </Tag>
      ),
    },
    {
      title: 'Risco',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (risk) => {
        const colors = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red' };
        return <Tag color={colors[risk]}>{risk}</Tag>;
      },
    },
  ];

  const activeScenarioInfo = scenarios.find(s => s.value === activeScenario);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>
          <ExperimentOutlined style={{ marginRight: '8px' }} />
          Painel de Controle - APIs Mock
        </h1>
        <Space>
          <Tooltip title="Recarregar dados">
            <Button icon={<ReloadOutlined />} onClick={loadStatistics} />
          </Tooltip>
          <Button 
            type="primary" 
            danger 
            onClick={handleResetScenario}
            loading={loading}
          >
            Reset para Padrão
          </Button>
        </Space>
      </div>

      <Alert
        message="Modo Desenvolvimento - Mocks Ativos"
        description="Todas as APIs externas estão sendo simuladas. Nenhuma chamada real está sendo feita a bancos ou Emola."
        type="info"
        showIcon
        icon={<ApiOutlined />}
        style={{ marginBottom: '24px' }}
        closable
      />
      
      <Row gutter={[16, 16]}>
        {/* Configuração Principal */}
        <Col span={16}>
          <Card title={<><SettingOutlined /> Configuração dos Mocks</>}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: '24px' }}>
                  <strong>Status dos Mocks:</strong>
                  <br />
                  <Switch 
                    checked={mockApisEnabled}
                    onChange={setMockApisEnabled}
                    checkedChildren="Mocks ATIVOS"
                    unCheckedChildren="Mocks INATIVOS"
                    style={{ marginTop: '8px' }}
                  />
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <strong>Cenário Ativo:</strong>
                  <br />
                  <Select
                    value={activeScenario}
                    onChange={handleScenarioChange}
                    style={{ width: '100%', marginTop: '8px' }}
                    loading={loading}
                    options={scenarios.map(s => ({
                      value: s.value,
                      label: (
                        <span style={{ color: s.color }}>
                          {s.icon} {s.label}
                        </span>
                      ),
                    }))}
                  />
                  {activeScenarioInfo && (
                    <Alert
                      message={activeScenarioInfo.label}
                      type={activeScenarioInfo.color === 'green' ? 'success' : 'warning'}
                      style={{ marginTop: '8px', fontSize: '12px' }}
                      showIcon
                    />
                  )}
                </div>
                
                <div>
                  <strong>Tempo de Resposta Simulado:</strong>
                  <br />
                  <Select
                    value={responseTime}
                    onChange={handleResponseTimeChange}
                    style={{ width: '100%', marginTop: '8px' }}
                    options={[
                      { value: 200, label: 'Muito Rápido (200ms)', icon: <ThunderboltOutlined /> },
                      { value: 500, label: 'Rápido (500ms)' },
                      { value: 1000, label: 'Normal (1s)' },
                      { value: 2000, label: 'Lento (2s)' },
                      { value: 5000, label: 'Muito Lento (5s)' },
                    ]}
                  />
                </div>
              </Col>
              
              <Col span={12}>
                <Card title={<><BellOutlined /> Simular Webhooks</>} size="small" style={{ marginBottom: '16px' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button 
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleTriggerWebhook('DISBURSEMENT')}
                      style={{ width: '100%' }}
                      loading={loading}
                    >
                      Webhook - Desembolso Sucesso
                    </Button>
                    
                    <Button 
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleTriggerWebhook('REJECTION')}
                      style={{ width: '100%' }}
                      loading={loading}
                    >
                      Webhook - Rejeição Banco
                    </Button>
                    
                    <Button 
                      icon={<ClockCircleOutlined />}
                      onClick={() => handleTriggerWebhook('TIMEOUT')}
                      style={{ width: '100%' }}
                      loading={loading}
                    >
                      Webhook - Timeout API
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        
        {/* Estatísticas */}
        <Col span={8}>
          <Card title={<><BarChartOutlined /> Estatísticas</>} size="small">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic 
                  title="Requisições" 
                  value={statistics.totalRequests} 
                  suffix="total"
                  valueStyle={{ fontSize: '20px' }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="Taxa Sucesso" 
                  value={Math.round((statistics.successfulRequests / statistics.totalRequests) * 100) || 0}
                  suffix="%"
                  valueStyle={{ color: '#3f8600', fontSize: '20px' }}
                />
              </Col>
              <Col span={24}>
                <Statistic 
                  title="Tempo Médio" 
                  value={responseTime}
                  suffix="ms"
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ fontSize: '20px' }}
                />
              </Col>
            </Row>

            <Divider />

            <div style={{ fontSize: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '4px' }} />
                Sucesso: <strong>{statistics.successfulRequests}</strong>
              </div>
              <div>
                <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: '4px' }} />
                Falhas: <strong>{statistics.failedRequests}</strong>
              </div>
            </div>
          </Card>
        </Col>
        
        {/* Clientes Mock */}
        <Col span={24}>
          <Card 
            title={<><UserOutlined /> Clientes Mock Disponíveis</>}
            extra={
              <Tag color="blue" icon={<UserOutlined />}>{mockCustomers.length} clientes</Tag>
            }
          >
            <Table
              dataSource={mockCustomers}
              columns={customerColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MockControlPage;
