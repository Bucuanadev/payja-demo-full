import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Descriptions,
} from 'antd';
import {
  UserAddOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const ClientesPage = () => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clientes');
      setClientes(response.data.clientes || []);
    } catch (error) {
      message.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (clienteId) => {
    try {
      const response = await api.get(`/clientes/${clienteId}`);
      setSelectedCliente(response.data);
      setIsModalVisible(true);
    } catch (error) {
      message.error('Erro ao carregar detalhes');
    }
  };

  const handleEditCliente = async (clienteId) => {
    try {
      const response = await api.get(`/clientes/${clienteId}`);
      setSelectedCliente(response.data);
      form.setFieldsValue(response.data.cliente);
      setIsEditModalVisible(true);
    } catch (error) {
      message.error('Erro ao carregar dados para edição');
    }
  };

  const handleUpdateCliente = async (values) => {
    try {
      await api.patch(`/clientes/${selectedCliente.cliente.id}`, values);
      message.success('Cliente atualizado com sucesso!');
      form.resetFields();
      setIsEditModalVisible(false);
      loadClientes();
    } catch (error) {
      message.error(error.response?.data?.erro || 'Erro ao atualizar cliente');
    }
  };

  const handleAddCliente = async (values) => {
    try {
      await api.post('/clientes', values);
      message.success('Cliente adicionado com sucesso!');
      form.resetFields();
      setIsAddModalVisible(false);
      loadClientes();
    } catch (error) {
      message.error(error.response?.data?.erro || 'Erro ao adicionar cliente');
    }
  };

  const columns = [
    {
      title: 'NUIT',
      dataIndex: 'nuit',
      key: 'nuit',
      width: 120,
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome',
    },
    {
      title: 'Telefone',
      dataIndex: 'telefone',
      key: 'telefone',
    },
    {
      title: 'Conta',
      dataIndex: 'numero_conta',
      key: 'conta',
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      render: (saldo) => `${saldo?.toLocaleString()} MZN`,
    },
    {
      title: 'Limite',
      dataIndex: 'limite_credito',
      key: 'limite',
      render: (limite) => `${limite?.toLocaleString()} MZN`,
    },
    {
      title: 'Score',
      dataIndex: 'score_credito',
      key: 'score',
      render: (score) => (
        <Tag color={score >= 700 ? 'success' : score >= 600 ? 'warning' : 'error'}>
          {score}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status_conta',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ATIVA' ? 'success' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record.id)}
          >
            Ver
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditCliente(record.id)}
          >
            Editar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Gestão de Clientes"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setIsAddModalVisible(true)}
            >
              Novo Cliente
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadClientes}>
              Atualizar
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={clientes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>

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
        {selectedCliente && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="NUIT">{selectedCliente.cliente.nuit}</Descriptions.Item>
            <Descriptions.Item label="BI">{selectedCliente.cliente.bi}</Descriptions.Item>
            <Descriptions.Item label="Nome Completo" span={2}>
              {selectedCliente.cliente.nome_completo}
            </Descriptions.Item>
            <Descriptions.Item label="Telefone">{selectedCliente.cliente.telefone}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedCliente.cliente.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Empregador" span={2}>
              {selectedCliente.cliente.empregador || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Número da Conta" span={2}>
              {selectedCliente.cliente.numero_conta}
            </Descriptions.Item>
            <Descriptions.Item label="Tipo de Conta">{selectedCliente.cliente.tipo_conta}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedCliente.cliente.status_conta === 'ATIVA' ? 'success' : 'default'}>
                {selectedCliente.cliente.status_conta}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Saldo">
              {selectedCliente.cliente.saldo.toLocaleString()} MZN
            </Descriptions.Item>
            <Descriptions.Item label="Limite de Crédito">
              {selectedCliente.cliente.limite_credito.toLocaleString()} MZN
            </Descriptions.Item>
            <Descriptions.Item label="Score de Crédito">
              {selectedCliente.cliente.score_credito}
            </Descriptions.Item>
            <Descriptions.Item label="Renda Mensal">
              {selectedCliente.cliente.renda_mensal.toLocaleString()} MZN
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Modal de Editar */}
      <Modal
        title="Editar Cliente"
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateCliente}>
          <Form.Item
            name="nuit"
            label="NUIT"
            rules={[{ required: true, message: 'NUIT obrigatório' }]}
          >
            <Input placeholder="100234567" maxLength={9} disabled />
          </Form.Item>

          <Form.Item
            name="bi"
            label="Número do BI"
            rules={[{ required: true, message: 'BI obrigatório' }]}
          >
            <Input placeholder="1234567890123N" maxLength={14} disabled />
          </Form.Item>

          <Form.Item
            name="nome_completo"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome obrigatório' }]}
          >
            <Input placeholder="João da Silva" />
          </Form.Item>

          <Form.Item
            name="telefone"
            label="Telefone"
            rules={[{ required: true, message: 'Telefone obrigatório' }]}
          >
            <Input placeholder="258841234567" maxLength={12} />
          </Form.Item>

          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="joao@email.mz" />
          </Form.Item>

          <Form.Item
            name="numero_conta"
            label="Número da Conta"
            rules={[{ required: true, message: 'Número da conta obrigatório' }]}
          >
            <Input placeholder="0001000000001" disabled />
          </Form.Item>

          <Form.Item name="empregador" label="Empregador">
            <Input placeholder="Ministério da Educação" />
          </Form.Item>

          <Form.Item name="saldo" label="Saldo">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="limite_credito" label="Limite de Crédito">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="score_credito" label="Score de Crédito">
            <InputNumber style={{ width: '100%' }} min={300} max={850} />
          </Form.Item>

          <Form.Item name="renda_mensal" label="Renda Mensal">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="tipo_conta" label="Tipo de Conta">
            <Select>
              <Select.Option value="CORRENTE">Corrente</Select.Option>
              <Select.Option value="SALARIO">Salário</Select.Option>
              <Select.Option value="POUPANCA">Poupança</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="status_conta" label="Status da Conta">
            <Select>
              <Select.Option value="ATIVA">Ativa</Select.Option>
              <Select.Option value="INATIVA">Inativa</Select.Option>
              <Select.Option value="BLOQUEADA">Bloqueada</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsEditModalVisible(false);
                form.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" icon={<EditOutlined />}>
                Guardar Alterações
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Adicionar */}
      <Modal
        title="Adicionar Novo Cliente"
        open={isAddModalVisible}
        onCancel={() => {
          setIsAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleAddCliente}>
          <Form.Item
            name="nuit"
            label="NUIT"
            rules={[{ required: true, message: 'NUIT obrigatório' }]}
          >
            <Input placeholder="100234567" maxLength={9} />
          </Form.Item>

          <Form.Item
            name="bi"
            label="Número do BI"
            rules={[{ required: true, message: 'BI obrigatório' }]}
          >
            <Input placeholder="1234567890123N" maxLength={14} />
          </Form.Item>

          <Form.Item
            name="nome_completo"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome obrigatório' }]}
          >
            <Input placeholder="João da Silva" />
          </Form.Item>

          <Form.Item
            name="telefone"
            label="Telefone"
            rules={[{ required: true, message: 'Telefone obrigatório' }]}
          >
            <Input placeholder="258841234567" maxLength={12} />
          </Form.Item>

          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="joao@email.mz" />
          </Form.Item>

          <Form.Item
            name="numero_conta"
            label="Número da Conta"
            rules={[{ required: true, message: 'Número da conta obrigatório' }]}
          >
            <Input placeholder="0001000000001" />
          </Form.Item>

          <Form.Item name="empregador" label="Empregador">
            <Input placeholder="Ministério da Educação" />
          </Form.Item>

          <Form.Item name="saldo" label="Saldo Inicial" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="limite_credito" label="Limite de Crédito" initialValue={10000}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="score_credito" label="Score de Crédito" initialValue={650}>
            <InputNumber style={{ width: '100%' }} min={300} max={850} />
          </Form.Item>

          <Form.Item name="renda_mensal" label="Renda Mensal" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="tipo_conta" label="Tipo de Conta" initialValue="CORRENTE">
            <Select>
              <Select.Option value="CORRENTE">Corrente</Select.Option>
              <Select.Option value="SALARIO">Salário</Select.Option>
              <Select.Option value="POUPANCA">Poupança</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsAddModalVisible(false);
                form.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>
                Adicionar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientesPage;
