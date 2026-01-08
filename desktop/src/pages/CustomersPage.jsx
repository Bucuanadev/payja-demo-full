
import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Descriptions, message } from 'antd';
import { EyeOutlined, UserOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import api from '../services/api';


function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingUssd, setLoadingUssd] = useState(false);


  useEffect(() => {
    // Load main customers; loadCustomers will also import USSD customers
    (async () => {
      await loadCustomers();
    })();
  }, []);

  const loadUssdCustomers = async () => {
    setLoadingUssd(true);
    try {
      const response = await fetch('http://155.138.228.89:3001/api/payja/ussd/new-customers');
      if (!response.ok) throw new Error('Erro ao buscar novos clientes USSD');
      const data = await response.json();
      // normalize incoming USSD customers and merge into main customers list
      const list = Array.isArray(data) ? data : (data?.data || []);
      const normalized = list.map((c) => {
        const phone = c.phoneNumber || c.phone || c.msisdn || '';
        return {
          id: c.id || phone || `${phone}-${c.nuit || ''}`,
          phoneNumber: phone,
          name: c.name || c.fullName || c.customerName || 'Cliente',
          nuit: c.nuit || null,
          biNumber: c.biNumber || c.bi || null,
          institution: c.institution || c.salaryBank || c.empregador || null,
          verified: !!c.verified,
          email: c.email || null,
          creditLimit: typeof c.creditLimit === 'number' ? c.creditLimit : (c.customerLimit || null),
          creditScore: typeof c.creditScore === 'number' ? c.creditScore : (c.score || c.score_credito || null),
          salary: typeof c.salary === 'number' ? c.salary : (c.salario || null),
          salaryBank: c.salaryBank || c.empregador || null,
          createdAt: c.createdAt || c.registrationDate || new Date().toISOString(),
          raw: c,
        };
      });
      setCustomers(prev => {
        const byPhone = {};
        prev.forEach(p => { byPhone[p.phoneNumber] = p; });
        for (const n of normalized) {
          const key = n.phoneNumber || n.id;
          if (!key) continue;
          if (byPhone[key]) {
            // merge but preserve backend `verified` when already verified
            byPhone[key] = {
              ...byPhone[key],
              ...n,
              name: n.name || byPhone[key].name,
              verified: (byPhone[key].verified === true) || !!n.verified,
            };
          } else {
            byPhone[key] = n;
          }
        }
        return Object.values(byPhone).sort((a,b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
      });
      message.success('Novos clientes USSD carregados!');
    } catch (error) {
      message.error('Erro ao buscar novos clientes USSD');
    } finally {
      setLoadingUssd(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get('/admin/customers');
      const data = res.data || [];
      const normalized = (Array.isArray(data) ? data : []).map((c) => {
        const phone = c.phoneNumber || c.phone || c.msisdn || c.phone_number || c.msisdn_raw || c.contact || c.contacts?.[0];
        const id = c.id || phone || c.nuit || `${phone || 'unknown'}-${c.nuit || ''}`;
        const name = c.name || c.fullName || c.full_name || c.customerName || c.firstName || c.lastName || '';
        let createdAt = c.createdAt || c.created_at || c.created || c.date || c.createdAtUtc || null;
        if (typeof createdAt === 'number') createdAt = new Date(createdAt).toISOString();
        if (createdAt && isNaN(new Date(createdAt).getTime())) createdAt = null;
        return {
          ...c,
          id,
          phoneNumber: phone,
          name,
          createdAt,
          loans: c.loans || [],
          scoringResults: c.scoringResults || c.scoring_results || [],
        };
      });
      setCustomers(normalized);
      // After loading main customers, also fetch USSD/new customers and merge
      try {
        await loadUssdCustomers();
      } catch (e) {
        // swallow - loadUssdCustomers already shows notifications
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (customerId) => {
    try {
      const response = await api.get(`/admin/customers/${customerId}`);
      setSelectedCustomer(response.data);
      setModalVisible(true);
    } catch (error) {
      console.error('Error loading customer details:', error);
    }
  };

  const columns = [
    {
      title: 'Telefone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || 'Não informado',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <>
          {record.verified && <Tag color="green">Verificado</Tag>}
          {record.blocked && <Tag color="red">Bloqueado</Tag>}
          {!record.verified && !record.blocked && <Tag>Não verificado</Tag>}
        </>
      ),
    },
    {
      title: 'Empréstimos',
      dataIndex: 'loans',
      key: 'loans',
      render: (loans) => loans?.length || 0,
    },
    {
      title: 'Último Score',
      dataIndex: ['scoringResults', '0', 'finalScore'],
      key: 'score',
      render: (score) => score || '-',
    },
    {
      title: 'Data de Cadastro',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => {
        if (!date) return '-';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-PT');
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record.id)}
        >
          Ver
        </Button>
      ),
    },
  ];


  return (
    <div>
      <Card
        title="Clientes"
        extra={
          <>
            <Button
              icon={<CloudDownloadOutlined />}
              loading={loadingUssd}
              onClick={loadUssdCustomers}
              style={{ marginRight: 8 }}
            >
              Novos Clientes USSD
            </Button>
            <UserOutlined />
          </>
        }
      >
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
        {/* USSD customers are merged into main `customers` table; no separate UI block */}
      </Card>

      <Modal
        title="Detalhes do Cliente"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedCustomer && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Telefone">
                {selectedCustomer.phoneNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Nome">
                {selectedCustomer.name || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="NUIT">
                {selectedCustomer.nuit || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="BI">
                {selectedCustomer.biNumber || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedCustomer.email || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Limite de Crédito">
                {selectedCustomer.creditLimit ? `${selectedCustomer.creditLimit.toLocaleString('pt-MZ')} MZN` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Score de Crédito">
                {selectedCustomer.creditScore || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Salário">
                {selectedCustomer.salary ? `${selectedCustomer.salary.toLocaleString('pt-MZ')} MZN` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Empregador">
                {selectedCustomer.salaryBank || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedCustomer.verified ? (
                  <Tag color="green">Verificado</Tag>
                ) : (
                  <Tag>Não verificado</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Histórico de Empréstimos" size="small">
              <Table
                size="small"
                dataSource={selectedCustomer.loans}
                rowKey="id"
                columns={[
                  {
                    title: 'Valor',
                    dataIndex: 'amount',
                    render: (amount) => `${amount.toLocaleString('pt-MZ')} MZN`,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    render: (status) => <Tag>{status}</Tag>,
                  },
                  {
                    title: 'Data',
                    dataIndex: 'createdAt',
                    render: (date) => {
                      if (!date) return '-';
                      const d = new Date(date);
                      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-PT');
                    },
                  },
                ]}
                pagination={false}
              />
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
}

export default CustomersPage;
