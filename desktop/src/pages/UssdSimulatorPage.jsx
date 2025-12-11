import React, { useState } from 'react';
import { Card, Input, Button, Typography, Space } from 'antd';
import { MobileOutlined, SendOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

function UssdSimulatorPage() {
  const [phoneNumber, setPhoneNumber] = useState('258840000000');
  const [sessionId] = useState(() => `sim_${Date.now()}`);
  const [currentText, setCurrentText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isActive, setIsActive] = useState(false);

  const startSession = async () => {
    try {
      const response = await api.post('/ussd/simulate', {
        sessionId,
        phoneNumber,
        text: '',
      });
      
      setMessages([{ type: 'system', content: response.data.message }]);
      setIsActive(response.data.continueSession);
      setCurrentText('');
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const sendInput = async () => {
    if (!currentText) return;

    const userMessage = { type: 'user', content: currentText };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const fullText = messages
        .filter((m) => m.type === 'user')
        .map((m) => m.content)
        .join('*');
      
      const finalText = fullText ? `${fullText}*${currentText}` : currentText;

      const response = await api.post('/ussd/simulate', {
        sessionId,
        phoneNumber,
        text: finalText,
      });

      setMessages((prev) => [
        ...prev,
        { type: 'system', content: response.data.message },
      ]);
      setIsActive(response.data.continueSession);
      setCurrentText('');
    } catch (error) {
      console.error('Error sending input:', error);
      setMessages((prev) => [
        ...prev,
        { type: 'error', content: 'Erro ao processar solicitação' },
      ]);
    }
  };

  const resetSession = () => {
    setMessages([]);
    setCurrentText('');
    setIsActive(false);
  };

  return (
    <div>
      <Title level={2}>Simulador USSD</Title>
      
      <Card style={{ maxWidth: 600, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>Número de Telefone:</Text>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="258840000000"
              prefix={<MobileOutlined />}
              disabled={isActive}
            />
          </div>

          {!isActive && messages.length === 0 && (
            <Button
              type="primary"
              onClick={startSession}
              block
              size="large"
            >
              Discar *898#
            </Button>
          )}

          {messages.length > 0 && (
            <Card
              style={{
                background: '#f5f5f5',
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 12,
                    padding: 8,
                    background: msg.type === 'user' ? '#e6f7ff' : 'white',
                    borderRadius: 4,
                    whiteSpace: 'pre-line',
                  }}
                >
                  <Text strong>{msg.type === 'user' ? 'Você: ' : 'USSD: '}</Text>
                  <Text>{msg.content}</Text>
                </div>
              ))}
            </Card>
          )}

          {isActive && (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                onPressEnter={sendInput}
                placeholder="Digite sua resposta..."
                size="large"
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={sendInput}
                size="large"
              >
                Enviar
              </Button>
            </Space.Compact>
          )}

          {messages.length > 0 && (
            <Button onClick={resetSession} block>
              Nova Sessão
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default UssdSimulatorPage;
