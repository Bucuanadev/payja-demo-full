import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  message,
  Tag,
  Popconfirm,
  Divider,
  Alert,
  Typography,
  Tooltip,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function BankPartnersPage() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [testingConnection, setTestingConnection] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bank-partners');
      setBanks(response.data);
    } catch (error) {
      message.error('Erro ao carregar bancos parceiros');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBank(null);
    form.resetFields();
    form.setFieldsValue({
      healthEndpoint: '/api/health',
      eligibilityEndpoint: '/api/validacao/verificar',
      capacityEndpoint: '/api/capacidade/consultar',
      disbursementEndpoint: '/api/desembolso/executar',
      loansEndpoint: '/api/emprestimos/consultar',
      webhookEndpoint: '/api/webhooks/pagamento',
      timeout: 30000,
      retryAttempts: 3,
      active: true,
    });
    setModalVisible(true);
  };

  const handleEdit = (bank) => {
    setEditingBank(bank);
    form.setFieldsValue(bank);
    setModalVisible(true);
  };

  const handleDelete = async (code) => {
    try {
      await api.delete(`/bank-partners/${code}`);
      message.success('Banco removido com sucesso');
      loadBanks();
    } catch (error) {
      message.error('Erro ao remover banco');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingBank) {
        await api.put(`/bank-partners/${editingBank.code}`, values);
        message.success('Banco atualizado com sucesso');
      } else {
        await api.post('/bank-partners', values);
        message.success('Banco criado com sucesso');
      }
      setModalVisible(false);
      loadBanks();
    } catch (error) {
      message.error(error.response?.data?.message || 'Erro ao salvar banco');
      console.error(error);
    }
  };

  const testConnection = async (code) => {
    setTestingConnection({ ...testingConnection, [code]: true });
    try {
      const response = await api.post(`/bank-partners/${code}/test-connection`);
      
      if (response.data.success) {
        message.success(`Conexão com ${code} estabelecida com sucesso!`);
        loadBanks(); // Atualizar status
      } else {
        message.error(`Falha na conexão: ${response.data.message}`);
      }
    } catch (error) {
      message.error(`Erro ao testar conexão: ${error.response?.data?.message || error.message}`);
    } finally {
      setTestingConnection({ ...testingConnection, [code]: false });
    }
  };

  const columns = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code) => <Text strong>{code}</Text>,
    },
    {
      title: 'Nome do Banco',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text>{name}</Text>,
    },
    {
      title: 'URL da API',
      dataIndex: 'apiUrl',
      key: 'apiUrl',
      ellipsis: true,
      render: (url) => <Text code copyable>{url}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.active ? 'success' : 'default'}>
            {record.active ? 'Ativo' : 'Inativo'}
          </Tag>
          {record.verified && (
            <Tag color="blue" icon={<CheckCircleOutlined />}>
              Verificado
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Health Check',
      key: 'health',
      width: 150,
      render: (_, record) => {
        if (!record.lastHealthCheck) {
          return <Text type="secondary">Não testado</Text>;
        }

        const status = record.lastHealthStatus;
        const color = status === 'ONLINE' ? 'success' : 'error';
        const icon = status === 'ONLINE' ? <CheckCircleOutlined /> : <CloseCircleOutlined />;

        return (
          <Space direction="vertical" size={0}>
            <Tag color={color} icon={icon}>
              {status}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(record.lastHealthCheck).toLocaleString('pt-BR')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Taxa de Sucesso',
      key: 'successRate',
      width: 130,
      render: (_, record) => {
        if (record.totalRequests === 0) {
          return <Text type="secondary">Sem dados</Text>;
        }

        const rate = record.successRate;
        const color = rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'error';

        return (
          <Tooltip title={`${record.successfulRequests}/${record.totalRequests} requisições`}>
            <Tag color={color}>{rate}%</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="Testar Conexão">
            <Button
              type="link"
              icon={<ApiOutlined />}
              loading={testingConnection[record.code]}
              onClick={() => testConnection(record.code)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Tem certeza que deseja remover este banco?"
            onConfirm={() => handleDelete(record.code)}
            okText="Sim"
            cancelText="Não"
          >
            <Tooltip title="Deletar">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = {
    total: banks.length,
    active: banks.filter(b => b.active).length,
    verified: banks.filter(b => b.verified).length,
    online: banks.filter(b => b.lastHealthStatus === 'ONLINE').length,
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3}>
              <ApiOutlined /> Bancos Parceiros
            </Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadBanks}>
                Atualizar
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Adicionar Banco
              </Button>
            </Space>
          </div>

          <Alert
            message="Integração Universal de Bancos"
            description="Adicione qualquer banco parceiro manualmente. Basta configurar o nome, URL da API e os endpoints."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />

          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total de Bancos"
                  value={stats.total}
                  prefix={<ApiOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Bancos Ativos"
                  value={stats.active}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Verificados"
                  value={stats.verified}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Online"
                  value={stats.online}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={banks}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total de ${total} banco(s)`,
            }}
          />
        </Space>
      </Card>

      <Modal
        title={editingBank ? 'Editar Banco Parceiro' : 'Adicionar Banco Parceiro'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="Código do Banco"
            name="code"
            rules={[
              { required: true, message: 'Código é obrigatório' },
              { pattern: /^[A-Z0-9_]+$/, message: 'Use apenas letras maiúsculas, números e _' },
            ]}
            extra="Ex: GHW, BCI, STANDARD_BANK"
          >
            <Input placeholder="GHW" disabled={!!editingBank} />
          </Form.Item>

          <Form.Item
            label="Nome do Banco"
            name="name"
            rules={[{ required: true, message: 'Nome é obrigatório' }]}
          >
            <Input placeholder="Banco GHW" />
          </Form.Item>

          <Form.Item
            label="URL da API"
            name="apiUrl"
            rules={[
              { required: true, message: 'URL é obrigatória' },
              { type: 'url', message: 'URL inválida' },
            ]}
          >
            <Input placeholder="http://localhost:4500" />
          </Form.Item>

          <Form.Item
            label="API Key (opcional)"
            name="apiKey"
          >
            <Input.Password placeholder="Chave de autenticação" />
          </Form.Item>

          <Divider>Endpoints</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Health Check" name="healthEndpoint">
                <Input placeholder="/api/health" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Elegibilidade" name="eligibilityEndpoint">
                <Input placeholder="/api/validacao/verificar" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Capacidade" name="capacityEndpoint">
                <Input placeholder="/api/capacidade/consultar" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Desembolso" name="disbursementEndpoint">
                <Input placeholder="/api/desembolso/executar" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Empréstimos" name="loansEndpoint">
                <Input placeholder="/api/emprestimos/consultar" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Webhook" name="webhookEndpoint">
                <Input placeholder="/api/webhooks/pagamento" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Configurações Avançadas</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Timeout (ms)" name="timeout">
                <InputNumber min={1000} max={120000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tentativas de Retry" name="retryAttempts">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Descrição" name="description">
            <TextArea rows={2} placeholder="Informações adicionais sobre o banco" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email de Contato" name="contactEmail">
                <Input type="email" placeholder="contato@banco.co.mz" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Telefone de Contato" name="contactPhone">
                <Input placeholder="+258 84 123 4567" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ativo" name="active" valuePropName="checked">
            <Switch checkedChildren="Sim" unCheckedChildren="Não" />
          </Form.Item>

          <Divider />

          <Space style={{ float: 'right' }}>
            <Button onClick={() => setModalVisible(false)}>
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit">
              {editingBank ? 'Atualizar' : 'Criar'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
