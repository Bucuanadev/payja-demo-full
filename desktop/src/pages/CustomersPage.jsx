import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Descriptions } from 'antd';
import { EyeOutlined, UserOutlined } from '@ant-design/icons';
import api from '../services/api';

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await api.get('/admin/customers');
      setCustomers(response.data);
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
      title: 'Canal',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel) => (
        <Tag color={channel === 'MOVITEL' ? 'blue' : 'green'}>
          {channel || 'APP'}
        </Tag>
      ),
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
      render: (date) => new Date(date).toLocaleDateString('pt-PT'),
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
      <Card title="Clientes" extra={<UserOutlined />}>
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
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
                    render: (date) => new Date(date).toLocaleDateString('pt-PT'),
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
