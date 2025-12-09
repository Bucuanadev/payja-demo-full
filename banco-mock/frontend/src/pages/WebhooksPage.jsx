import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Space,
  message,
  Divider,
  Alert,
  Tag,
  Table,
  Badge,
  Switch,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  HistoryOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function WebhooksPage() {
  const [config, setConfig] = useState({
    payjaBaseUrl: 'http://localhost:3000',
    disbursementEndpoint: '/api/v1/webhooks/banco/desembolso',
    paymentEndpoint: '/api/v1/webhooks/banco/pagamento',
    apiKey: '',
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [webhookHistory, setWebhookHistory] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/webhook/config');
      const data = await response.json();
      if (data.config) {
        setConfig(data.config);
        form.setFieldsValue(data.config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/webhook/history');
      const data = await response.json();
      setWebhookHistory(data.history || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const handleSaveConfig = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('Configuração salva com sucesso!');
        setConfig(values);
        loadConfig();
      } else {
        throw new Error('Erro ao salvar configuração');
      }
    } catch (error) {
      message.error('Erro ao salvar configuração');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async (type) => {
    setTestingWebhook(type);
    try {
      const endpoint = type === 'disbursement' 
        ? 'send/disbursement' 
        : 'send/payment';

      const testPayload = type === 'disbursement'
        ? {
            transactionId: 'TEST-' + Date.now(),
            loanId: 'LOAN-TEST-001',
            customerId: 'CUST-001',
            amount: 5000,
            status: 'completed',
            bankReference: 'BANK-REF-' + Date.now(),
          }
        : {
            transactionId: 'TEST-' + Date.now(),
            loanId: 'LOAN-TEST-001',
            installmentId: 'INST-001',
            amount: 1500,
            paymentMethod: 'bank_transfer',
            status: 'confirmed',
            bankReference: 'BANK-REF-' + Date.now(),
          };

      const response = await fetch(`/api/webhook/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Erro ao fazer parse do JSON:', jsonError);
        throw new Error('Resposta inválida do servidor');
      }

      if (data.success) {
        message.success(`Webhook de ${type === 'disbursement' ? 'desembolso' : 'pagamento'} enviado com sucesso!`);
        loadHistory();
      } else {
        message.error(`Erro: ${data.message || data.error || 'Falha ao enviar webhook'}`);
      }
    } catch (error) {
      message.error(`Erro ao testar webhook: ${error.message}`);
      console.error('Erro completo:', error);
    } finally {
      setTestingWebhook(null);
    }
  };

  const webhookColumns = [
    {
      title: 'Data/Hora',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => new Date(timestamp).toLocaleString('pt-BR'),
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type) => (
        <Tag color={type === 'disbursement' ? 'blue' : 'green'}>
          {type === 'disbursement' ? 'Desembolso' : 'Pagamento'}
        </Tag>
      ),
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Badge
          status={status === 'success' ? 'success' : 'error'}
          text={status === 'success' ? 'Sucesso' : 'Erro'}
        />
      ),
    },
    {
      title: 'Código',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      render: (code) => <Tag>{code}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="center">
            <ApiOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Webhooks PayJA
              </Title>
              <Text type="secondary">
                Configure os webhooks que o Banco GHW enviará para o PayJA
              </Text>
            </div>
          </Space>
        </Card>

        <Alert
          message="Informação sobre Webhooks"
          description={
            <Space direction="vertical">
              <Text>
                <strong>POST /api/v1/webhooks/banco/desembolso</strong> - Notifica o PayJA quando um desembolso é concluído
              </Text>
              <Text>
                <strong>POST /api/v1/webhooks/banco/pagamento</strong> - Notifica o PayJA quando um pagamento é recebido
              </Text>
            </Space>
          }
          type="info"
          showIcon
        />

        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Webhooks Enviados Hoje"
                value={webhookHistory.filter(w => {
                  const today = new Date().toDateString();
                  return new Date(w.timestamp).toDateString() === today;
                }).length}
                prefix={<SendOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Taxa de Sucesso"
                value={
                  webhookHistory.length > 0
                    ? Math.round((webhookHistory.filter(w => w.status === 'success').length / webhookHistory.length) * 100)
                    : 0
                }
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Status"
                value={config.enabled ? 'Ativo' : 'Inativo'}
                valueStyle={{ color: config.enabled ? '#3f8600' : '#cf1322' }}
                prefix={config.enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Configuração de Webhooks" extra={<SettingOutlined />}>
          <Form
            form={form}
            layout="vertical"
            initialValues={config}
            onFinish={handleSaveConfig}
          >
            <Form.Item
              label="URL Base do PayJA"
              name="payjaBaseUrl"
              rules={[
                { required: true, message: 'URL é obrigatória' },
                { type: 'url', message: 'URL inválida' },
              ]}
            >
              <Input placeholder="http://localhost:3000" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Endpoint de Desembolso"
                  name="disbursementEndpoint"
                  rules={[{ required: true, message: 'Endpoint é obrigatório' }]}
                >
                  <Input placeholder="/api/v1/webhooks/banco/desembolso" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Endpoint de Pagamento"
                  name="paymentEndpoint"
                  rules={[{ required: true, message: 'Endpoint é obrigatório' }]}
                >
                  <Input placeholder="/api/v1/webhooks/banco/pagamento" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="API Key (Chave de Autenticação)"
              name="apiKey"
              extra="Chave fornecida pelo PayJA para autenticação dos webhooks"
            >
              <Input.Password placeholder="banco-ghw-api-key-2025" />
            </Form.Item>

            <Form.Item label="Webhooks Ativos" name="enabled" valuePropName="checked">
              <Switch checkedChildren="Sim" unCheckedChildren="Não" />
            </Form.Item>

            <Divider />

            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Salvar Configuração
              </Button>
              <Button onClick={loadConfig}>
                Cancelar
              </Button>
            </Space>
          </Form>
        </Card>

        <Card
          title="Testar Webhooks"
          extra={<SendOutlined />}
        >
          <Alert
            message="Teste os webhooks antes de usar em produção"
            description="Envie webhooks de teste para o PayJA para verificar se a integração está funcionando corretamente."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Space size="large">
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={testingWebhook === 'disbursement'}
              onClick={() => testWebhook('disbursement')}
              disabled={!config.enabled}
            >
              Testar Webhook de Desembolso
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={testingWebhook === 'payment'}
              onClick={() => testWebhook('payment')}
              disabled={!config.enabled}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Testar Webhook de Pagamento
            </Button>
          </Space>
        </Card>

        <Card
          title="Histórico de Webhooks"
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadHistory}>
              Atualizar
            </Button>
          }
        >
          <Table
            columns={webhookColumns}
            dataSource={webhookHistory}
            rowKey={(record) => `${record.timestamp}-${record.type}`}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total de ${total} webhook(s)`,
            }}
          />
        </Card>
      </Space>
    </div>
  );
}
