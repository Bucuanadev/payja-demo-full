import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Modal, 
  Descriptions, 
  Alert, 
  Tabs,
  Tooltip,
  Badge,
  message
} from 'antd';
import { 
  EyeOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  InfoCircleOutlined,
  UserOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      message.error('Não foi possível carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await api.get(`/admin/customers/${id}`);
      setSelectedCustomer(response.data);
      setModalVisible(true);
    } catch (error) {
      console.error('Erro ao buscar detalhes do cliente:', error);
      message.error('Erro ao carregar detalhes do cliente.');
    }
  };

  const getApproved = () => customers.filter(c => c.status === 'APPROVED');
  const getNotApproved = () => customers.filter(c => c.status === 'REJECTED');

  const baseColumns = [
    {
      title: 'Telefone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 150,
    },
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || <Text type="secondary">Não informado</Text>,
    },
    {
      title: 'Data de Cadastro',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleDateString('pt-PT') : '-',
    },
  ];

  const actionsColumn = {
    title: 'Ações',
    key: 'actions',
    width: 120,
    render: (_, record) => (
      <Button
        type="primary"
        ghost
        size="small"
        icon={<EyeOutlined />}
        onClick={() => handleViewDetails(record.id)}
      >
        Ver Dossiê
      </Button>
    ),
  };

  const approvedColumns = [
    ...baseColumns,
    {
      title: 'Salário Líquido',
      dataIndex: 'salary',
      key: 'salary',
      render: (salary) => salary ? `${salary.toLocaleString('pt-MZ')} MZN` : '-',
    },
    {
      title: 'Limite de Crédito',
      key: 'creditLimit',
      render: (_, record) => {
        const limit = record.creditLimit || 0;
        
  const getFactor = (key) => {
    try {
      const factors = JSON.parse(selectedCustomer.scoringResults?.[0]?.factors || '{}');
      return factors.bankData?.[key] || factors[key] || 'N/A';
    } catch (e) { return 'N/A'; }
  };

  return (
          <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
            <DollarCircleOutlined /> <strong>{limit.toLocaleString('pt-MZ')} MZN</strong>
          </Tag>
        );
      }
    },
    {
      title: 'Score',
      dataIndex: 'creditScore',
      key: 'score',
      render: (score) => (
        <Badge count={score || 'N/A'} style={{ backgroundColor: (score > 700 ? '#52c41a' : '#faad14') }} />
      ),
    },
    actionsColumn,
  ];

  const notApprovedColumns = [
    ...baseColumns,
    {
      title: 'Critérios Não Cumpridos',
      key: 'rejectionReason',
      render: (_, record) => {
        // Tentar obter o array de razões do scoringResults
        let reasons = [];
        try {
          const factors = JSON.parse(record.scoringResults?.[0]?.factors || '{}');
          const bankReason = factors.bankReason || '';
          if (bankReason && bankReason !== 'Cliente cumpre todos os requisitos bancários') {
            reasons = bankReason.split(' | ').filter(r => r && r !== 'Elegível');
          }
        } catch(e) {}
        // Fallback para rejectionReason simples
        if (reasons.length === 0 && record.rejectionReason) {
          reasons = [record.rejectionReason];
        }
        if (reasons.length === 0) {
          return <Text type="secondary">Análise pendente</Text>;
        }
        return (
          <Space direction="vertical" size={2}>
            {reasons.map((r, i) => (
              <Tag key={i} color="red" style={{ margin: '2px 0' }}>
                <CloseCircleOutlined /> {r}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: () => <Tag color="red">NÃO ELEGÍVEL</Tag>,
    },
    actionsColumn,
  ];

  const items = [
    {
      key: '1',
      label: (
        <span>
          <TeamOutlined /> Todos <Badge count={customers.length} offset={[10, -5]} size="small" />
        </span>
      ),
      children: (
        <Table 
          columns={[...baseColumns, { title: 'Status', key: 'status', render: (_, r) => <Tag color={r.status === 'APPROVED' ? 'green' : 'red'}>{r.status === 'APPROVED' ? 'APROVADO' : 'REJEITADO'}</Tag> }, actionsColumn]} 
          dataSource={customers} 
          rowKey="id" 
          loading={loading} 
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <CheckCircleOutlined /> Aprovados <Badge count={getApproved().length} offset={[10, -5]} size="small" style={{ backgroundColor: '#52c41a' }} />
        </span>
      ),
      children: (
        <Table 
          columns={approvedColumns} 
          dataSource={getApproved()} 
          rowKey="id" 
          loading={loading} 
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <CloseCircleOutlined /> Não Aprovados <Badge count={getNotApproved().length} offset={[10, -5]} size="small" style={{ backgroundColor: '#ff4d4f' }} />
        </span>
      ),
      children: (
        <Table 
          columns={notApprovedColumns} 
          dataSource={getNotApproved()} 
          rowKey="id" 
          loading={loading} 
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}><UserOutlined /> Gestão de Clientes PayJA</Title>
      <Card>
        <Tabs defaultActiveKey="1" items={items} />
      </Card>

      <Modal
        title={<span><FileSearchOutlined /> Dossiê do Cliente</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>Fechar</Button>
        ]}
      >
        {selectedCustomer && (
          <div>
            {selectedCustomer.status === 'REJECTED' ? (
              <Alert
                message="Análise de Risco: NÃO ELEGÍVEL"
                description={
                  <div>
                    <Text strong>Critérios de Elegibilidade Não Cumpridos:</Text>
                    <ul style={{ marginTop: 8, marginBottom: 8 }}>
                      {(() => {
                        let reasons = [];
                        try {
                          const factors = JSON.parse(selectedCustomer.scoringResults?.[0]?.factors || '{}');
                          const bankReason = factors.bankReason || '';
                          if (bankReason && bankReason !== 'Cliente cumpre todos os requisitos bancários') {
                            reasons = bankReason.split(' | ').filter(r => r && r !== 'Elegível');
                          }
                          // Também verificar flags individuais
                          if (reasons.length === 0) {
                            if (factors.isAccountActive === false) reasons.push('Conta Bancária Inativa');
                            if (factors.isBiValid === false) reasons.push('B.I. Expirado ou Inválido');
                            if (factors.isIncumpridor === true) reasons.push('Cliente INCUMPRIDOR (Lista Negra)');
                            if (factors.hasMinimumAccountAge === false) reasons.push('Conta com menos de 6 meses');
                            if (factors.hasSalaryDomiciliation === false) reasons.push('Sem Domiciliação de Salário');
                            if (factors.hasAcceptableEffortRate === false) reasons.push(`Taxa de Esforço Elevada (${factors.effortRate}%)`);
                            if (factors.hasExcessiveDebt === true) reasons.push('Dívida Total Excessiva');
                          }
                        } catch(e) {}
                        if (reasons.length === 0 && selectedCustomer.rejectionReason) {
                          reasons = [selectedCustomer.rejectionReason];
                        }
                        if (reasons.length === 0) {
                          return <li><Text type="danger">Critérios de elegibilidade não especificados</Text></li>;
                        }
                        return reasons.map((r, i) => (
                          <li key={i}><Text type="danger"><CloseCircleOutlined /> {r}</Text></li>
                        ));
                      })()}
                    </ul>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      * O cliente pode corrigir os critérios em falta e o banco pode solicitar nova avaliação.
                    </Text>
                  </div>
                }
                type="error"
                showIcon
                style={{ marginBottom: 20 }}
              />
            ) : (
              <Alert
                message="Análise de Risco: Aprovado"
                description={
                  <div>
                    <Text>Este cliente cumpre todos os requisitos de elegibilidade e políticas de crédito.</Text>
                    <div style={{ marginTop: 10 }}>
                      <Text strong>Limite de Crédito Disponível: </Text>
                      <Text strong style={{ color: '#52c41a', fontSize: '18px' }}>
                        {(selectedCustomer.creditLimit || 0).toLocaleString('pt-MZ')} MZN
                      </Text>
                    </div>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 20 }}
              />
            )}
            
            <Descriptions title="Informações Cadastrais e Financeiras (Paridade Banco GHW)" bordered column={2} size="small">
              <Descriptions.Item label="Nome Completo" span={2}>
                <Text strong>{selectedCustomer.name || 'Não informado'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="NUIT">{selectedCustomer.nuit || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="BI">{selectedCustomer.biNumber || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="Validade do B.I.">{selectedCustomer.biExpiryDate ? new Date(selectedCustomer.biExpiryDate).toLocaleDateString('pt-MZ') : 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Telefone">{selectedCustomer.phoneNumber}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedCustomer.email || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Conta Criada em">{getFactor('conta_criada_em') ? new Date(getFactor('conta_criada_em')).toLocaleDateString('pt-MZ') : 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status Conta">
                <Tag color={getFactor('status_conta') === 'ATIVA' ? 'blue' : 'red'}>{getFactor('status_conta')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Saldo">
                <Text strong>{getFactor('saldo') ? getFactor('saldo').toLocaleString('pt-MZ') + ' MZN' : 'N/A'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Renda Líquida Mensal">
                <Text strong>{selectedCustomer.salary ? selectedCustomer.salary.toLocaleString('pt-MZ') + ' MZN' : 'N/A'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Salário Domiciliado">
                <Text>{getFactor('salario_domiciliado') ? 'SIM' : 'NÃO'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status Crédito">
                <Tag color={getFactor('status_credito') === 'LIMPO' ? 'green' : 'red'}>{getFactor('status_credito')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dívida Total">
                <Text type="danger">{getFactor('divida_total') ? getFactor('divida_total').toLocaleString('pt-MZ') + ' MZN' : '0 MZN'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status PayJA">
                <Tag color={selectedCustomer.status === 'APPROVED' ? 'green' : 'red'}>{selectedCustomer.status === 'APPROVED' ? 'APROVADO' : 'REJEITADO'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Limite PayJA">
                <Text strong style={{ color: selectedCustomer.status === 'APPROVED' ? '#52c41a' : '#ff4d4f' }}>
                  {(selectedCustomer.creditLimit || 0).toLocaleString('pt-MZ')} MZN
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CustomersPage;
