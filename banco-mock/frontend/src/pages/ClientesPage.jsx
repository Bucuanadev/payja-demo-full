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
  Tabs,
  Badge,
  Typography,
  Alert,
  Tooltip,
} from 'antd';
import {
  UserAddOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  FileSearchOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

const ClientesPage = () => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clientes');
      setClientes(response.data.clientes || []);
    } catch (error) {
      message.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (record) => {
    setSelectedCliente(record);
    setIsModalVisible(true);
  };

  const handleEditCliente = (record) => {
    setSelectedCliente(record);
    form.setFieldsValue(record);
    setIsEditModalVisible(true);
  };

  const handleUpdateCliente = async (values) => {
    try {
      await api.patch(`/clientes/${selectedCliente.id}`, values);
      message.success('Cliente atualizado com sucesso!');
      form.resetFields();
      setIsEditModalVisible(false);
      loadData();
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
      loadData();
    } catch (error) {
      message.error(error.response?.data?.erro || 'Erro ao adicionar cliente');
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0 MZN';
    return `${Number(value).toLocaleString('pt-MZ')} MZN`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-PT');
    } catch (e) {
      return dateString;
    }
  };

  const getAprovadosPayja = () => clientes.filter(c => c.payja_decision === 'APPROVED' || c.payja_status === 'APROVADO');
  const getNaoAprovadosPayja = () => clientes.filter(c => c.payja_decision === 'REJECTED' || c.payja_status === 'REJEITADO');
  const getPendentes = () => clientes.filter(c => !c.payja_decision && !c.payja_status);

  const columns = [
    { title: 'NUIT', dataIndex: 'nuit', key: 'nuit', width: 120 },
    { title: 'Nome', dataIndex: 'nome_completo', key: 'nome_completo' },
    { title: 'Telefone', dataIndex: 'telefone', key: 'telefone', width: 130 },
    { 
      title: 'Tipo', 
      dataIndex: 'tipo_cliente', 
      key: 'tipo_cliente',
      render: (tipo) => <Tag color={tipo === 'ASSALARIADO' ? 'blue' : 'orange'}>{tipo || 'N/A'}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status_conta',
      key: 'status_conta',
      render: (status) => <Tag color={status === 'ATIVA' ? 'green' : 'red'}>{status || 'INATIVA'}</Tag>
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver Detalhes">
            <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetails(record)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEditCliente(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const items = [
    {
      key: '1',
      label: (
        <span>
          <TeamOutlined /> Todos <Badge count={clientes.length} offset={[10, -5]} size="small" />
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={clientes} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <CheckCircleOutlined /> Aprovados pelo PayJA <Badge count={getAprovadosPayja().length} offset={[10, -5]} size="small" style={{ backgroundColor: '#52c41a' }} />
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={getAprovadosPayja()} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <CloseCircleOutlined /> Não Aprovados pelo PayJA <Badge count={getNaoAprovadosPayja().length} offset={[10, -5]} size="small" style={{ backgroundColor: '#ff4d4f' }} />
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={getNaoAprovadosPayja()} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      ),
    },
    {
      key: '4',
      label: (
        <span>
          <HourglassOutlined /> Pendentes <Badge count={getPendentes().length} offset={[10, -5]} size="small" style={{ backgroundColor: '#faad14' }} />
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={getPendentes()} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Gestão de Clientes</Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>Atualizar</Button>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsAddModalVisible(true)}>Novo Cliente</Button>
            </Space>
          </div>
        }
      >
        <Tabs defaultActiveKey="1" items={items} />
      </Card>

      <Modal
        title="Dossiê do Cliente"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[<Button key="close" onClick={() => setIsModalVisible(false)}>Fechar</Button>]}
        width={800}
      >
        {selectedCliente && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Nome Completo" span={2}>{selectedCliente.nome_completo}</Descriptions.Item>
            <Descriptions.Item label="NUIT">{selectedCliente.nuit}</Descriptions.Item>
            <Descriptions.Item label="BI">{selectedCliente.bi}</Descriptions.Item>
            <Descriptions.Item label="Validade do B.I.">
              <Text strong style={{ color: new Date(selectedCliente.bi_validade) < new Date() ? '#ff4d4f' : 'inherit' }}>
                {formatDate(selectedCliente.bi_validade)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Telefone">{selectedCliente.telefone}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedCliente.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Conta Criada">{formatDate(selectedCliente.conta_criada_em)}</Descriptions.Item>
            <Descriptions.Item label="Status Conta">
              <Tag color={selectedCliente.status_conta === 'ATIVA' ? 'success' : 'error'}>
                {selectedCliente.status_conta || 'INATIVA'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Saldo">{formatCurrency(selectedCliente.saldo)}</Descriptions.Item>
            <Descriptions.Item label="Renda Mensal">{formatCurrency(selectedCliente.renda_mensal)}</Descriptions.Item>
            <Descriptions.Item label="Salário Domiciliado">{selectedCliente.salario_domiciliado ? 'SIM' : 'NÃO'}</Descriptions.Item>
            <Descriptions.Item label="Status Crédito">{selectedCliente.status_credito || 'LIMPO'}</Descriptions.Item>
            <Descriptions.Item label="Dívida Total">{formatCurrency(selectedCliente.divida_total)}</Descriptions.Item>
            
            {(selectedCliente.payja_status || selectedCliente.payja_decision) && (
              <>
                <Descriptions.Item label="Status PayJA" span={2}>
                  <Tag color={(selectedCliente.payja_status === 'APROVADO' || selectedCliente.payja_decision === 'APPROVED') ? 'green' : 'red'}>
                    {(selectedCliente.payja_status === 'APROVADO' || selectedCliente.payja_decision === 'APPROVED') ? 'APROVADO' : 'REJEITADO'}
                  </Tag>
                </Descriptions.Item>
                {(selectedCliente.payja_status === 'APROVADO' || selectedCliente.payja_decision === 'APPROVED') ? (
                  <Descriptions.Item label="Limite PayJA" span={2}>
                    <Text strong style={{ color: '#52c41a' }}>{formatCurrency(selectedCliente.payja_limit || selectedCliente.payja_credit_limit)}</Text>
                  </Descriptions.Item>
                ) : (
                  <Descriptions.Item label="Motivo Rejeição" span={2}>
                    <Text type="danger">{selectedCliente.payja_rejection_reason || selectedCliente.payja_reason || 'Requisitos não atendidos'}</Text>
                  </Descriptions.Item>
                )}
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={isEditModalVisible ? "Editar Cliente" : "Adicionar Novo Cliente"}
        open={isAddModalVisible || isEditModalVisible}
        onCancel={() => { setIsAddModalVisible(false); setIsEditModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={isEditModalVisible ? handleUpdateCliente : handleAddCliente}>
          <Form.Item name="nome_completo" label="Nome Completo" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="telefone" label="Telefone" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="renda_mensal" label="Renda Mensal"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientesPage;
