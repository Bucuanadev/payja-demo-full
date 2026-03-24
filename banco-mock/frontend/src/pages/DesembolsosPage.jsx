import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, message, Modal, Form, Input, Select, InputNumber, Space, Divider } from 'antd';
import { ReloadOutlined, DollarOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';

const DesembolsosPage = () => {
  const [loading, setLoading] = useState(false);
  const [desembolsos, setDesembolsos] = useState([]);
  const [isPagamentoModalVisible, setIsPagamentoModalVisible] = useState(false);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDesembolsos();
    loadClientes();
    
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(loadDesembolsos, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadClientes = async () => {
    try {
      const response = await api.get('/clientes');
      setClientes(response.data.clientes || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const handleResetDesembolsos = () => {
    Modal.confirm({
      title: '⚠️ Confirmar Reset',
      content: 'Tem certeza que deseja limpar TODOS os dados de desembolsos? Esta ação não pode ser desfeita.',
      okText: 'Sim, Limpar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.post('/payja-loans/reset');
          message.success('Todos os desembolsos foram removidos com sucesso!');
          setDesembolsos([]);
          loadDesembolsos();
        } catch (error) {
          message.error(error.response?.data?.message || 'Erro ao limpar desembolsos');
        }
      },
    });
  };

  const loadDesembolsos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payja-loans');
      const data = response.data?.data || [];
      const mapped = data.map((d) => ({
        id: d.id,
        nome_completo: d.cliente || 'N/A',
        numero_conta: d.conta || '0000000000',
        valor: Number(d.valor) || 0,
        numero_emola: d.numeroEmola || '-',
        referencia_payja: d.referenciaPayJA || d.loanId || '-',
        status: d.status || 'PENDENTE',
        tentativas: d.tentativas ?? 0,
        criado_em: d.dataCriacao,
        processado_em: d.dataProcessamento,
      }));
      setDesembolsos(mapped);
    } catch (error) {
      message.error('Erro ao carregar desembolsos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      CONCLUIDO: 'success',
      PROCESSANDO: 'processing',
      PENDENTE: 'warning',
      ERRO: 'error',
    };
    return colors[status] || 'default';
  };

  const handleSimularPagamento = async (values) => {
    setProcessandoPagamento(true);
    try {
      const response = await api.post('/cedsif/simular-pagamento', {
        nuit: values.nuit,
        numero_emprestimo: values.numero_emprestimo,
        valor: values.valor,
        referencia: values.referencia || `CEDSIF-${Date.now()}`,
      });

      if (response.data.success) {
        message.success('Pagamento CEDSIF processado com sucesso!');
        
        // Mostrar informações das comissões
        const comissoes = response.data.data.comissoes;
        Modal.success({
          title: '💰 Pagamento Processado',
          width: 600,
          content: (
            <div>
              <p><strong>Valor Pago:</strong> {values.valor} MZN</p>
              <p><strong>Status:</strong> {response.data.data.emprestimo.status}</p>
              <Divider>Distribuição de Comissões</Divider>
              <p>🏦 <strong>Banco Welli ({comissoes.banco_welli.taxa}):</strong> {comissoes.banco_welli.valor} MZN</p>
              <p>💼 <strong>PayJA ({comissoes.payja.taxa}):</strong> {comissoes.payja.valor} MZN</p>
              <p>📱 <strong>Emola ({comissoes.emola.taxa}):</strong> {comissoes.emola.valor} MZN</p>
              <Divider />
              <p><strong>Valor Líquido:</strong> {comissoes.valor_liquido} MZN</p>
              {response.data.data.emprestimo.quitado && (
                <p style={{ color: '#52c41a', fontWeight: 'bold' }}>✅ Empréstimo quitado!</p>
              )}
            </div>
          ),
        });
        
        setIsPagamentoModalVisible(false);
        form.resetFields();
        loadDesembolsos();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Erro ao processar pagamento');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const columns = [
    {
      title: 'Cliente',
      dataIndex: 'nome_completo',
      key: 'cliente',
    },
    {
      title: 'Conta',
      dataIndex: 'numero_conta',
      key: 'conta',
      width: 150,
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
      width: 130,
      render: (valor) => (
        <strong style={{ color: '#1890ff' }}>
          {(valor !== undefined && valor !== null) ? valor.toLocaleString() : '0'} MZN
        </strong>
      ),
    },
    {
      title: 'Número Emola',
      dataIndex: 'numero_emola',
      key: 'emola',
      width: 140,
    },
    {
      title: 'Referência PayJA',
      dataIndex: 'referencia_payja',
      key: 'ref',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={<DollarOutlined />}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Tentativas',
      dataIndex: 'tentativas',
      key: 'tentativas',
      width: 100,
      align: 'center',
    },
    {
      title: 'Data Criação',
      dataIndex: 'criado_em',
      key: 'criado',
      width: 180,
      render: (data) => data ? new Date(data).toLocaleString('pt-MZ') : '-',
    },
    {
      title: 'Data Processamento',
      dataIndex: 'processado_em',
      key: 'processado',
      width: 180,
      render: (data) => data ? new Date(data).toLocaleString('pt-MZ') : '-',
    },
  ];

  const summary = () => {
    const total = desembolsos.reduce((sum, d) => sum + d.valor, 0);
    const concluidos = desembolsos.filter(d => d.status === 'CONCLUIDO').length;
    const processando = desembolsos.filter(d => d.status === 'PROCESSANDO').length;
    const erro = desembolsos.filter(d => d.status === 'ERRO').length;

    return (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0} colSpan={2}>
            <strong>Total</strong>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2}>
            <strong style={{ color: '#1890ff' }}>
              {(total !== undefined && total !== null) ? total.toLocaleString() : '0'} MZN
            </strong>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} colSpan={2}>
            Concluídos: <Tag color="success">{concluidos}</Tag>
            Processando: <Tag color="processing">{processando}</Tag>
            Erros: <Tag color="error">{erro}</Tag>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  return (
    <div>
      <Card
        title="Histórico de Desembolsos"
        extra={
          <Space>
            <Button 
              type="primary"
              icon={<ThunderboltOutlined />} 
              onClick={() => setIsPagamentoModalVisible(true)}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Simular Pagamento CEDSIF
            </Button>
            <Button 
              danger
              icon={<DeleteOutlined />} 
              onClick={handleResetDesembolsos}
              title="Limpar todos os dados de desembolsos"
            >
              Reset Dados
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadDesembolsos} loading={loading}>
              Atualizar
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={desembolsos}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
          summary={summary}
        />
      </Card>

      <Modal
        title="⚡ Simular Pagamento via CEDSIF"
        open={isPagamentoModalVisible}
        onCancel={() => {
          setIsPagamentoModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={processandoPagamento}
        okText="Processar Pagamento"
        cancelText="Cancelar"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSimularPagamento}
        >
          <Form.Item
            name="nuit"
            label="Cliente (NUIT)"
            rules={[{ required: true, message: 'Selecione o cliente' }]}
          >
            <Select
              showSearch
              placeholder="Selecione o cliente"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={clientes.map(c => ({
                value: c.nuit,
                label: `${c.nome_completo} (${c.nuit})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="numero_emprestimo"
            label="Número do Empréstimo"
            rules={[{ required: true, message: 'Digite o número do empréstimo' }]}
          >
            <Input placeholder="Ex: EMP-1234567890" />
          </Form.Item>

          <Form.Item
            name="valor"
            label="Valor do Pagamento (MZN)"
            rules={[
              { required: true, message: 'Digite o valor' },
              { type: 'number', min: 1, message: 'Valor deve ser maior que 0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="0.00"
              min={0}
              step={100}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="referencia"
            label="Referência (Opcional)"
          >
            <Input placeholder="Será gerado automaticamente se não fornecido" />
          </Form.Item>

          <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 4, marginTop: 16 }}>
            <p style={{ margin: 0, fontSize: 12 }}>
              <strong>ℹ️ Simulação CEDSIF:</strong><br />
              Este pagamento simulará um pagamento recebido via CEDSIF, calculará as comissões
              (Banco 2%, PayJA 1%, Emola 0.5%) e enviará webhook para PayJA.
            </p>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DesembolsosPage;
