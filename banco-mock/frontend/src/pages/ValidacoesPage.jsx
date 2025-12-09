import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, message, Descriptions, Modal } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const ValidacoesPage = () => {
  const [loading, setLoading] = useState(false);
  const [validacoes, setValidacoes] = useState([]);
  const [selectedValidacao, setSelectedValidacao] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    loadValidacoes();
  }, []);

  const loadValidacoes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/validacao/historico');
      setValidacoes(response.data.validacoes || []);
    } catch (error) {
      message.error('Erro ao carregar validações');
    } finally {
      setLoading(false);
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={status === 'APROVADO' ? 'success' : 'error'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score_calculado',
      key: 'score',
      width: 100,
      render: (score) => score ? `${score}%` : '-',
    },
    {
      title: 'Limite Aprovado',
      dataIndex: 'limite_aprovado',
      key: 'limite',
      width: 150,
      render: (limite) => limite ? `${limite.toLocaleString()} MZN` : '-',
    },
    {
      title: 'Motivo Rejeição',
      dataIndex: 'motivo_rejeicao',
      key: 'motivo',
      ellipsis: true,
      render: (motivo) => motivo || '-',
    },
    {
      title: 'Data',
      dataIndex: 'criado_em',
      key: 'data',
      width: 180,
      render: (data) => new Date(data).toLocaleString('pt-MZ'),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedValidacao(record);
            setIsModalVisible(true);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Histórico de Validações"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadValidacoes}>
            Atualizar
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={validacoes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="Detalhes da Validação"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Fechar
          </Button>,
        ]}
        width={700}
      >
        {selectedValidacao && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="NUIT" span={2}>
                {selectedValidacao.nuit}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedValidacao.status === 'APROVADO' ? 'success' : 'error'}>
                  {selectedValidacao.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Score Calculado">
                {selectedValidacao.score_calculado ? `${selectedValidacao.score_calculado}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Limite Aprovado" span={2}>
                {selectedValidacao.limite_aprovado 
                  ? `${selectedValidacao.limite_aprovado.toLocaleString()} MZN` 
                  : '-'}
              </Descriptions.Item>
              {selectedValidacao.motivo_rejeicao && (
                <Descriptions.Item label="Motivo Rejeição" span={2}>
                  {selectedValidacao.motivo_rejeicao}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Data" span={2}>
                {new Date(selectedValidacao.criado_em).toLocaleString('pt-MZ')}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: 16 }}>Requisição (PayJA)</h4>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: 12, 
              borderRadius: 4,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 200,
            }}>
              {JSON.stringify(selectedValidacao.requisicao, null, 2)}
            </pre>
          </>
        )}
      </Modal>
    </div>
  );
};

export default ValidacoesPage;
