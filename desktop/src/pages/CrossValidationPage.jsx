import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Tabs,
  Input,
  Modal,
  Form,
  Select,
  message,
  Descriptions,
  Badge,
  Divider,
} from 'antd';
import {
  UserOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { TabPane } = Tabs;
const { Search } = Input;

const CrossValidationPage = () => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersRes, accountsRes, statsRes] = await Promise.all([
        api.get('/cross-validation/mock/customers'),
        api.get('/cross-validation/mock/bank-accounts'),
        api.get('/cross-validation/mock/stats'),
      ]);

      setCustomers(customersRes.data);
      setBankAccounts(accountsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      message.error('Erro ao carregar dados mock');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (nuit) => {
    try {
      const response = await api.get(`/cross-validation/mock/customer/${nuit}`);
      setSelectedCustomer(response.data);
      setIsModalVisible(true);
    } catch (error) {
      message.error('Erro ao carregar detalhes do cliente');
    }
  };

  const handleAddCustomer = async (values) => {
    setAddLoading(true);
    try {
      // Formatar dados para o backend
      const customerData = {
        nuit: values.nuit,
        biNumber: values.biNumber,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        institution: values.institution,
        salary: parseFloat(values.salary),
        creditScore: parseInt(values.creditScore),
        accountStatus: values.accountStatus || 'ACTIVE',
        // Dados bancários
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        accountType: values.accountType,
        balance: parseFloat(values.balance),
        bankCreditLimit: parseFloat(values.bankCreditLimit),
      };

      await api.post('/cross-validation/mock/customer', customerData);
      message.success('Cliente e conta bancária adicionados com sucesso!');
      form.resetFields();
      setIsAddModalVisible(false);
      loadData();
    } catch (error) {
      message.error(error.response?.data?.message || 'Erro ao adicionar cliente');
      console.error(error);
    } finally {
      setAddLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'default';
      case 'BLOCKED':
        return 'error';
      default:
        return 'default';
    }
  };

  const customerColumns = [
    {
      title: 'NUIT',
      dataIndex: 'nuit',
      key: 'nuit',
      width: 120,
    },
    {
      title: 'Nome Completo',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Telefone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 140,
    },
    {
      title: 'Instituição',
      dataIndex: 'institution',
      key: 'institution',
    },
    {
      title: 'Salário',
      dataIndex: 'salary',
      key: 'salary',
      render: (salary) => `${salary?.toLocaleString()} MZN`,
      width: 130,
    },
    {
      title: 'Limite',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      render: (limit) => `${limit?.toLocaleString()} MZN`,
      width: 130,
    },
    {
      title: 'Score',
      dataIndex: 'creditScore',
      key: 'creditScore',
      width: 80,
    },
    {
      title: 'Risco',
      dataIndex: 'riskCategory',
      key: 'riskCategory',
      render: (risk) => <Tag color={getRiskColor(risk)}>{risk}</Tag>,
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'accountStatus',
      key: 'accountStatus',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
      width: 100,
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record.nuit)}
        >
          Ver
        </Button>
      ),
      width: 80,
    },
  ];

  const bankAccountColumns = [
    {
      title: 'Número da Conta',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 160,
    },
    {
      title: 'NUIT',
      dataIndex: 'nuit',
      key: 'nuit',
      width: 120,
    },
    {
      title: 'Titular',
      dataIndex: 'accountHolder',
      key: 'accountHolder',
    },
    {
      title: 'Banco',
      dataIndex: 'bank',
      key: 'bank',
    },
    {
      title: 'Tipo',
      dataIndex: 'accountType',
      key: 'accountType',
      width: 100,
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => `${balance?.toLocaleString()} MZN`,
      width: 130,
    },
    {
      title: 'Limite',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      render: (limit) => `${limit?.toLocaleString()} MZN`,
      width: 130,
    },
    {
      title: 'Status',
      dataIndex: 'accountStatus',
      key: 'accountStatus',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
      width: 100,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          Validação Cruzada - Dados Mock
        </h2>
        <p style={{ color: '#666', marginTop: 8 }}>
          Sistema de validação Emola ↔ Banco com 50 clientes fictícios para testes
        </p>
      </div>

      {/* Estatísticas */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Clientes"
                value={stats.totalCustomers}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Contas Bancárias"
                value={stats.totalBankAccounts}
                prefix={<BankOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Clientes Ativos"
                value={stats.activeCustomers}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Limite Médio"
                value={stats.avgCreditLimit}
                suffix="MZN"
                prefix={<BankOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Distribuição de Risco */}
      {stats && (
        <Card style={{ marginBottom: 24 }} title="Distribuição de Risco">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Baixo Risco"
                value={stats.riskDistribution.low}
                valueStyle={{ color: '#3f8600' }}
                suffix={`/ ${stats.totalCustomers}`}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Médio Risco"
                value={stats.riskDistribution.medium}
                valueStyle={{ color: '#faad14' }}
                suffix={`/ ${stats.totalCustomers}`}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Alto Risco"
                value={stats.riskDistribution.high}
                valueStyle={{ color: '#cf1322' }}
                suffix={`/ ${stats.totalCustomers}`}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabs com dados */}
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setIsAddModalVisible(true)}
            >
              Adicionar Cliente
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Atualizar
            </Button>
          </Space>
        </div>

        <Tabs defaultActiveKey="customers">
          <TabPane
            tab={
              <span>
                <UserOutlined />
                Clientes Emola ({customers.length})
              </span>
            }
            key="customers"
          >
            <Table
              columns={customerColumns}
              dataSource={customers}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1400 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <BankOutlined />
                Contas Bancárias ({bankAccounts.length})
              </span>
            }
            key="accounts"
          >
            <Table
              columns={bankAccountColumns}
              dataSource={bankAccounts}
              rowKey="accountNumber"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1300 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Modal de Cadastro */}
      <Modal
        title="Adicionar Cliente Mock"
        open={isAddModalVisible}
        onCancel={() => {
          setIsAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddCustomer}
        >
          <Divider orientation="left">Dados Pessoais</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="nuit"
                label="NUIT"
                rules={[
                  { required: true, message: 'NUIT obrigatório' },
                  { pattern: /^\d{9}$/, message: 'NUIT deve ter 9 dígitos' }
                ]}
              >
                <Input placeholder="123456789" maxLength={9} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="biNumber"
                label="Número do BI"
                rules={[
                  { required: true, message: 'BI obrigatório' },
                  { pattern: /^\d{13}[A-Z]$/, message: 'Formato: 13 dígitos + letra' }
                ]}
              >
                <Input placeholder="1234567890123N" maxLength={14} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="fullName"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome obrigatório' }]}
          >
            <Input placeholder="João da Silva" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phoneNumber"
                label="Telefone"
                rules={[
                  { required: true, message: 'Telefone obrigatório' },
                  { pattern: /^258\d{9}$/, message: 'Formato: 258XXXXXXXXX' }
                ]}
              >
                <Input placeholder="258840000000" maxLength={12} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Email obrigatório' },
                  { type: 'email', message: 'Email inválido' }
                ]}
              >
                <Input placeholder="joao.silva@exemplo.mz" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="institution"
            label="Instituição"
            rules={[{ required: true, message: 'Instituição obrigatória' }]}
          >
            <Select placeholder="Selecione a instituição">
              <Select.Option value="Ministério da Educação">Ministério da Educação</Select.Option>
              <Select.Option value="Ministério da Saúde">Ministério da Saúde</Select.Option>
              <Select.Option value="EDM">EDM</Select.Option>
              <Select.Option value="Banco de Moçambique">Banco de Moçambique</Select.Option>
              <Select.Option value="Hospital Central de Maputo">Hospital Central de Maputo</Select.Option>
              <Select.Option value="TDM">TDM</Select.Option>
              <Select.Option value="LAM">LAM</Select.Option>
              <Select.Option value="CFM">CFM</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="salary"
                label="Salário (MZN)"
                rules={[{ required: true, message: 'Salário obrigatório' }]}
              >
                <Input type="number" placeholder="15000" min={5000} max={100000} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="creditScore"
                label="Credit Score"
                rules={[{ required: true, message: 'Score obrigatório' }]}
                initialValue={650}
              >
                <Input type="number" placeholder="650" min={300} max={850} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="accountStatus"
                label="Status"
                initialValue="ACTIVE"
              >
                <Select>
                  <Select.Option value="ACTIVE">ACTIVE</Select.Option>
                  <Select.Option value="INACTIVE">INACTIVE</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Dados Bancários</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="bankName"
                label="Banco"
                rules={[{ required: true, message: 'Banco obrigatório' }]}
              >
                <Select placeholder="Selecione o banco">
                  <Select.Option value="Millennium BIM">Millennium BIM</Select.Option>
                  <Select.Option value="Standard Bank">Standard Bank</Select.Option>
                  <Select.Option value="BCI">BCI</Select.Option>
                  <Select.Option value="Absa">Absa</Select.Option>
                  <Select.Option value="Ecobank">Ecobank</Select.Option>
                  <Select.Option value="FNB">FNB</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="accountType"
                label="Tipo de Conta"
                initialValue="SALARY"
              >
                <Select>
                  <Select.Option value="SALARY">Salário</Select.Option>
                  <Select.Option value="SAVINGS">Poupança</Select.Option>
                  <Select.Option value="CURRENT">Corrente</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="accountNumber"
            label="Número da Conta"
            rules={[
              { required: true, message: 'Número da conta obrigatório' },
              { pattern: /^\d{10,16}$/, message: 'Entre 10 e 16 dígitos' }
            ]}
          >
            <Input placeholder="1234567890123456" maxLength={16} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="balance"
                label="Saldo (MZN)"
                rules={[{ required: true, message: 'Saldo obrigatório' }]}
                initialValue={5000}
              >
                <Input type="number" placeholder="5000" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="bankCreditLimit"
                label="Limite de Crédito (MZN)"
                rules={[{ required: true, message: 'Limite obrigatório' }]}
                initialValue={10000}
              >
                <Input type="number" placeholder="10000" min={500} max={50000} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsAddModalVisible(false);
                form.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={addLoading} icon={<PlusOutlined />}>
                Adicionar Cliente
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Detalhes */}
      <Modal
        title="Detalhes do Cliente"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Fechar
          </Button>,
        ]}
        width={800}
      >
        {selectedCustomer && (
          <>
            <Divider orientation="left">Dados Emola</Divider>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="NUIT">{selectedCustomer.customer?.nuit}</Descriptions.Item>
              <Descriptions.Item label="BI">{selectedCustomer.customer?.biNumber}</Descriptions.Item>
              <Descriptions.Item label="Nome Completo" span={2}>
                {selectedCustomer.customer?.fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Telefone">{selectedCustomer.customer?.phoneNumber}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedCustomer.customer?.email}</Descriptions.Item>
              <Descriptions.Item label="Instituição" span={2}>
                {selectedCustomer.customer?.institution}
              </Descriptions.Item>
              <Descriptions.Item label="Salário">
                {selectedCustomer.customer?.salary?.toLocaleString()} MZN
              </Descriptions.Item>
              <Descriptions.Item label="Limite de Crédito">
                {selectedCustomer.customer?.creditLimit?.toLocaleString()} MZN
              </Descriptions.Item>
              <Descriptions.Item label="Score de Crédito">
                {selectedCustomer.customer?.creditScore}
              </Descriptions.Item>
              <Descriptions.Item label="Categoria de Risco">
                <Tag color={getRiskColor(selectedCustomer.customer?.riskCategory)}>
                  {selectedCustomer.customer?.riskCategory}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status da Conta">
                <Tag color={getStatusColor(selectedCustomer.customer?.accountStatus)}>
                  {selectedCustomer.customer?.accountStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Empréstimos Ativos">
                {selectedCustomer.customer?.hasActiveLoans ? (
                  <Tag color="warning">Sim</Tag>
                ) : (
                  <Tag color="success">Não</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Dívida Total">
                {selectedCustomer.customer?.totalDebt?.toLocaleString()} MZN
              </Descriptions.Item>
              <Descriptions.Item label="Anos de Emprego">
                {selectedCustomer.customer?.employmentYears} anos
              </Descriptions.Item>
            </Descriptions>

            {selectedCustomer.bankAccount ? (
              <>
                <Divider orientation="left">Conta Bancária</Divider>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="Número da Conta" span={2}>
                    {selectedCustomer.bankAccount?.accountNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Banco" span={2}>
                    {selectedCustomer.bankAccount?.bank}
                  </Descriptions.Item>
                  <Descriptions.Item label="Titular" span={2}>
                    {selectedCustomer.bankAccount?.accountHolder}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tipo">
                    {selectedCustomer.bankAccount?.accountType}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={getStatusColor(selectedCustomer.bankAccount?.accountStatus)}>
                      {selectedCustomer.bankAccount?.accountStatus}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Saldo">
                    {selectedCustomer.bankAccount?.balance?.toLocaleString()} MZN
                  </Descriptions.Item>
                  <Descriptions.Item label="Limite de Crédito">
                    {selectedCustomer.bankAccount?.creditLimit?.toLocaleString()} MZN
                  </Descriptions.Item>
                  <Descriptions.Item label="Renda Mensal">
                    {selectedCustomer.bankAccount?.monthlyIncome?.toLocaleString()} MZN
                  </Descriptions.Item>
                  <Descriptions.Item label="Overdraft">
                    {selectedCustomer.bankAccount?.hasOverdraft ? (
                      <Tag color="warning">
                        Sim ({selectedCustomer.bankAccount?.overdraftAmount?.toLocaleString()} MZN)
                      </Tag>
                    ) : (
                      <Tag color="success">Não</Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </>
            ) : (
              <>
                <Divider orientation="left">Conta Bancária</Divider>
                <Badge status="error" text="Cliente não possui conta bancária" />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default CrossValidationPage;
