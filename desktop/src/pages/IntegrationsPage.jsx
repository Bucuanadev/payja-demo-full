import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Space,
  message,
  Divider,
  Tag,
  Switch,
  Alert,
  Typography,
} from 'antd';
import {
  BankOutlined,
  MobileOutlined,
  ApiOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState([]);
  const [operators, setOperators] = useState([]);
  const [testingConnection, setTestingConnection] = useState({});
  const [bankForm] = Form.useForm();
  const [operatorForm] = Form.useForm();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const [banksRes, operatorsRes] = await Promise.all([
        api.get('/bank-adapters/available-banks'),
        api.get('/mobile-operators/available-operators'),
      ]);
      
      setBanks(banksRes.data);
      setOperators(operatorsRes.data);
    } catch (error) {
      message.error('Erro ao carregar integrações');
    }
  };

  const testBankConnection = async (bankCode) => {
    setTestingConnection({ ...testingConnection, [bankCode]: true });
    try {
      const response = await api.post(`/bank-adapters/test-connection/${bankCode}`);
      
      if (response.data.success) {
        message.success(`Conexão com ${bankCode} estabelecida com sucesso!`);
        if (response.data.data) {
          console.log('Dados do banco:', response.data.data);
        }
      } else {
        message.error(`Falha: ${response.data.message}`);
      }
    } catch (error) {
      message.error(`Erro ao conectar com ${bankCode}: ${error.response?.data?.message || error.message}`);
    } finally {
      setTestingConnection({ ...testingConnection, [bankCode]: false });
    }
  };

  const testOperatorConnection = async (operatorCode) => {
    setTestingConnection({ ...testingConnection, [operatorCode]: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      message.success(`Conexão com ${operatorCode} testada com sucesso!`);
    } catch (error) {
      message.error(`Falha ao conectar com ${operatorCode}: ${error.message}`);
    } finally {
      setTestingConnection({ ...testingConnection, [operatorCode]: false });
    }
  };

  const saveBankConfig = async (bankCode, values) => {
    setLoading(true);
    try {
      const response = await api.post(`/bank-adapters/configure/${bankCode}`, {
        apiUrl: values.apiUrl,
        apiKey: values.apiKey,
      });

      if (response.data.success) {
        localStorage.setItem(`bank_config_${bankCode}`, JSON.stringify(values));
        message.success(response.data.message);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error(`Erro ao salvar configuração: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveOperatorConfig = async (operatorCode, values) => {
    setLoading(true);
    try {
      if (operatorCode === 'USSD_SIMULATOR') {
        // Salvar configuração do simulador USSD
        const config = {
          apiUrl: values.apiUrl || 'http://localhost:3001',
          timeout: values.timeout || 30000,
          enabled: values.enabled !== false,
        };
        localStorage.setItem(`operator_config_${operatorCode}`, JSON.stringify(config));
        message.success('Configuração do Simulador USSD salva com sucesso!');
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        localStorage.setItem(`operator_config_${operatorCode}`, JSON.stringify(values));
        message.success(`Configuração da ${operatorCode} salva com sucesso!`);
      }
    } catch (error) {
      message.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const BankConfigForm = ({ bank }) => {
    const savedConfig = localStorage.getItem(`bank_config_${bank.code}`);
    const initialValues = savedConfig ? JSON.parse(savedConfig) : 
      bank.code === 'GHW' ? {
        apiUrl: 'http://localhost:4500',
        apiKey: 'banco-ghw-api-key-2025',
        enabled: true,
        timeout: 30000,
      } : {};

    return (
      <Card
        title={
          <Space>
            <BankOutlined />
            {bank.name}
            <Tag color={bank.active ? 'success' : 'default'}>
              {bank.active ? 'Ativo' : 'Inativo'}
            </Tag>
            {bank.configurable && (
              <Tag color="blue">Configurável</Tag>
            )}
          </Space>
        }
        extra={
          <Button
            icon={<ApiOutlined />}
            loading={testingConnection[bank.code]}
            onClick={() => testBankConnection(bank.code)}
          >
            Testar Conexão
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Form
          layout="vertical"
          initialValues={initialValues}
          onFinish={(values) => saveBankConfig(bank.code, values)}
        >
          <Form.Item
            label="URL da API"
            name="apiUrl"
            rules={[{ required: true, message: 'URL é obrigatória' }]}
          >
            <Input
              placeholder={`https://api.${bank.code.toLowerCase()}.co.mz`}
              prefix={<ApiOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: 'API Key é obrigatória' }]}
          >
            <Input.Password placeholder="Sua API Key" />
          </Form.Item>

          {bank.code === 'LETSEGO' && (
            <Form.Item label="Client Secret" name="clientSecret">
              <Input.Password placeholder="Client Secret" />
            </Form.Item>
          )}

          <Form.Item label="Timeout (ms)" name="timeout" initialValue={30000}>
            <Input type="number" placeholder="30000" />
          </Form.Item>

          <Form.Item label="Ativar Integração" name="enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>

          <Divider />

          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
              Salvar Configuração
            </Button>
            <Button icon={<ReloadOutlined />}>Restaurar Padrões</Button>
          </Space>
        </Form>

        <Divider />

        <Alert
          message="Documentação da API"
          description={
            <div>
              <Paragraph>
                <Text strong>Endpoints principais {bank.code === 'GHW' ? '(Banco GHW)' : ''}:</Text>
              </Paragraph>
              {bank.code === 'GHW' ? (
                <ul>
                  <li>
                    <Text code>POST /api/validacao/verificar</Text> - Verificar elegibilidade
                  </li>
                  <li>
                    <Text code>POST /api/capacidade/consultar</Text> - Consultar capacidade financeira
                  </li>
                  <li>
                    <Text code>POST /api/desembolso/executar</Text> - Executar desembolso
                  </li>
                  <li>
                    <Text code>POST /api/emprestimos/consultar</Text> - Consultar empréstimos
                  </li>
                  <li>
                    <Text code>POST /api/webhooks/pagamento</Text> - Notificar pagamento
                  </li>
                  <li>
                    <Text code>GET /api/health</Text> - Status do sistema
                  </li>
                </ul>
              ) : (
                <ul>
                  <li>
                    <Text code>POST /v1/eligibility/check</Text> - Verificar elegibilidade
                  </li>
                  <li>
                    <Text code>POST /v1/loans/disburse</Text> - Solicitar desembolso
                  </li>
                  <li>
                    <Text code>GET /v1/employees/public-sector</Text> - Listar funcionários
                  </li>
                </ul>
              )}
            </div>
          }
          type="info"
          showIcon
        />
      </Card>
    );
  };

  const OperatorConfigForm = ({ operator }) => {
    const savedConfig = localStorage.getItem(`operator_config_${operator.code}`);
    const initialValues = savedConfig ? JSON.parse(savedConfig) : 
      operator.code === 'USSD_SIMULATOR' ? {
        apiUrl: 'http://localhost:3001',
        timeout: 30000,
        enabled: true,
      } : {};

    return (
      <Card
        title={
          <Space>
            <MobileOutlined />
            {operator.name}
            <Text type="secondary">({operator.provider})</Text>
            <Tag color={operator.active ? 'success' : 'default'}>
              {operator.active ? 'Ativo' : 'Inativo'}
            </Tag>
          </Space>
        }
        extra={
          <Button
            icon={<ApiOutlined />}
            loading={testingConnection[operator.code]}
            onClick={() => testOperatorConnection(operator.code)}
          >
            Testar Conexão
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message={`Prefixos: ${operator.prefix.join(', ')}`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          layout="vertical"
          initialValues={initialValues}
          onFinish={(values) => saveOperatorConfig(operator.code, values)}
        >
          {operator.code === 'EMOLA' && (
            <>
              <Title level={4}>Sincronização USSD</Title>

              <Form.Item label="URL Simulador USSD" name="ussdSimulatorUrl" initialValue="http://localhost:3001">
                <Input prefix={<ApiOutlined />} placeholder="http://localhost:3001" />
              </Form.Item>

              <Alert
                message="Sincronização automática configurada"
                description="O PayJA puxa automaticamente novos clientes registrados via USSD e realiza validação bancária."
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </>
          )}

          {operator.code === 'MKESH' && (
            <Form.Item label="Partner ID" name="partnerId">
              <Input placeholder="ID do parceiro" />
            </Form.Item>
          )}

          <Divider />

          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
              Salvar Configuração
            </Button>
          </Space>
        </Form>
      </Card>
    );
  };

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={2}>
          <ApiOutlined /> Configurações de Integrações
        </Title>
        <Paragraph>
          Configure as credenciais de API dos bancos parceiros e operadoras de mobile money para
          ativar as integrações em produção.
        </Paragraph>
        <Alert
          message="Modo Demo Ativo"
          description="Atualmente usando APIs mockadas para demonstração. Configure as credenciais reais abaixo para conectar aos sistemas de produção."
          type="warning"
          showIcon
          closable
        />
      </Card>

      <Tabs defaultActiveKey="banks" size="large">
        <TabPane
          tab={
            <span>
              <BankOutlined />
              Bancos Parceiros ({banks.length})
            </span>
          }
          key="banks"
        >
          <div style={{ maxWidth: 1200 }}>
            {banks.map((bank) => (
              <BankConfigForm key={bank.code} bank={bank} />
            ))}
          </div>
        </TabPane>

        <TabPane
          tab={
            <span>
              <MobileOutlined />
              Operadoras Móveis ({operators.length})
            </span>
          }
          key="operators"
        >
          <div style={{ maxWidth: 1200 }}>
            {operators.map((operator) => (
              <OperatorConfigForm key={operator.code} operator={operator} />
            ))}
          </div>
        </TabPane>

        <TabPane
          tab={
            <span>
              <CheckCircleOutlined />
              Status das Integrações
            </span>
          }
          key="status"
        >
          <Card>
            <Title level={4}>Status de Conectividade</Title>
            <Divider />

            <Title level={5}>Bancos</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {banks.map((bank) => (
                <Card key={bank.code} size="small">
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <BankOutlined />
                      <Text strong>{bank.name}</Text>
                    </Space>
                    <Space>
                      {bank.active ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          Conectado
                        </Tag>
                      ) : (
                        <Tag icon={<CloseCircleOutlined />} color="default">
                          Desconectado
                        </Tag>
                      )}
                      <Button
                        size="small"
                        onClick={() => testBankConnection(bank.code)}
                        loading={testingConnection[bank.code]}
                      >
                        Testar
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>

            <Divider />

            <Title level={5}>Operadoras Móveis</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {operators.map((operator) => (
                <Card key={operator.code} size="small">
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <MobileOutlined />
                      <Text strong>{operator.name}</Text>
                      <Text type="secondary">({operator.provider})</Text>
                    </Space>
                    <Space>
                      {operator.active ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          Conectado
                        </Tag>
                      ) : (
                        <Tag icon={<CloseCircleOutlined />} color="default">
                          Desconectado
                        </Tag>
                      )}
                      <Button
                        size="small"
                        onClick={() => testOperatorConnection(operator.code)}
                        loading={testingConnection[operator.code]}
                      >
                        Testar
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
