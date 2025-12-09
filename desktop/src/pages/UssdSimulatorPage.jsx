import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Typography, Space, message, Tag, Tabs, Badge, List } from 'antd';
import { MobileOutlined, SendOutlined, PhoneOutlined, MessageOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

function UssdSimulatorPage() {
  const [phoneNumber, setPhoneNumber] = useState('258860000001');
  const [sessionId] = useState(() => `sim_${Date.now()}`);
  const [registrationSessionId] = useState(() => `reg_${Date.now()}`);
  const [currentText, setCurrentText] = useState('');
  const [registrationText, setRegistrationText] = useState('');
  const [movitelText, setMovitelText] = useState('');
  const [messages, setMessages] = useState([]);
  const [registrationMessages, setRegistrationMessages] = useState([]);
  const [movitelMessages, setMovitelMessages] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [isRegistrationActive, setIsRegistrationActive] = useState(false);
  const [isMovitelActive, setIsMovitelActive] = useState(false);
  const [smsMessages, setSmsMessages] = useState([]);
  const [smsLoading, setSmsLoading] = useState(false);

  // Salvar telefone no localStorage para o simulador de SMS
  React.useEffect(() => {
    localStorage.setItem('ussdPhoneNumber', phoneNumber);
  }, [phoneNumber]);

  // Carregar SMS do número selecionado
  const loadSmsMessages = async () => {
    if (!phoneNumber) return;
    
    setSmsLoading(true);
    try {
      const response = await api.get('/sms/logs', {
        params: { phoneNumber }
      });
      setSmsMessages(response.data);
    } catch (error) {
      console.error('Erro ao carregar SMS:', error);
    } finally {
      setSmsLoading(false);
    }
  };

  // Carregar SMS quando trocar número
  useEffect(() => {
    loadSmsMessages();
  }, [phoneNumber]);

  // Auto-refresh SMS a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadSmsMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [phoneNumber]);

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

  const startRegistrationSession = async () => {
    try {
      const response = await api.post('/ussd/registration/simulate', {
        sessionId: registrationSessionId,
        phoneNumber,
        text: '',
      });
      
      setRegistrationMessages([{ type: 'system', content: response.data.message }]);
      setIsRegistrationActive(response.data.continueSession);
      setRegistrationText('');
    } catch (error) {
      console.error('Error starting registration session:', error);
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

  const sendRegistrationInput = async () => {
    if (!registrationText) return;

    const userMessage = { type: 'user', content: registrationText };
    setRegistrationMessages((prev) => [...prev, userMessage]);

    try {
      const fullText = registrationMessages
        .filter((m) => m.type === 'user')
        .map((m) => m.content)
        .join('*');
      
      const finalText = fullText ? `${fullText}*${registrationText}` : registrationText;

      const response = await api.post('/ussd/registration/simulate', {
        sessionId: registrationSessionId,
        phoneNumber,
        text: finalText,
      });

      setRegistrationMessages((prev) => [
        ...prev,
        { type: 'system', content: response.data.message },
      ]);
      setIsRegistrationActive(response.data.continueSession);
      setRegistrationText('');
    } catch (error) {
      console.error('Error sending registration input:', error);
      setRegistrationMessages((prev) => [
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

  const resetRegistrationSession = () => {
    setRegistrationMessages([]);
    setRegistrationText('');
    setIsRegistrationActive(false);
  };

  const startMovitelSession = async () => {
    try {
      const newSessionId = `mov_${Date.now()}_${phoneNumber}`;
      const response = await api.post('/movitel/ussd/callback', {
        sessionId: newSessionId,
        msisdn: phoneNumber,
        userInput: '',
        network: 'MOVITEL',
      });
      
      setMovitelMessages([
        { type: 'system', content: response.data.response, sessionId: newSessionId }
      ]);
      setIsMovitelActive(!response.data.shouldClose);
      setMovitelText('');
    } catch (error) {
      console.error('Error starting Movitel session:', error);
      message.error('Erro ao iniciar sessão Movitel');
    }
  };

  const sendMovitelInput = async () => {
    if (!movitelText) return;

    const userMessage = { type: 'user', content: movitelText };
    setMovitelMessages((prev) => [...prev, userMessage]);

    try {
      // Pegar sessionId da última mensagem do sistema
      const lastSystemMessage = movitelMessages.filter(m => m.sessionId).pop();
      const currentSessionId = lastSystemMessage?.sessionId || `mov_${Date.now()}_${phoneNumber}`;
      
      const response = await api.post('/movitel/ussd/callback', {
        sessionId: currentSessionId,
        msisdn: phoneNumber,
        userInput: movitelText,
        network: 'MOVITEL',
      });

      setMovitelMessages((prev) => [
        ...prev,
        { type: 'system', content: response.data.response, sessionId: currentSessionId },
      ]);
      setIsMovitelActive(!response.data.shouldClose);
      setMovitelText('');
    } catch (error) {
      console.error('Error sending Movitel input:', error);
      setMovitelMessages((prev) => [
        ...prev,
        { type: 'error', content: 'Erro ao processar solicitação' },
      ]);
    }
  };

  const resetMovitelSession = () => {
    setMovitelMessages([]);
    setMovitelText('');
    setIsMovitelActive(false);
  };

  const renderSimulator = (
    messages,
    currentText,
    setCurrentText,
    isActive,
    sendInput,
    startSession,
    resetSession,
    ussdCode
  ) => (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ textAlign: 'center' }}>
          <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
            {ussdCode}
          </Tag>
        </div>

        <div
          style={{
            backgroundColor: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
            minHeight: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: '12px',
                textAlign: msg.type === 'user' ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor:
                    msg.type === 'user'
                      ? '#1890ff'
                      : msg.type === 'error'
                      ? '#ff4d4f'
                      : '#fff',
                  color: msg.type === 'user' ? '#fff' : '#000',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '80%',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {!isActive && messages.length === 0 && (
          <Button
            type="primary"
            icon={<PhoneOutlined />}
            onClick={startSession}
            size="large"
            block
          >
            Iniciar Sessão {ussdCode}
          </Button>
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
  );

  return (
    <div>
      <Title level={2}>
        <MobileOutlined /> Simulador USSD
      </Title>

      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Text strong>Selecione Número Movitel:</Text>
        <Space>
          <Button 
            type={phoneNumber === '258860000001' ? 'primary' : 'default'}
            onClick={() => setPhoneNumber('258860000001')}
          >
            258 86 000 0001
          </Button>
          <Button 
            type={phoneNumber === '258870000002' ? 'primary' : 'default'}
            onClick={() => setPhoneNumber('258870000002')}
          >
            258 87 000 0002
          </Button>
          <Button 
            type={phoneNumber === '258860000003' ? 'primary' : 'default'}
            onClick={() => setPhoneNumber('258860000003')}
          >
            258 86 000 0003
          </Button>
        </Space>
        <Text type="secondary">
          <PhoneOutlined /> Número ativo: <Text strong>{phoneNumber}</Text>
        </Text>
      </Space>
      
      <Tabs defaultActiveKey="3" size="large">
        <TabPane 
          tab={
            <span>
              <ThunderboltOutlined />
              *898# - Txeneka Male (Movitel)
            </span>
          } 
          key="3"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {renderSimulator(
              movitelMessages,
              movitelText,
              setMovitelText,
              isMovitelActive,
              sendMovitelInput,
              startMovitelSession,
              resetMovitelSession,
              '*898# Txeneka Male'
            )}

            <Card 
              title={
                <Space>
                  <MessageOutlined />
                  <span>📥 Caixa de Mensagens SMS</span>
                  <Badge count={smsMessages.length} />
                </Space>
              }
              extra={
                <Button 
                  size="small" 
                  onClick={loadSmsMessages} 
                  loading={smsLoading}
                >
                  Atualizar
                </Button>
              }
              style={{ background: '#fafafa' }}
            >
              {smsMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  <MessageOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>Nenhuma mensagem SMS recebida</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>
                    As mensagens aparecerão aqui automaticamente
                  </div>
                </div>
              ) : (
                <List
                  dataSource={smsMessages}
                  renderItem={(sms) => (
                    <List.Item>
                      <Card 
                        size="small" 
                        style={{ width: '100%', background: '#fff' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <Tag color={
                              sms.type === 'VERIFICATION' ? 'blue' :
                              sms.type === 'LOAN_STATUS' ? 'green' :
                              'orange'
                            }>
                              {sms.type}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(sms.sentAt).toLocaleString('pt-PT')}
                            </Text>
                          </Space>
                          <Text strong style={{ whiteSpace: 'pre-wrap' }}>
                            {sms.message}
                          </Text>
                        </Space>
                      </Card>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Space>
        </TabPane>
      </Tabs>

      <Card style={{ marginTop: 24, background: '#f0f5ff' }}>
        <Space direction="vertical">
          <Title level={5}>💡 Como usar:</Title>
          <ul style={{ marginBottom: 0 }}>
            <li><strong>Números Movitel</strong> - Escolha um dos 3 números (86 ou 87) para simular diferentes usuários</li>
            <li><strong>*898# Txeneka Male</strong> - Sistema completo de registro e empréstimos via USSD Movitel</li>
            <li><strong>Primeiro Acesso</strong>: Sistema detecta usuário novo → Registro (NUIT → BI → Instituição → OTP via SMS)</li>
            <li><strong>Empréstimo</strong>: Digite valor → Escolha finalidade → Selecione banco → Aceite termos</li>
            <li><strong>📥 Caixa de Mensagens SMS</strong>: Códigos OTP e confirmações aparecem automaticamente abaixo do simulador (auto-refresh 5s)</li>
            <li><strong>Troca de Número</strong>: Ao selecionar outro número, a caixa de SMS é atualizada automaticamente</li>
          </ul>
        </Space>
      </Card>
    </div>
  );
}

export default UssdSimulatorPage;
