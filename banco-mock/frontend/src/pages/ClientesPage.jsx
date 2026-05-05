import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Card, Tag, Button, Space, Typography, Modal, Descriptions,
  Alert, Form, Input, InputNumber, Select, Switch, Popconfirm,
  Divider, Row, Col, Statistic, Badge, Tooltip, message, Spin,
  Progress, Upload, List, Tabs
} from 'antd';
import {
  EyeOutlined, UserAddOutlined, DeleteOutlined, EditOutlined,
  DollarCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, BankOutlined, SafetyOutlined, PhoneOutlined,
  IdcardOutlined, MailOutlined, TeamOutlined, SyncOutlined,
  ExclamationCircleOutlined, FileSearchOutlined, CreditCardOutlined,
  SendOutlined, HistoryOutlined, FolderOutlined, UploadOutlined,
  FilePdfOutlined, FileImageOutlined, FileOutlined, DownloadOutlined,
  FolderAddOutlined, PaperClipOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const TIPOS_DOCUMENTO = [
  { value: 'BI', label: '🪪 Bilhete de Identidade' },
  { value: 'NUIT', label: '🔢 Cartão NUIT' },
  { value: 'COMPROVATIVO_RENDIMENTO', label: '💰 Comprovativo de Rendimento' },
  { value: 'EXTRATO_BANCARIO', label: '🏦 Extracto Bancário' },
  { value: 'COMPROVATIVO_RESIDENCIA', label: '🏠 Comprovativo de Residência' },
  { value: 'DECLARACAO_EMPREGO', label: '💼 Declaração de Emprego' },
  { value: 'PASSAPORTE', label: '✈️ Passaporte' },
  { value: 'OUTRO', label: '📄 Outro Documento' },
];

const DOCS_REQUERIDOS = ['BI', 'NUIT', 'COMPROVATIVO_RENDIMENTO', 'EXTRATO_BANCARIO'];

function getFileIcon(ext) {
  if (['.pdf'].includes(ext)) return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return <FileImageOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
  return <FileOutlined style={{ color: '#8c8c8c', fontSize: 20 }} />;
}

function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [pagamentoVisible, setPagamentoVisible] = useState(false);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [pagamentoResult, setPagamentoResult] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [dossierVisible, setDossierVisible] = useState(false);
  const [dossierCliente, setDossierCliente] = useState(null);
  const [dossierDocs, setDossierDocs] = useState([]);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('BI');
  const [uploadDescricao, setUploadDescricao] = useState('');
  const [pendingDossierFiles, setPendingDossierFiles] = useState([]); // ficheiros pendentes ao criar cliente
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pagamentoForm] = Form.useForm();
  const fileInputRef = useRef(null);
  const pendingFileInputRef = useRef(null);

  useEffect(() => { fetchClientes(); }, []);

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
      const res = await api.post('/clientes', payload);
      const novoId = res.data.cliente?.id;

      // Upload dos ficheiros pendentes do dossier
      if (novoId && pendingDossierFiles.length > 0) {
        for (const pf of pendingDossierFiles) {
          const formData = new FormData();
          formData.append('ficheiro', pf.file);
          formData.append('tipo_documento', pf.tipo);
          formData.append('descricao', pf.descricao || '');
          try {
            await fetch(`${api.defaults.baseURL}/dossier/${novoId}/upload`, {
              method: 'POST',
              body: formData
            });
          } catch (e) { /* continua */ }
        }
        message.success(`✅ Cliente criado com ${pendingDossierFiles.length} documento(s) no dossier!`);
      } else {
        message.success('✅ Cliente criado e enviado ao PayJA para análise!');
      }

      addForm.resetFields();
      setPendingDossierFiles([]);
      setAddVisible(false);
      fetchClientes();
    } catch (err) {
      message.error('Erro ao criar cliente: ' + (err.response?.data?.erro || err.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── EDITAR CLIENTE ───────────────────────────────────────────
  const handleEdit = async (values) => {
    try {
      setSubmitLoading(true);
      await api.patch(`/clientes/${selectedCliente.id}`, values);
      message.success('✅ Cliente actualizado!');
      editForm.resetFields();
      setEditVisible(false);
      fetchClientes();
    } catch (err) {
      message.error('Erro ao actualizar: ' + (err.response?.data?.erro || err.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── APAGAR CLIENTE ───────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/clientes/${id}`);
      message.success('Cliente apagado');
      fetchClientes();
    } catch (err) {
      message.error('Erro ao apagar: ' + (err.response?.data?.erro || err.message));
    }
  };

  // ─── TOGGLE STATUS ───────────────────────────────────────────
  const handleToggleStatus = async (cliente) => {
    try {
      const novoStatus = cliente.status_conta === 'ATIVA' ? 'INATIVA' : 'ATIVA';
      await api.patch(`/clientes/${cliente.id}`, { status_conta: novoStatus });
      message.success(`Conta ${novoStatus === 'ATIVA' ? 'activada' : 'desactivada'}`);
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
    }
  };

  // ─── SIMULAR PAGAMENTO ───────────────────────────────────────
  const handlePagamento = async (values) => {
    try {
      setPagamentoLoading(true);
      const res = await api.post('/clientes/simular-pagamento', {
        cliente_id: selectedCliente.id,
        valor: values.valor,
        tipo_pagamento: values.tipo_pagamento,
        descricao: values.descricao || ''
      });
      setPagamentoResult(res.data);
      message.success('✅ Pagamento simulado com sucesso!');
      fetchClientes();
    } catch (err) {
      message.error('Erro: ' + (err.response?.data?.erro || err.message));
    } finally {
      setPagamentoLoading(false);
    }
  };

  // ─── DOSSIER: ABRIR ──────────────────────────────────────────
  const openDossier = async (cliente) => {
    setDossierCliente(cliente);
    setDossierVisible(true);
    await loadDossier(cliente.id);
  };

  const loadDossier = async (clienteId) => {
    try {
      setDossierLoading(true);
      const res = await fetch(`${api.defaults.baseURL}/dossier/${clienteId}`);
      const data = await res.json();
      setDossierDocs(data.documentos || []);
    } catch (err) {
      message.error('Erro ao carregar dossier');
    } finally {
      setDossierLoading(false);
    }
  };

  // ─── DOSSIER: UPLOAD ─────────────────────────────────────────
  const handleDossierUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadLoading(true);
      const formData = new FormData();
      formData.append('ficheiro', file);
      formData.append('tipo_documento', uploadTipo);
      formData.append('descricao', uploadDescricao);
      const res = await fetch(`${api.defaults.baseURL}/dossier/${dossierCliente.id}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.sucesso) {
        message.success('✅ Documento carregado com sucesso!');
        if (data.dossier_completo) message.success('🎉 Dossier completo!');
        await loadDossier(dossierCliente.id);
        setUploadDescricao('');
      } else {
        message.error(data.erro || 'Erro ao carregar ficheiro');
      }
    } catch (err) {
      message.error('Erro: ' + err.message);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── DOSSIER: APAGAR DOCUMENTO ───────────────────────────────
  const handleDeleteDoc = async (ficheiro) => {
    try {
      await fetch(`${api.defaults.baseURL}/dossier/${dossierCliente.id}/${ficheiro}`, { method: 'DELETE' });
      message.success('Documento apagado');
      await loadDossier(dossierCliente.id);
    } catch (err) {
      message.error('Erro ao apagar documento');
    }
  };

  // ─── FICHEIROS PENDENTES (ao criar cliente) ───────────────────
  const handlePendingFileAdd = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const tipo = document.getElementById('pending-tipo-select')?.value || 'BI';
    const descricao = document.getElementById('pending-desc-input')?.value || '';
    setPendingDossierFiles(prev => [...prev, { file, tipo, descricao, nome: file.name }]);
    if (pendingFileInputRef.current) pendingFileInputRef.current.value = '';
  };

  const removePendingFile = (idx) => {
    setPendingDossierFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── COLUNAS DA TABELA ───────────────────────────────────────
  const columns = [
    {
      title: 'NUIT', dataIndex: 'nuit', key: 'nuit', width: 110,
      render: v => <Text code>{v}</Text>
    },
    {
      title: 'Nome', dataIndex: 'nome_completo', key: 'nome',
      render: (v, r) => (
        <Space>
          <Text strong>{v}</Text>
          {r.dossier?.completo && <Tooltip title="Dossier completo"><CheckCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>}
          {r.dossier && !r.dossier.completo && <Tooltip title="Dossier incompleto"><ExclamationCircleOutlined style={{ color: '#faad14' }} /></Tooltip>}
        </Space>
      )
    },
    { title: 'Telefone', dataIndex: 'telefone', key: 'telefone', width: 140 },
    {
      title: 'Tipo', dataIndex: 'tipo_cliente', key: 'tipo',
      render: v => {
        const colors = { ASSALARIADO: 'blue', INFORMAL: 'orange', EMPRESARIAL: 'purple', PENSIONISTA: 'cyan' };
        return <Tag color={colors[v] || 'default'}>{v}</Tag>;
      }
    },
    {
      title: 'Status', dataIndex: 'status_conta', key: 'status', width: 100,
      render: (v, r) => (
        <Tooltip title={`Clique para ${v === 'ATIVA' ? 'desactivar' : 'activar'}`}>
          <Switch
            size="small"
            checked={v === 'ATIVA'}
            onChange={() => handleToggleStatus(r)}
            checkedChildren="ATIVA"
            unCheckedChildren="INATIVA"
          />
        </Tooltip>
      )
    },
    {
      title: 'PayJA', dataIndex: 'payja_status', key: 'payja',
      render: v => {
        const map = { APROVADO: ['green', '✅ Aprovado'], REJEITADO: ['red', '❌ Rejeitado'], PENDENTE: ['orange', '⏳ Pendente'] };
        const [color, label] = map[v] || ['default', v || 'N/A'];
        return <Tag color={color}>{label}</Tag>;
      }
    },
    {
      title: 'Limite PayJA', dataIndex: 'payja_credit_limit', key: 'limite',
      render: v => v ? <Text strong style={{ color: '#52c41a' }}>{Number(v).toLocaleString('pt-MZ')} MZN</Text> : <Text type="secondary">—</Text>
    },
    {
      title: 'Ações', key: 'acoes', width: 220,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver detalhes">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedCliente(r); setDetailsVisible(true); }} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => { setSelectedCliente(r); editForm.setFieldsValue({ ...r, status_conta: r.status_conta === 'ATIVA' }); setEditVisible(true); }} />
          </Tooltip>
          <Tooltip title="Dossier">
            <Button size="small" icon={<FolderOutlined />} style={{ color: '#722ed1', borderColor: '#722ed1' }} onClick={() => openDossier(r)} />
          </Tooltip>
          <Tooltip title="Simular pagamento">
            <Button size="small" icon={<DollarCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={() => { setSelectedCliente(r); setPagamentoResult(null); setPagamentoVisible(true); }} />
          </Tooltip>
          <Popconfirm title="Apagar cliente?" onConfirm={() => handleDelete(r.id)} okText="Sim" cancelText="Não">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const aprovados = clientes.filter(c => c.payja_status === 'APROVADO').length;
  const activas = clientes.filter(c => c.status_conta === 'ATIVA').length;
  const comDivida = clientes.filter(c => c.divida_total > 0).length;
  const dossierCompletos = clientes.filter(c => c.dossier?.completo).length;

  return (
    <div style={{ padding: 24 }}>
      {/* ─── ESTATÍSTICAS ─── */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="Total Clientes" value={clientes.length} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Contas Activas" value={activas} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Aprovados PayJA" value={aprovados} valueStyle={{ color: '#1890ff' }} prefix={<SafetyOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Dossiers Completos" value={dossierCompletos} valueStyle={{ color: '#722ed1' }} prefix={<FolderOutlined />} /></Card></Col>
      </Row>

      {/* ─── TABELA ─── */}
      <Card
        title={<Space><TeamOutlined /><span>Gestão de Clientes</span></Space>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchClientes}>Actualizar</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => { addForm.resetFields(); setPendingDossierFiles([]); setAddVisible(true); }}>
              Novo Cliente
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="todos">
          <TabPane tab={<span>Todos <Badge count={clientes.length} style={{ backgroundColor: '#8c8c8c' }} /></span>} key="todos">
            <Table dataSource={clientes} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane tab={<span>✅ Aprovados <Badge count={aprovados} style={{ backgroundColor: '#52c41a' }} /></span>} key="aprovados">
            <Table dataSource={clientes.filter(c => c.payja_status === 'APROVADO')} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane tab={<span>📁 Dossier Incompleto <Badge count={clientes.filter(c => !c.dossier?.completo).length} style={{ backgroundColor: '#faad14' }} /></span>} key="dossier">
            <Table dataSource={clientes.filter(c => !c.dossier?.completo)} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      {/* ─── MODAL: NOVO CLIENTE ─── */}
      <Modal
        title={<Space><UserAddOutlined /><span>Adicionar Novo Cliente</span></Space>}
        open={addVisible}
        onCancel={() => { setAddVisible(false); setPendingDossierFiles([]); }}
        footer={null}
        width={800}
      >
        <Form form={addForm} layout="vertical" onFinish={handleCreate}>
          <Tabs defaultActiveKey="dados">
            <TabPane tab="👤 Dados Pessoais" key="dados">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="nome_completo" label="Nome Completo" rules={[{ required: true }]}>
                    <Input prefix={<TeamOutlined />} placeholder="Nome completo" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="telefone" label="Telefone" rules={[{ required: true }]}>
                    <Input prefix={<PhoneOutlined />} placeholder="258841234567" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="nuit" label="NUIT" rules={[{ required: true }]}>
                    <Input placeholder="100234567" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="bi" label="Nº Bilhete de Identidade">
                    <Input prefix={<IdcardOutlined />} placeholder="123456789A" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="bi_validade" label="Validade do BI">
                    <Input placeholder="2028-12-31" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="Email">
                    <Input prefix={<MailOutlined />} placeholder="email@exemplo.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tipo_cliente" label="Tipo de Emprego">
                    <Select placeholder="Seleccione">
                      <Option value="ASSALARIADO">Assalariado</Option>
                      <Option value="INFORMAL">Informal</Option>
                      <Option value="EMPRESARIAL">Empresarial</Option>
                      <Option value="PENSIONISTA">Pensionista</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>
            <TabPane tab="🏦 Dados Bancários" key="banco">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="numero_conta" label="Número de Conta" rules={[{ required: true }]}>
                    <Input prefix={<BankOutlined />} placeholder="1234567890" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tipo_conta" label="Tipo de Conta">
                    <Select placeholder="Seleccione">
                      <Option value="SALARIO">Conta Salário</Option>
                      <Option value="CORRENTE">Conta Corrente</Option>
                      <Option value="POUPANCA">Conta Poupança</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="saldo" label="Saldo Actual (MZN)">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="renda_mensal" label="Renda Mensal (MZN)">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="salario_domiciliado" label="Salário Domiciliado" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status_conta" label="Conta Activa" valuePropName="checked" initialValue={true}>
                    <Switch checkedChildren="Activa" unCheckedChildren="Inactiva" />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>
            <TabPane tab="📊 Perfil de Crédito" key="credito">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="score_credito" label="Score de Crédito (0-1000)">
                    <InputNumber style={{ width: '100%' }} min={0} max={1000} placeholder="600" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="historico_pagamentos" label="Histórico de Pagamentos">
                    <Select placeholder="Seleccione">
                      <Option value="EXCELENTE">Excelente</Option>
                      <Option value="BOM">Bom</Option>
                      <Option value="REGULAR">Regular</Option>
                      <Option value="MAU">Mau</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status_credito" label="Status de Crédito">
                    <Select placeholder="Seleccione">
                      <Option value="LIMPO">Limpo</Option>
                      <Option value="COM_DIVIDA">Com Dívida</Option>
                      <Option value="INCOBAVEL">Incobrável</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="divida_total" label="Dívida Total (MZN)">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>
            <TabPane tab={<span><FolderAddOutlined /> Dossier {pendingDossierFiles.length > 0 && <Badge count={pendingDossierFiles.length} style={{ backgroundColor: '#722ed1', marginLeft: 4 }} />}</span>} key="dossier">
              <Alert
                message="Adicione os documentos do cliente agora ou mais tarde através do botão 'Dossier' na tabela."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={8}>
                  <select id="pending-tipo-select" style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
                    {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Col>
                <Col span={8}>
                  <input id="pending-desc-input" placeholder="Descrição (opcional)" style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 6 }} />
                </Col>
                <Col span={8}>
                  <input ref={pendingFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handlePendingFileAdd} style={{ display: 'none' }} id="pending-file-input" />
                  <Button icon={<UploadOutlined />} onClick={() => document.getElementById('pending-file-input').click()} style={{ width: '100%' }}>
                    Adicionar Documento
                  </Button>
                </Col>
              </Row>
              {pendingDossierFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#8c8c8c', border: '2px dashed #d9d9d9', borderRadius: 8 }}>
                  <FolderAddOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                  <div>Nenhum documento adicionado</div>
                  <div style={{ fontSize: 12 }}>Documentos recomendados: BI, NUIT, Comprovativo de Rendimento, Extracto Bancário</div>
                </div>
              ) : (
                <List
                  size="small"
                  dataSource={pendingDossierFiles}
                  renderItem={(pf, idx) => (
                    <List.Item
                      actions={[<Button size="small" danger icon={<DeleteOutlined />} onClick={() => removePendingFile(idx)} />]}
                    >
                      <Space>
                        <FileOutlined style={{ color: '#722ed1' }} />
                        <Text>{pf.nome}</Text>
                        <Tag color="purple">{pf.tipo}</Tag>
                        {pf.descricao && <Text type="secondary">{pf.descricao}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
              )}
              <Divider />
              <Text type="secondary" style={{ fontSize: 12 }}>
                📋 Documentos requeridos: {DOCS_REQUERIDOS.join(', ')}
              </Text>
            </TabPane>
          </Tabs>
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setAddVisible(false); setPendingDossierFiles([]); }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={submitLoading} icon={<UserAddOutlined />}>
              Criar Cliente {pendingDossierFiles.length > 0 && `(+ ${pendingDossierFiles.length} doc.)`}
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── MODAL: EDITAR CLIENTE ─── */}
      <Modal
        title={<Space><EditOutlined /><span>Editar Cliente — {selectedCliente?.nome_completo}</span></Space>}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Tabs defaultActiveKey="dados">
            <TabPane tab="👤 Dados Pessoais" key="dados">
              <Row gutter={16}>
                <Col span={12}><Form.Item name="nome_completo" label="Nome Completo"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="telefone" label="Telefone"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="nuit" label="NUIT"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="bi" label="Nº BI"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="bi_validade" label="Validade BI"><Input placeholder="2028-12-31" /></Form.Item></Col>
                <Col span={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="tipo_cliente" label="Tipo de Emprego"><Select><Option value="ASSALARIADO">Assalariado</Option><Option value="INFORMAL">Informal</Option><Option value="EMPRESARIAL">Empresarial</Option><Option value="PENSIONISTA">Pensionista</Option></Select></Form.Item></Col>
              </Row>
            </TabPane>
            <TabPane tab="🏦 Dados Bancários" key="banco">
              <Row gutter={16}>
                <Col span={12}><Form.Item name="numero_conta" label="Número de Conta"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="tipo_conta" label="Tipo de Conta"><Select><Option value="SALARIO">Conta Salário</Option><Option value="CORRENTE">Conta Corrente</Option><Option value="POUPANCA">Conta Poupança</Option></Select></Form.Item></Col>
                <Col span={8}><Form.Item name="saldo" label="Saldo (MZN)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={8}><Form.Item name="renda_mensal" label="Renda Mensal (MZN)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={8}><Form.Item name="salario_domiciliado" label="Salário Domiciliado" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={8}><Form.Item name="status_conta" label="Conta Activa" valuePropName="checked"><Switch checkedChildren="Activa" unCheckedChildren="Inactiva" /></Form.Item></Col>
              </Row>
            </TabPane>
            <TabPane tab="📊 Crédito" key="credito">
              <Row gutter={16}>
                <Col span={8}><Form.Item name="score_credito" label="Score"><InputNumber style={{ width: '100%' }} min={0} max={1000} /></Form.Item></Col>
                <Col span={8}><Form.Item name="historico_pagamentos" label="Histórico"><Select><Option value="EXCELENTE">Excelente</Option><Option value="BOM">Bom</Option><Option value="REGULAR">Regular</Option><Option value="MAU">Mau</Option></Select></Form.Item></Col>
                <Col span={8}><Form.Item name="status_credito" label="Status Crédito"><Select><Option value="LIMPO">Limpo</Option><Option value="COM_DIVIDA">Com Dívida</Option><Option value="INCOBAVEL">Incobrável</Option></Select></Form.Item></Col>
                <Col span={8}><Form.Item name="divida_total" label="Dívida Total (MZN)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              </Row>
            </TabPane>
          </Tabs>
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditVisible(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={submitLoading}>Guardar Alterações</Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── MODAL: DOSSIER ─── */}
      <Modal
        title={<Space><FolderOutlined style={{ color: '#722ed1' }} /><span>Dossier — {dossierCliente?.nome_completo}</span></Space>}
        open={dossierVisible}
        onCancel={() => setDossierVisible(false)}
        footer={<Button onClick={() => setDossierVisible(false)}>Fechar</Button>}
        width={700}
      >
        {dossierCliente && (
          <>
            {/* Progresso do dossier */}
            {(() => {
              const tiposCarregados = dossierDocs.map(d => d.tipo_documento);
              const completos = DOCS_REQUERIDOS.filter(r => tiposCarregados.includes(r)).length;
              const pct = Math.round((completos / DOCS_REQUERIDOS.length) * 100);
              return (
                <Card size="small" style={{ marginBottom: 16, background: '#f9f0ff', border: '1px solid #d3adf7' }}>
                  <Row align="middle" gutter={16}>
                    <Col span={16}>
                      <Text strong>Completude do Dossier</Text>
                      <Progress percent={pct} strokeColor={pct === 100 ? '#52c41a' : '#722ed1'} size="small" style={{ marginTop: 4 }} />
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text type="secondary">{completos}/{DOCS_REQUERIDOS.length} documentos requeridos</Text>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8 }}>
                    {DOCS_REQUERIDOS.map(r => (
                      <Tag key={r} color={tiposCarregados.includes(r) ? 'green' : 'orange'} style={{ marginBottom: 4 }}>
                        {tiposCarregados.includes(r) ? '✅' : '⏳'} {r}
                      </Tag>
                    ))}
                  </div>
                </Card>
              );
            })()}

            {/* Upload de novo documento */}
            <Card size="small" title={<Space><UploadOutlined /><span>Adicionar Documento</span></Space>} style={{ marginBottom: 16 }}>
              <Row gutter={12} align="middle">
                <Col span={8}>
                  <Select value={uploadTipo} onChange={setUploadTipo} style={{ width: '100%' }} size="small">
                    {TIPOS_DOCUMENTO.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                  </Select>
                </Col>
                <Col span={8}>
                  <Input
                    size="small"
                    placeholder="Descrição (opcional)"
                    value={uploadDescricao}
                    onChange={e => setUploadDescricao(e.target.value)}
                  />
                </Col>
                <Col span={8}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleDossierUpload} style={{ display: 'none' }} />
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    loading={uploadLoading}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%' }}
                    type="primary"
                    ghost
                  >
                    Seleccionar Ficheiro
                  </Button>
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                Formatos aceites: PDF, JPG, PNG, DOC, DOCX (máx. 10MB)
              </Text>
            </Card>

            {/* Lista de documentos */}
            <Card size="small" title={<Space><PaperClipOutlined /><span>Documentos Carregados ({dossierDocs.length})</span></Space>}>
              {dossierLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
              ) : dossierDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#8c8c8c' }}>
                  <FolderOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                  <div>Nenhum documento carregado</div>
                </div>
              ) : (
                <List
                  size="small"
                  dataSource={dossierDocs}
                  renderItem={doc => (
                    <List.Item
                      actions={[
                        <Tooltip title="Descarregar">
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => window.open(`${api.defaults.baseURL}/dossier/${dossierCliente.id}/download/${doc.id}`, '_blank')}
                          />
                        </Tooltip>,
                        <Popconfirm title="Apagar documento?" onConfirm={() => handleDeleteDoc(doc.id)} okText="Sim" cancelText="Não">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ]}
                    >
                      <Space>
                        {getFileIcon(doc.extensao)}
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{doc.nome}</Text>
                          <br />
                          <Space size={4}>
                            <Tag color="purple" style={{ fontSize: 11 }}>{doc.tipo_documento}</Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>{doc.tamanho_formatado}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>{new Date(doc.data_upload).toLocaleString('pt-MZ')}</Text>
                          </Space>
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </>
        )}
      </Modal>

      {/* ─── MODAL: SIMULAR PAGAMENTO ─── */}
      <Modal
        title={<Space><DollarCircleOutlined /><span>Simular Pagamento — {selectedCliente?.nome_completo}</span></Space>}
        open={pagamentoVisible}
        onCancel={() => { setPagamentoVisible(false); setPagamentoResult(null); pagamentoForm.resetFields(); }}
        footer={null}
        width={500}
      >
        {pagamentoResult ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4}>Pagamento Processado!</Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Valor Pago">{Number(pagamentoResult.valor_pago || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              <Descriptions.Item label="Dívida Anterior">{Number(pagamentoResult.divida_anterior || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              <Descriptions.Item label="Dívida Actual">{Number(pagamentoResult.divida_atual || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              <Descriptions.Item label="SMS Enviado">{pagamentoResult.sms_enviado ? '✅ Sim' : '❌ Não'}</Descriptions.Item>
            </Descriptions>
            <Button type="primary" style={{ marginTop: 16 }} onClick={() => { setPagamentoVisible(false); setPagamentoResult(null); pagamentoForm.resetFields(); }}>
              Fechar
            </Button>
          </div>
        ) : (
          <Form form={pagamentoForm} layout="vertical" onFinish={handlePagamento}>
            <Alert message={`Dívida actual: ${Number(selectedCliente?.divida_total || 0).toLocaleString('pt-MZ')} MZN`} type="info" showIcon style={{ marginBottom: 16 }} />
            <Form.Item name="tipo_pagamento" label="Tipo de Pagamento" rules={[{ required: true }]}>
              <Select placeholder="Seleccione o tipo">
                <Option value="PRESTACAO">Prestação Mensal</Option>
                <Option value="AMORTIZACAO">Amortização Antecipada</Option>
                <Option value="LIQUIDACAO">Liquidação Total</Option>
                <Option value="JUROS">Pagamento de Juros</Option>
              </Select>
            </Form.Item>
            <Form.Item name="valor" label="Valor (MZN)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} placeholder="0" />
            </Form.Item>
            <Form.Item name="descricao" label="Descrição (opcional)">
              <Input placeholder="Observações sobre o pagamento" />
            </Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setPagamentoVisible(false); pagamentoForm.resetFields(); }}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={pagamentoLoading} icon={<SendOutlined />}>
                Simular Pagamento
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

      {/* ─── MODAL: DETALHES ─── */}
      <Modal
        title={<Space><EyeOutlined /><span>Detalhes — {selectedCliente?.nome_completo}</span></Space>}
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={[
          <Button key="dossier" icon={<FolderOutlined />} style={{ color: '#722ed1', borderColor: '#722ed1' }} onClick={() => { setDetailsVisible(false); openDossier(selectedCliente); }}>Ver Dossier</Button>,
          <Button key="close" onClick={() => setDetailsVisible(false)}>Fechar</Button>
        ]}
        width={700}
      >
        {selectedCliente && (
          <Tabs defaultActiveKey="pessoal">
            <TabPane tab="👤 Pessoal" key="pessoal">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Nome">{selectedCliente.nome_completo}</Descriptions.Item>
                <Descriptions.Item label="NUIT">{selectedCliente.nuit}</Descriptions.Item>
                <Descriptions.Item label="BI">{selectedCliente.bi}</Descriptions.Item>
                <Descriptions.Item label="Validade BI">{selectedCliente.bi_validade}</Descriptions.Item>
                <Descriptions.Item label="Telefone">{selectedCliente.telefone}</Descriptions.Item>
                <Descriptions.Item label="Email">{selectedCliente.email}</Descriptions.Item>
                <Descriptions.Item label="Tipo">{selectedCliente.tipo_cliente}</Descriptions.Item>
              </Descriptions>
            </TabPane>
            <TabPane tab="🏦 Bancário" key="bancario">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Conta">{selectedCliente.numero_conta}</Descriptions.Item>
                <Descriptions.Item label="Tipo">{selectedCliente.tipo_conta}</Descriptions.Item>
                <Descriptions.Item label="Saldo">{Number(selectedCliente.saldo || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
                <Descriptions.Item label="Renda Mensal">{Number(selectedCliente.renda_mensal || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
                <Descriptions.Item label="Salário Dom.">{selectedCliente.salario_domiciliado ? 'Sim' : 'Não'}</Descriptions.Item>
                <Descriptions.Item label="Status">{selectedCliente.status_conta}</Descriptions.Item>
              </Descriptions>
            </TabPane>
            <TabPane tab="📊 Crédito" key="credito">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Score">{selectedCliente.score_credito}</Descriptions.Item>
                <Descriptions.Item label="Histórico">{selectedCliente.historico_pagamentos}</Descriptions.Item>
                <Descriptions.Item label="Status Crédito">{selectedCliente.status_credito}</Descriptions.Item>
                <Descriptions.Item label="Dívida Total">{Number(selectedCliente.divida_total || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
                <Descriptions.Item label="PayJA Status">{selectedCliente.payja_status}</Descriptions.Item>
                <Descriptions.Item label="Limite PayJA">{Number(selectedCliente.payja_credit_limit || 0).toLocaleString('pt-MZ')} MZN</Descriptions.Item>
              </Descriptions>
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
}

export default ClientesPage;
