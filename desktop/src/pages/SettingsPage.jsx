import React, { useState } from 'react';
import { Card, Tabs, Form, Input, Button, Table, Space, Modal, Select, message, Popconfirm, Switch, InputNumber } from 'antd';
import { 
  UserAddOutlined, 
  ApiOutlined, 
  SettingOutlined, 
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { TabPane } = Tabs;
const { TextArea } = Input;

function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [paramModalVisible, setParamModalVisible] = useState(false);
  const [userForm] = Form.useForm();
  const [apiForm] = Form.useForm();
  const [paramForm] = Form.useForm();

  // ========== GESTÃO DE USUÁRIOS ==========
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      message.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (values) => {
    try {
      setLoading(true);
      await api.post('/admin/users', values);
      message.success('Usuário criado com sucesso!');
      setUserModalVisible(false);
      userForm.resetFields();
      loadUsers();
    } catch (error) {
      message.error(error.response?.data?.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      message.success('Usuário removido com sucesso!');
      loadUsers();
    } catch (error) {
      message.error('Erro ao remover usuário');
    }
  };

  const userColumns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Função', dataIndex: 'role', key: 'role' },
    { 
      title: 'Ativo', 
      dataIndex: 'active', 
      key: 'active',
      render: (active) => active ? '✓' : '✗',
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small">Editar</Button>
          <Popconfirm
            title="Tem certeza que deseja remover este usuário?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Button danger icon={<DeleteOutlined />} size="small">Remover</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ========== CONFIGURAÇÃO DE APIs ==========
  const [apiConfigs, setApiConfigs] = useState([
    { 
      key: '1',
      type: 'BANK',
      name: 'Letsego',
      endpoint: 'https://api.letsego.co.mz',
      status: 'inactive',
    },
    { 
      key: '2',
      type: 'BANK',
      name: 'Bayport',
      endpoint: 'https://api.bayport.co.mz',
      status: 'inactive',
    },
    { 
      key: '3',
      type: 'MOBILE',
      name: 'Movitel',
      endpoint: 'https://api.movitel.co.mz',
      status: 'active',
    },
    { 
      key: '4',
      type: 'MOBILE',
      name: 'Vodacom',
      endpoint: 'https://api.vodacom.co.mz',
      status: 'inactive',
    },
  ]);

  const handleCreateApi = async (values) => {
    try {
      setLoading(true);
      // Aqui você implementaria a chamada real à API
      const newApi = {
        key: Date.now().toString(),
        ...values,
        status: 'inactive',
      };
      setApiConfigs([...apiConfigs, newApi]);
      message.success('API configurada com sucesso!');
      setApiModalVisible(false);
      apiForm.resetFields();
    } catch (error) {
      message.error('Erro ao configurar API');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApiStatus = (key) => {
    setApiConfigs(apiConfigs.map(api => 
      api.key === key ? { ...api, status: api.status === 'active' ? 'inactive' : 'active' } : api
    ));
    message.success('Status da API atualizado!');
  };

  const apiColumns = [
    { title: 'Tipo', dataIndex: 'type', key: 'type' },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? 'green' : 'gray' }}>
          {status === 'active' ? '● Ativo' : '○ Inativo'}
        </span>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleToggleApiStatus(record.key)}
          >
            {record.status === 'active' ? 'Desativar' : 'Ativar'}
          </Button>
          <Button icon={<SettingOutlined />} size="small">Configurar</Button>
          <Popconfirm
            title="Tem certeza que deseja remover esta API?"
            okText="Sim"
            cancelText="Não"
          >
            <Button danger icon={<DeleteOutlined />} size="small">Remover</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ========== PARÂMETROS DO SISTEMA ==========
  const [parameters, setParameters] = useState([
    { key: '1', name: 'Taxa de Juros Padrão', value: '15', unit: '%', description: 'Taxa aplicada aos empréstimos' },
    { key: '2', name: 'Prazo Máximo', value: '12', unit: 'meses', description: 'Prazo máximo de empréstimo' },
    { key: '3', name: 'Valor Mínimo', value: '1000', unit: 'MZN', description: 'Valor mínimo de empréstimo' },
    { key: '4', name: 'Valor Máximo', value: '100000', unit: 'MZN', description: 'Valor máximo de empréstimo' },
    { key: '5', name: 'Comissão Emola', value: '3', unit: '%', description: 'Comissão da Emola' },
    { key: '6', name: 'Comissão PayJA', value: '3', unit: '%', description: 'Comissão da PayJA' },
    { key: '7', name: 'Comissão Banco', value: '8', unit: '%', description: 'Comissão do Banco' },
  ]);

  const handleUpdateParameter = (key, newValue) => {
    setParameters(parameters.map(param => 
      param.key === key ? { ...param, value: newValue } : param
    ));
    message.success('Parâmetro atualizado com sucesso!');
  };

  const paramColumns = [
    { title: 'Parâmetro', dataIndex: 'name', key: 'name' },
    { 
      title: 'Valor', 
      dataIndex: 'value', 
      key: 'value',
      render: (value, record) => `${value} ${record.unit}`,
    },
    { title: 'Descrição', dataIndex: 'description', key: 'description' },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Button 
          icon={<EditOutlined />} 
          size="small"
          onClick={() => {
            Modal.confirm({
              title: 'Editar Parâmetro',
              content: (
                <Form
                  initialValues={{ value: record.value }}
                  onFinish={(values) => {
                    handleUpdateParameter(record.key, values.value);
                    Modal.destroyAll();
                  }}
                >
                  <Form.Item name="value" label={record.name}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit">Salvar</Button>
                </Form>
              ),
              footer: null,
            });
          }}
        >
          Editar
        </Button>
      ),
    },
  ];

  // ========== RESET DE SIMULADORES ==========
  const handleResetSimulators = async () => {
    try {
      setLoading(true);
      await api.post('/admin/reset-test-data');
      message.success('Simuladores resetados com sucesso! Todos os dados de teste foram removidos.');
    } catch (error) {
      message.error('Erro ao resetar simuladores');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Definições</h1>
      
      <Tabs defaultActiveKey="users">
        {/* ABA: USUÁRIOS */}
        <TabPane 
          tab={
            <span>
              <UserAddOutlined />
              Usuários
            </span>
          } 
          key="users"
        >
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<UserAddOutlined />}
                onClick={() => setUserModalVisible(true)}
              >
                Criar Usuário
              </Button>
            </Space>
            
            <Table 
              columns={userColumns} 
              dataSource={users}
              loading={loading}
              rowKey="id"
            />
          </Card>
        </TabPane>

        {/* ABA: APIs E INTEGRAÇÕES */}
        <TabPane 
          tab={
            <span>
              <ApiOutlined />
              APIs & Integrações
            </span>
          } 
          key="apis"
        >
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<ApiOutlined />}
                onClick={() => setApiModalVisible(true)}
              >
                Nova API
              </Button>
            </Space>
            
            <Table 
              columns={apiColumns} 
              dataSource={apiConfigs}
              rowKey="key"
            />
          </Card>
        </TabPane>

        {/* ABA: PARÂMETROS */}
        <TabPane 
          tab={
            <span>
              <SettingOutlined />
              Parâmetros
            </span>
          } 
          key="parameters"
        >
          <Card>
            <Table 
              columns={paramColumns} 
              dataSource={parameters}
              rowKey="key"
            />
          </Card>
        </TabPane>

        {/* ABA: RESET DE DADOS DOS CLIENTES */}
        <TabPane 
          tab={
            <span>
              <ReloadOutlined />
              Reset de Dados dos Clientes
            </span>
          } 
          key="reset"
        >
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <h3>
                  <WarningOutlined style={{ color: 'orange', marginRight: 8 }} />
                  Reset de Dados dos Clientes
                </h3>
                <p>Esta ação irá remover todos os dados de clientes registados, incluindo:</p>
                <ul>
                  <li>Sessões USSD de números de teste (258860*)</li>
                  <li>Clientes de teste</li>
                  <li>Empréstimos de teste</li>
                  <li>SMS enviados para números de teste</li>
                  <li>Sessões e estados armazenados</li>
                </ul>
                <p><strong>ATENÇÃO:</strong> Esta ação não pode ser desfeita!</p>
              </div>

              <Popconfirm
                title="Tem certeza que deseja resetar os dados dos clientes?"
                description="Todos os dados de clientes registados serão permanentemente removidos."
                onConfirm={handleResetSimulators}
                okText="Sim, resetar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button 
                  danger 
                  icon={<ReloadOutlined />}
                  size="large"
                  loading={loading}
                >
                  Resetar Dados dos Clientes
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        </TabPane>
      </Tabs>

      {/* MODAL: CRIAR USUÁRIO */}
      <Modal
        title="Criar Novo Usuário"
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Form.Item
            name="name"
            label="Nome Completo"
            rules={[{ required: true, message: 'Digite o nome' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Digite o email' },
              { type: 'email', message: 'Email inválido' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Senha"
            rules={[{ required: true, message: 'Digite a senha' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="role"
            label="Função"
            rules={[{ required: true, message: 'Selecione a função' }]}
          >
            <Select>
              <Select.Option value="SUPER_ADMIN">Super Admin</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
              <Select.Option value="OPERATOR">Operador</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="active"
            label="Ativo"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Criar
              </Button>
              <Button onClick={() => setUserModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: CONFIGURAR API */}
      <Modal
        title="Configurar Nova API"
        open={apiModalVisible}
        onCancel={() => setApiModalVisible(false)}
        footer={null}
      >
        <Form
          form={apiForm}
          layout="vertical"
          onFinish={handleCreateApi}
        >
          <Form.Item
            name="type"
            label="Tipo"
            rules={[{ required: true, message: 'Selecione o tipo' }]}
          >
            <Select>
              <Select.Option value="BANK">Banco</Select.Option>
              <Select.Option value="MOBILE">Operadora Móvel</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Nome"
            rules={[{ required: true, message: 'Digite o nome' }]}
          >
            <Input placeholder="Ex: Letsego, Movitel" />
          </Form.Item>

          <Form.Item
            name="endpoint"
            label="Endpoint"
            rules={[{ required: true, message: 'Digite o endpoint' }]}
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
          >
            <Input.Password placeholder="Chave de autenticação" />
          </Form.Item>

          <Form.Item
            name="apiSecret"
            label="API Secret"
          >
            <Input.Password placeholder="Segredo de autenticação" />
          </Form.Item>

          <Form.Item
            name="config"
            label="Configuração JSON (Opcional)"
          >
            <TextArea 
              rows={4} 
              placeholder='{"timeout": 30000, "retries": 3}'
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Salvar
              </Button>
              <Button onClick={() => setApiModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SettingsPage;
