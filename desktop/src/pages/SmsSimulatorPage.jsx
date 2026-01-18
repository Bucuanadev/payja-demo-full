import { useState, useEffect } from 'react';
import { Card, List, Badge, Button, Empty, message as antMessage, Space, Typography } from 'antd';
import { PhoneOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

export default function SmsSimulatorPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    // Pegar número do localStorage (do simulador USSD)
    const savedPhone = localStorage.getItem('ussdPhoneNumber') || '+258 84 000 0000';
    setPhoneNumber(savedPhone);
    loadMessages(savedPhone);

    // Auto-refresh a cada 10 segundos
    const interval = setInterval(() => {
      loadMessages(savedPhone);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadMessages = async (phone) => {
    if (!phone) return;
    
    setLoading(true);
    try {
      // Buscar mensagens SMS do backend
      const response = await api.get('/sms/logs', {
        params: { phoneNumber: phone }
      });
      setMessages(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar SMS:', error);
      // Se endpoint não existir, mostrar mensagens mock
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (smsId) => {
    try {
      await api.post(`/sms/${smsId}/read`);
      loadMessages(phoneNumber);
      antMessage.success('SMS marcado como lido');
    } catch (error) {
      antMessage.error('Erro ao marcar SMS como lido');
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'VERIFICATION':
        return 'blue';
      case 'LOAN_STATUS':
        return 'green';
      case 'PAYMENT_REMINDER':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'VERIFICATION':
        return 'Verificação';
      case 'LOAN_STATUS':
        return 'Empréstimo';
      case 'PAYMENT_REMINDER':
        return 'Pagamento';
      case 'NOTIFICATION':
        return 'Notificação';
      default:
        return type;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <PhoneOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Simulador de SMS
                </Title>
                <Text type="secondary">{phoneNumber}</Text>
              </div>
            </Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadMessages(phoneNumber)}
              loading={loading}
            >
              Atualizar
            </Button>
          </Space>
        </Card>

        <Card title="Mensagens Recebidas" extra={<Badge count={messages.length} showZero />}>
          {messages.length === 0 ? (
            <Empty
              image={<MessageOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
              description="Nenhum SMS recebido"
            />
          ) : (
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    item.status === 'SENT' && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => markAsRead(item.id)}
                      >
                        Marcar como lido
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    avatar={<MessageOutlined style={{ fontSize: 24 }} />}
                    title={
                      <Space>
                        <Badge
                          status={item.status === 'SENT' ? 'processing' : 'success'}
                          text={item.status === 'SENT' ? 'Novo' : 'Lido'}
                        />
                        <Badge color={getTypeColor(item.type)} text={getTypeLabel(item.type)} />
                      </Space>
                    }
                    description={
                      <div>
                        <Text>{item.message}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.sentAt || item.createdAt).toLocaleString('pt-MZ')}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={5}>💡 Como usar:</Title>
            <ul>
              <li>Complete o registro em *899# (Simulador USSD)</li>
              <li>Você receberá um código de verificação por SMS aqui</li>
              <li>Digite o código no USSD para concluir o registro</li>
              <li>Após verificado, pode solicitar empréstimos em *898#</li>
              <li>As notificações de empréstimo também aparecem aqui</li>
            </ul>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
