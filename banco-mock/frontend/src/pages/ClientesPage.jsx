import React, { useState, useEffect } from 'react';
import {
  Table, Card, Tag, Button, Space, Typography, Modal, Descriptions,
  Alert, Form, Input, InputNumber, Select, Switch, Popconfirm,
  Divider, Row, Col, Statistic, Badge, Tooltip, message, Spin,
  Steps, Progress
} from 'antd';
import {
  EyeOutlined, UserAddOutlined, DeleteOutlined, EditOutlined,
  DollarCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, BankOutlined, SafetyOutlined, PhoneOutlined,
  IdcardOutlined, MailOutlined, TeamOutlined, SyncOutlined,
  ExclamationCircleOutlined, FileSearchOutlined, CreditCardOutlined,
  SendOutlined, HistoryOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;

function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [pagamentoVisible, setPagamentoVisible] = useState(false);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [pagamentoStep, setPagamentoStep] = useState(0);
  const [pagamentoResult, setPagamentoResult] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pagamentoForm] = Form.useForm();

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/clientes');
      setClientes(res.data.clientes || []);
    } catch (err) {
      message.error('Erro ao carregar clientes: ' + (err.response?.data?.erro || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ─── CRIAR CLIENTE ───────────────────────────────────────────
  const handleCreate = async (values) => {
    try {
      setSubmitLoading(true);
      const payload = {
        nuit: values.nuit,
        bi: values.bi,
        bi_validade: values.bi_validade,
        nome_completo: values.nome_completo,
        telefone: values.telefone,
        email: values.email || '',
        numero_conta: values.numero_conta,
        tipo_conta: values.tipo_conta || 'SALARIO',
        status_conta: values.status_conta ? 'ATIVA' : 'INATIVA',
        saldo: values.saldo || 0,
        renda_mensal: values.renda_mensal || 0,
        salario_domiciliado: values.salario_domiciliado || false,
        tipo_cliente: values.tipo_cliente || 'ASSALARIADO',
        status_credito: values.status_credito || 'LIMPO',
        divida_total: values.divida_total || 0,
        score_credito: values.score_credito || 600,
        historico_pagamentos: values.historico_pagamentos || 'BOM',
        tem_emprestimo_ativo: false,
      };
      await api.post('/clientes', payload);
      message.success('✅ Cliente criado e enviado ao PayJA para análise!');
      addForm.resetFields();
      setAddVisible(false);
      fetchClientes();
    } catch (err) {
      message.error('Erro ao criar cliente: ' + (err.response?.data?.erro || err.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── EDITAR CLIENTE ──────────────────────────────────────────
  const openEdit = (cliente) => {
    setSelectedCliente(cliente);
    editForm.setFieldsValue({
      nome_completo: cliente.nome_completo,
      telefone: cliente.telefone,
      email: cliente.email,
      renda_mensal: cliente.renda_mensal,
      saldo: cliente.saldo,
      status_conta: cliente.status_conta === 'ATIVA',
      salario_domiciliado: cliente.salario_domiciliado,
      status_credito: cliente.status_credito,
      score_credito: cliente.score_credito,
      historico_pagamentos: cliente.historico_pagamentos,
      divida_total: cliente.divida_total,
    });
    setEditVisible(true);
  };

  const handleEdit = async (values) => {
    try {
      setSubmitLoading(true);
      const payload = {
        ...values,
        status_conta: values.status_conta ? 'ATIVA' : 'INATIVA',
      };
      await api.patch(`/clientes/${selectedCliente.id}`, payload);
      message.success('✅ Cliente actualizado e PayJA notificado!');
      setEditVisible(false);
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── TOGGLE STATUS ───────────────────────────────────────────
  const handleToggleStatus = async (cliente) => {
    try {
      const novoStatus = cliente.status_conta === 'ATIVA' ? 'INATIVA' : 'ATIVA';
      await api.patch(`/clientes/${cliente.id}`, { status_conta: novoStatus });
      message.success(`Conta ${novoStatus === 'ATIVA' ? 'activada' : 'desactivada'} com sucesso`);
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
    }
  };

  // ─── APAGAR CLIENTE ──────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/clientes/${id}`);
      message.success('Cliente removido com sucesso');
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
    }
  };

  // ─── SIMULAR PAGAMENTO ───────────────────────────────────────
  const openPagamento = (cliente) => {
    setSelectedCliente(cliente);
    setPagamentoStep(0);
    setPagamentoResult(null);
    pagamentoForm.resetFields();
    setPagamentoVisible(true);
  };

  const handlePagamento = async (values) => {
    try {
      setPagamentoLoading(true);
      setPagamentoStep(1);

      // Passo 1: Banco regista o pagamento
      const emprestimos = await api.post('/emprestimos/consultar', {
        telefone: selectedCliente.telefone
      });
      const empAtivos = emprestimos.data?.emprestimos?.lista?.filter(e => e.status === 'ATIVO') || [];

      setPagamentoStep(2);

      // Passo 2: Enviar pagamento ao PayJA
      const res = await api.post('/clientes/simular-pagamento', {
        cliente_id: selectedCliente.id,
        nuit: selectedCliente.nuit,
        telefone: selectedCliente.telefone,
        nome: selectedCliente.nome_completo,
        valor: values.valor,
        tipo: values.tipo || 'PRESTACAO',
        descricao: values.descricao || 'Pagamento de prestação',
        emprestimo_id: empAtivos[0]?.id || null,
      });

      setPagamentoStep(3);
      setPagamentoResult(res.data);
      message.success('✅ Pagamento processado! SMS enviado ao cliente.');
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
      setPagamentoStep(0);
    } finally {
      setPagamentoLoading(false);
    }
  };

  // ─── VER DETALHES ────────────────────────────────────────────
  const openDetails = async (cliente) => {
    setSelectedCliente(cliente);
    setDetailsVisible(true);
  };

  // ─── SINCRONIZAR COM PAYJA ───────────────────────────────────
  const handleSync = async (cliente) => {
    try {
      await api.post('/clientes/sync-payja', { id: cliente.id });
      message.success('Sincronização com PayJA iniciada!');
      setTimeout(fetchClientes, 3000);
    } catch (err) {
      message.error('Erro na sincronização: ' + (err.response?.data?.erro || err.message));
    }
  };

  // ─── COLUNAS DA TABELA ───────────────────────────────────────
  const columns = [
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome',
      render: (nome, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{nome}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.nuit}</Text>
        </Space>
      ),
    },
    {
      title: 'Telefone',
      dataIndex: 'telefone',
      key: 'telefone',
      render: t => <Text code>{t}</Text>,
    },
    {
      title: 'Conta',
      dataIndex: 'numero_conta',
      key: 'conta',
      render: (c, r) => (
        <Space direction="vertical" size={0}>
          <Text>{c}</Text>
          <Tag color={r.tipo_conta === 'SALARIO' ? 'blue' : 'purple'} style={{ fontSize: 10 }}>{r.tipo_conta}</Tag>
        </Space>
      ),
    },
    {
      title: 'Estado Conta',
      dataIndex: 'status_conta',
      key: 'status_conta',
      render: (s, r) => (
        <Tooltip title={`Clique para ${s === 'ATIVA' ? 'desactivar' : 'activar'}`}>
          <Switch
            checked={s === 'ATIVA'}
            checkedChildren="ATIVA"
            unCheckedChildren="INATIVA"
            onChange={() => handleToggleStatus(r)}
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      title: 'Crédito',
      key: 'credito',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Tag color={r.status_credito === 'LIMPO' ? 'green' : r.status_credito === 'COMPROMETIDO' ? 'orange' : 'red'}>
            {r.status_credito}
          </Tag>
          {r.divida_total > 0 && (
            <Text type="danger" style={{ fontSize: 11 }}>{r.divida_total?.toLocaleString('pt-MZ')} MZN</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'PayJA',
      key: 'payja',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Tag color={r.payja_status === 'APROVADO' ? 'green' : r.payja_status === 'REJEITADO' ? 'red' : 'default'}>
            {r.payja_status || 'PENDENTE'}
          </Tag>
          {r.payja_limit > 0 && (
            <Text style={{ fontSize: 11, color: '#52c41a' }}>{r.payja_limit?.toLocaleString('pt-MZ')} MZN</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Acções',
      key: 'acoes',
      fixed: 'right',
      width: 220,
      render: (_, r) => (
        <Space size={4} wrap>
          <Tooltip title="Ver Detalhes">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetails(r)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} type="primary" ghost onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Simular Pagamento">
            <Button
              size="small"
              icon={<DollarCircleOutlined />}
              style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#16a34a' }}
              onClick={() => openPagamento(r)}
            />
          </Tooltip>
          <Tooltip title="Sincronizar com PayJA">
            <Button size="small" icon={<SyncOutlined />} onClick={() => handleSync(r)} />
          </Tooltip>
          <Tooltip title="Apagar Cliente">
            <Popconfirm
              title="Apagar este cliente?"
              description="Esta acção é irreversível."
              onConfirm={() => handleDelete(r.id)}
              okText="Sim, apagar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ─── FORMULÁRIO NOVO CLIENTE ─────────────────────────────────
  const ClienteForm = ({ form, onFinish, loading: fLoading, title }) => (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Divider orientation="left"><IdcardOutlined /> Dados Pessoais</Divider>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="nome_completo" label="Nome Completo" rules={[{ required: true }]}>
            <Input prefix={<TeamOutlined />} placeholder="Ex: João Pedro da Silva" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="nuit" label="NUIT" rules={[{ required: true, pattern: /^\d{9}$/, message: 'NUIT deve ter 9 dígitos' }]}>
            <Input placeholder="Ex: 100234567" maxLength={9} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="bi" label="Número do BI" rules={[{ required: true }]}>
            <Input placeholder="Ex: 1234567890123N" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="bi_validade" label="Validade do BI" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="telefone" label="Telefone" rules={[{ required: true, pattern: /^(258)?\d{9}$/, message: 'Formato: 258841234567' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="Ex: 258841234567" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} placeholder="Ex: joao@email.mz" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left"><BankOutlined /> Dados Bancários</Divider>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="numero_conta" label="Número de Conta" rules={[{ required: true }]}>
            <Input prefix={<CreditCardOutlined />} placeholder="Ex: 0001000000099" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="tipo_conta" label="Tipo de Conta" initialValue="SALARIO">
            <Select>
              <Option value="SALARIO">Salário</Option>
              <Option value="CORRENTE">Corrente</Option>
              <Option value="POUPANCA">Poupança</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="saldo" label="Saldo Actual (MZN)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="renda_mensal" label="Renda Mensal (MZN)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="status_conta" label="Estado da Conta" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="ACTIVA" unCheckedChildren="INACTIVA" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="salario_domiciliado" label="Salário Domiciliado" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="SIM" unCheckedChildren="NÃO" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left"><SafetyOutlined /> Perfil de Crédito</Divider>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="tipo_cliente" label="Tipo de Cliente" initialValue="ASSALARIADO">
            <Select>
              <Option value="ASSALARIADO">Assalariado</Option>
              <Option value="EMPRESARIO">Empresário</Option>
              <Option value="PENSIONISTA">Pensionista</Option>
              <Option value="ESTUDANTE">Estudante</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="status_credito" label="Status de Crédito" initialValue="LIMPO">
            <Select>
              <Option value="LIMPO">Limpo</Option>
              <Option value="COMPROMETIDO">Comprometido</Option>
              <Option value="INCOBAVEL">Incobrável</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="historico_pagamentos" label="Histórico de Pagamentos" initialValue="BOM">
            <Select>
              <Option value="EXCELENTE">Excelente</Option>
              <Option value="BOM">Bom</Option>
              <Option value="REGULAR">Regular</Option>
              <Option value="MAU">Mau</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="score_credito" label="Score de Crédito (0-1000)" initialValue={600}>
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="divida_total" label="Dívida Total Actual (MZN)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
      </Row>

      <Alert
        message="Após criar o cliente, os dados serão automaticamente enviados ao PayJA para análise de elegibilidade de crédito."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={fLoading} icon={<SendOutlined />} block>
          {title}
        </Button>
      </Form.Item>
    </Form>
  );

  // ─── ESTATÍSTICAS ────────────────────────────────────────────
  const aprovados = clientes.filter(c => c.payja_status === 'APROVADO').length;
  const ativos = clientes.filter(c => c.status_conta === 'ATIVA').length;
  const comDivida = clientes.filter(c => (c.divida_total || 0) > 0).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <BankOutlined /> Gestão de Clientes
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchClientes} loading={loading}>
            Actualizar
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddVisible(true)}>
            Novo Cliente
          </Button>
        </Space>
      </div>

      {/* Estatísticas */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total de Clientes" value={clientes.length} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Contas Activas" value={ativos} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Aprovados PayJA" value={aprovados} valueStyle={{ color: '#1677ff' }} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Com Dívida Activa" value={comDivida} valueStyle={{ color: comDivida > 0 ? '#cf1322' : '#3f8600' }} prefix={<DollarCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={clientes}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          rowClassName={r => r.status_conta === 'INATIVA' ? 'row-inactive' : ''}
        />
      </Card>

      {/* ── MODAL: NOVO CLIENTE ── */}
      <Modal
        title={<span><UserAddOutlined /> Novo Cliente</span>}
        open={addVisible}
        onCancel={() => { setAddVisible(false); addForm.resetFields(); }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ClienteForm form={addForm} onFinish={handleCreate} loading={submitLoading} title="Criar Cliente e Enviar ao PayJA" />
      </Modal>

      {/* ── MODAL: EDITAR CLIENTE ── */}
      <Modal
        title={<span><EditOutlined /> Editar Cliente — {selectedCliente?.nome_completo}</span>}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nome_completo" label="Nome Completo" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="telefone" label="Telefone" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="renda_mensal" label="Renda Mensal (MZN)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="saldo" label="Saldo (MZN)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="divida_total" label="Dívida Total (MZN)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status_conta" label="Conta Activa" valuePropName="checked">
                <Switch checkedChildren="ACTIVA" unCheckedChildren="INACTIVA" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="salario_domiciliado" label="Salário Domiciliado" valuePropName="checked">
                <Switch checkedChildren="SIM" unCheckedChildren="NÃO" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status_credito" label="Status Crédito">
                <Select>
                  <Option value="LIMPO">Limpo</Option>
                  <Option value="COMPROMETIDO">Comprometido</Option>
                  <Option value="INCOBAVEL">Incobrável</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="score_credito" label="Score de Crédito">
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="historico_pagamentos" label="Histórico Pagamentos">
                <Select>
                  <Option value="EXCELENTE">Excelente</Option>
                  <Option value="BOM">Bom</Option>
                  <Option value="REGULAR">Regular</Option>
                  <Option value="MAU">Mau</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitLoading} block>
              Guardar Alterações e Notificar PayJA
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── MODAL: SIMULAR PAGAMENTO ── */}
      <Modal
        title={<span><DollarCircleOutlined /> Simular Pagamento — {selectedCliente?.nome_completo}</span>}
        open={pagamentoVisible}
        onCancel={() => { setPagamentoVisible(false); setPagamentoStep(0); setPagamentoResult(null); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {pagamentoResult ? (
          <div>
            <Alert
              message="✅ Pagamento Processado com Sucesso"
              description={
                <div>
                  <p><strong>Valor pago:</strong> {pagamentoResult.pagamento?.valor?.toLocaleString('pt-MZ')} MZN</p>
                  <p><strong>Saldo devedor actualizado:</strong> {pagamentoResult.saldo_devedor_atualizado?.toLocaleString('pt-MZ')} MZN</p>
                  <p><strong>PayJA notificado:</strong> {pagamentoResult.payja_notificado ? '✅ Sim' : '⚠️ Pendente'}</p>
                  <p><strong>SMS enviado:</strong> {pagamentoResult.sms_enviado ? '✅ Sim' : '⚠️ Pendente'}</p>
                  {pagamentoResult.novo_limite_payja > 0 && (
                    <p><strong>Novo limite PayJA:</strong> {pagamentoResult.novo_limite_payja?.toLocaleString('pt-MZ')} MZN</p>
                  )}
                </div>
              }
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Steps current={3} size="small" style={{ marginBottom: 16 }}>
              <Step title="Banco" description="Registado" status="finish" />
              <Step title="PayJA" description="Notificado" status="finish" />
              <Step title="Análise" description="Actualizada" status="finish" />
              <Step title="SMS" description="Enviado" status="finish" />
            </Steps>
            <Button type="primary" block onClick={() => { setPagamentoVisible(false); setPagamentoStep(0); setPagamentoResult(null); }}>
              Fechar
            </Button>
          </div>
        ) : (
          <div>
            {pagamentoLoading && (
              <Steps current={pagamentoStep} size="small" style={{ marginBottom: 24 }}>
                <Step title="Banco" description="A registar" />
                <Step title="PayJA" description="A notificar" />
                <Step title="Análise" description="A actualizar" />
                <Step title="SMS" description="A enviar" />
              </Steps>
            )}
            <Alert
              message={`Cliente: ${selectedCliente?.nome_completo} | Dívida actual: ${(selectedCliente?.divida_total || 0).toLocaleString('pt-MZ')} MZN`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form form={pagamentoForm} layout="vertical" onFinish={handlePagamento}>
              <Form.Item name="valor" label="Valor do Pagamento (MZN)" rules={[{ required: true, message: 'Introduza o valor' }]}>
                <InputNumber
                  min={100}
                  max={selectedCliente?.divida_total || 9999999}
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  placeholder="Ex: 5000"
                />
              </Form.Item>
              <Form.Item name="tipo" label="Tipo de Pagamento" initialValue="PRESTACAO">
                <Select>
                  <Option value="PRESTACAO">Prestação Mensal</Option>
                  <Option value="AMORTIZACAO">Amortização Antecipada</Option>
                  <Option value="LIQUIDACAO">Liquidação Total</Option>
                  <Option value="JUROS">Pagamento de Juros</Option>
                </Select>
              </Form.Item>
              <Form.Item name="descricao" label="Descrição (opcional)">
                <Input placeholder="Ex: Pagamento da 3ª prestação" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={pagamentoLoading}
                  icon={<DollarCircleOutlined />}
                  block
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  {pagamentoLoading ? 'A processar...' : 'Simular Pagamento'}
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* ── MODAL: DETALHES ── */}
      <Modal
        title={<span><FileSearchOutlined /> Detalhes — {selectedCliente?.nome_completo}</span>}
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={900}
        footer={[
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => { setDetailsVisible(false); openEdit(selectedCliente); }}>
            Editar
          </Button>,
          <Button key="close" onClick={() => setDetailsVisible(false)}>Fechar</Button>
        ]}
      >
        {selectedCliente && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Limite PayJA"
                    value={selectedCliente.payja_limit || 0}
                    suffix="MZN"
                    valueStyle={{ color: selectedCliente.payja_status === 'APROVADO' ? '#3f8600' : '#cf1322' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="Score de Crédito" value={selectedCliente.score_credito || 0} suffix="/ 1000" />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Dívida Total"
                    value={selectedCliente.divida_total || 0}
                    suffix="MZN"
                    valueStyle={{ color: (selectedCliente.divida_total || 0) > 0 ? '#cf1322' : '#3f8600' }}
                  />
                </Card>
              </Col>
            </Row>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Nome Completo" span={2}><Text strong>{selectedCliente.nome_completo}</Text></Descriptions.Item>
              <Descriptions.Item label="NUIT">{selectedCliente.nuit}</Descriptions.Item>
              <Descriptions.Item label="BI">{selectedCliente.bi}</Descriptions.Item>
              <Descriptions.Item label="Telefone"><Text code>{selectedCliente.telefone}</Text></Descriptions.Item>
              <Descriptions.Item label="Email">{selectedCliente.email || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Número de Conta">{selectedCliente.numero_conta}</Descriptions.Item>
              <Descriptions.Item label="Tipo de Conta"><Tag color="blue">{selectedCliente.tipo_conta}</Tag></Descriptions.Item>
              <Descriptions.Item label="Estado da Conta">
                <Tag color={selectedCliente.status_conta === 'ATIVA' ? 'green' : 'red'}>{selectedCliente.status_conta}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Saldo">{(selectedCliente.saldo || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              <Descriptions.Item label="Renda Mensal">{(selectedCliente.renda_mensal || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              <Descriptions.Item label="Salário Domiciliado">
                <Tag color={selectedCliente.salario_domiciliado ? 'green' : 'default'}>{selectedCliente.salario_domiciliado ? 'SIM' : 'NÃO'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tipo de Cliente"><Tag>{selectedCliente.tipo_cliente}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status Crédito">
                <Tag color={selectedCliente.status_credito === 'LIMPO' ? 'green' : 'red'}>{selectedCliente.status_credito}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Histórico Pagamentos">
                <Tag color={selectedCliente.historico_pagamentos === 'EXCELENTE' || selectedCliente.historico_pagamentos === 'BOM' ? 'green' : 'orange'}>
                  {selectedCliente.historico_pagamentos}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status PayJA">
                <Tag color={selectedCliente.payja_status === 'APROVADO' ? 'green' : 'red'}>{selectedCliente.payja_status || 'PENDENTE'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Limite PayJA">
                <Text strong style={{ color: '#3f8600' }}>{(selectedCliente.payja_limit || 0).toLocaleString('pt-MZ')} MZN</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Última Sync PayJA">
                {selectedCliente.payja_last_sync ? new Date(selectedCliente.payja_last_sync).toLocaleString('pt-MZ') : 'Nunca'}
              </Descriptions.Item>
              <Descriptions.Item label="Criado em">
                {selectedCliente.criado_em ? new Date(selectedCliente.criado_em).toLocaleString('pt-MZ') : 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <style>{`
        .row-inactive { opacity: 0.6; background: #fafafa; }
        .row-inactive:hover > td { background: #f0f0f0 !important; }
      `}</style>
    </div>
  );
}

export default ClientesPage;
