import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Descriptions, message } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../services/api';

function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      const response = await api.get('/loans');
      setLoans(response.data);
    } catch (error) {
      message.error('Erro ao carregar empréstimos');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (loanId) => {
    try {
      const response = await api.get(`/loans/${loanId}`);
      setSelectedLoan(response.data);
      setModalVisible(true);
    } catch (error) {
      message.error('Erro ao carregar detalhes');
    }
  };

  const handleUpdateStatus = async (loanId, status) => {
    try {
      await api.patch(`/loans/${loanId}/status`, { status });
      message.success(`Empréstimo ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!`);
      loadLoans();
      setModalVisible(false);
    } catch (error) {
      message.error('Erro ao atualizar status');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => id.substring(0, 8),
    },
    {
      title: 'Cliente',
      dataIndex: ['customer', 'phoneNumber'],
      key: 'customer',
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `${amount.toLocaleString('pt-MZ')} MZN`,
    },
    {
      title: 'Prazo',
      dataIndex: 'termMonths',
      key: 'termMonths',
      render: (months) => `${months} meses`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          PENDING: 'orange',
          ANALYZING: 'blue',
          APPROVED: 'green',
          REJECTED: 'red',
          DISBURSED: 'cyan',
          ACTIVE: 'purple',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Score',
      dataIndex: ['scoring', 'finalScore'],
      key: 'score',
      render: (score) => score || 'Calculando...',
    },
    {
      title: 'Data',
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
      <Card title="Gestão de Empréstimos">
        <Table
          columns={columns}
          dataSource={loans}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        title="Detalhes do Empréstimo"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={
          selectedLoan?.status === 'ANALYZING' || selectedLoan?.status === 'PENDING' ? (
            <Space>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => handleUpdateStatus(selectedLoan.id, 'REJECTED')}
              >
                Rejeitar
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleUpdateStatus(selectedLoan.id, 'APPROVED')}
              >
                Aprovar
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedLoan && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="ID">
              {selectedLoan.id}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedLoan.status === 'APPROVED' ? 'green' : 'orange'}>
                {selectedLoan.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Cliente">
              {selectedLoan.customer?.phoneNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Nome">
              {selectedLoan.customer?.name || 'Não informado'}
            </Descriptions.Item>
            <Descriptions.Item label="Valor Solicitado">
              {selectedLoan.amount.toLocaleString('pt-MZ')} MZN
            </Descriptions.Item>
            <Descriptions.Item label="Prazo">
              {selectedLoan.termMonths} meses
            </Descriptions.Item>
            <Descriptions.Item label="Total a Pagar">
              {selectedLoan.totalAmount.toLocaleString('pt-MZ')} MZN
            </Descriptions.Item>
            <Descriptions.Item label="Parcela Mensal">
              {selectedLoan.monthlyPayment.toLocaleString('pt-MZ')} MZN
            </Descriptions.Item>
            <Descriptions.Item label="Motivo" span={2}>
              {selectedLoan.purpose || 'Não especificado'}
            </Descriptions.Item>
            {selectedLoan.scoring && (
              <>
                <Descriptions.Item label="Score de Crédito">
                  {selectedLoan.scoring.finalScore}
                </Descriptions.Item>
                <Descriptions.Item label="Nível de Risco">
                  {selectedLoan.scoring.risk}
                </Descriptions.Item>
                <Descriptions.Item label="Decisão Automática" span={2}>
                  <Tag color={selectedLoan.scoring.decision === 'APPROVED' ? 'green' : 'orange'}>
                    {selectedLoan.scoring.decision}
                  </Tag>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default LoansPage;
