import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UssdSession, UssdFlowEngine } from './ussd.service.js';
import { PayjaApiService } from '../payja/payja-api.service.js';

const activeSessions = new Map();
const flowEngine = new UssdFlowEngine();

export function createUssdRouter(db) {
  const router = express.Router();
  const payjaApi = new PayjaApiService();

  // Funcao para validar numero de telemovel
  function isValidPhoneNumber(phoneNumber) {
    // Remove espacos e caracteres especiais
    const cleaned = phoneNumber.replace(/\D/g, '');
    // Prefixos permitidos (após o código do país ou no número local de 9 dígitos)
    const allowed = ['84','85','83','82','87','86'];

    // Se tiver prefixo internacional 258 + 9 dígitos => total 12 dígitos
    if (/^258\d{9}$/.test(cleaned)) {
      const sub = cleaned.slice(3,5);
      return allowed.includes(sub);
    }

    // Se for número local com 9 dígitos, verificar prefixo
    if (/^\d{9}$/.test(cleaned)) {
      const sub = cleaned.slice(0,2);
      return allowed.includes(sub);
    }

    return false;
  }

  // Iniciar sessao USSD (*299#) - Fluxo unificado
  router.post('/session', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'phoneNumber eh obrigatorio',
      });
    }

    // Validar numero de telemovel
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: 'Numero de telemovel invalido. Deve ter 9 digitos e começar com 82,83,84,85,86 ou 87',
        message: 'END Numero invalido.\\n\\nDeve ter 9 digitos e comecar com 82,83,84,85,86 ou 87.',
      });
    }

    try {
      // Verificar no PayJA se cliente existe
      let customerCheck = { exists: false, customer: null };
      try {
        customerCheck = await payjaApi.checkCustomerExists(phoneNumber);
      } catch (error) {
        // PayJA indisponivel — fallback para DB local
        customerCheck = { exists: false };
      }

      // Função utilitária para calcular limite de crédito local
      function computeLocalCreditLimit(customer) {
        if (!customer) return { eligible: false, creditLimit: 0 };
        // Priorizar campo creditLimit se preenchido
        const existing = parseFloat(customer.creditLimit || customer.customerLimit || 0) || 0;
        if (existing > 0) {
          return { eligible: existing > 0, creditLimit: existing };
        }
        // Derivar do salary e creditScore
        const salary = parseFloat(customer.salary || 0) || 0;
        const score = parseInt(customer.creditScore || 0, 10) || 0;
        let limit = 0;
        if (score >= 600) {
          limit = score * 10; // heurística simples
        } else if (salary > 0) {
          limit = Math.floor(salary * 0.4);
        }
        return { eligible: limit > 0, creditLimit: limit };
      }

      if (!customerCheck.exists) {
        // Se o PayJA não tiver o cliente, tentar ver no BD local
        let localCustomer = null;
        try {
          localCustomer = await db.get('SELECT * FROM customers WHERE phoneNumber = ?', [phoneNumber]);
        } catch (err) {
          // ignore - tabela pode usar outro campo/estar vazia
          localCustomer = null;
        }

        // Se existir localmente, calcular limite/elegibilidade e criar sessao normal
        if (localCustomer) {
          const { eligible, creditLimit } = computeLocalCreditLimit(localCustomer);
          const session = new UssdSession(phoneNumber, 'unified');
          session.isNewCustomer = false;
          session.currentStep = UssdSession.STEPS.UNIFIED.CHECK_CUSTOMER;
          session.setData('name', localCustomer.name || '');
          session.setData('creditLimit', creditLimit || 0);
          session.setData('eligible', eligible);
          session.setData('customerId', localCustomer.id || '');

          activeSessions.set(session.id, session);

          // Salvar sessao local
          await db.run(
            'INSERT INTO ussd_sessions (id, phoneNumber, flow, currentStep, data, status, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              session.id,
              session.phoneNumber,
              session.flow,
              session.currentStep,
              JSON.stringify(session.data),
              session.status,
              session.expiresAt.toISOString(),
            ]
          );

          return res.json({
            sessionId: session.id,
            phoneNumber: session.phoneNumber,
            flow: session.flow,
            message: flowEngine.getResponse(session),
          });
        }

        // Iniciar fluxo de registo para novo cliente
        const session = new UssdSession(phoneNumber, 'unified');
        session.isNewCustomer = true;
        session.currentStep = UssdSession.STEPS.UNIFIED.REGISTER_NAME;
        activeSessions.set(session.id, session);

        // Salvar sessao local
        await db.run(
          'INSERT INTO ussd_sessions (id, phoneNumber, flow, currentStep, data, status, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            session.id,
            session.phoneNumber,
            session.flow,
            session.currentStep,
            JSON.stringify(session.data),
            session.status,
            session.expiresAt.toISOString(),
          ]
        );

        return res.json({
          sessionId: session.id,
          phoneNumber: session.phoneNumber,
          flow: session.flow,
          message: flowEngine.getResponse(session),
        });
      }

      // Criar sessao unificada
      const session = new UssdSession(phoneNumber, 'unified');
      session.currentStep = UssdSession.STEPS.UNIFIED.CHECK_CUSTOMER;
      session.setData('name', customerCheck.customer?.name || '');
      session.setData('creditLimit', customerCheck.customer?.creditLimit || 0);
      session.setData('customerId', customerCheck.customer?.id || '');

      activeSessions.set(session.id, session);

      // Salvar sessao local
      await db.run(
        'INSERT INTO ussd_sessions (id, phoneNumber, flow, currentStep, data, status, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          session.id,
          session.phoneNumber,
          session.flow,
          session.currentStep,
          JSON.stringify(session.data),
          session.status,
          session.expiresAt.toISOString(),
        ]
      );

      res.json({
        sessionId: session.id,
        phoneNumber: session.phoneNumber,
        flow: session.flow,
        message: flowEngine.getResponse(session),
      });
    } catch (error) {
      console.error('Erro ao iniciar sessao:', error.message);
      res.status(500).json({
        error: 'Erro ao iniciar sessao',
        message: 'END Erro ao conectar.\\n\\nTente novamente mais tarde.',
      });
    }
  });

  // Continuar fluxo USSD
  router.post('/continue', async (req, res) => {
    const { sessionId, userInput } = req.body;

    if (!sessionId || userInput === undefined) {
      return res.status(400).json({
        error: 'sessionId e userInput sao obrigatorios',
      });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Sessao nao encontrada',
        message: 'END Sessao expirou.\\n\\nMarque *299# novamente.',
      });
    }

    if (session.isExpired()) {
      activeSessions.delete(sessionId);
      return res.status(410).json({
        error: 'Sessao expirada',
        message: 'END Sessao expirou.\\n\\nMarque *299# novamente.',
      });
    }

    try {
      const steps = UssdSession.STEPS.UNIFIED;
      const input = String(userInput).trim();

      // Registro de novo cliente
      if (session.isNewCustomer) {
        if (session.currentStep === steps.REGISTER_NAME) {
          if (input.length < 3) {
            return res.json({ sessionId: session.id, message: 'CON Nome muito curto.\n\nPor favor introduza o nome completo:' });
          }
          session.setData('name', input);
          session.currentStep = steps.REGISTER_BI;
        } else if (session.currentStep === steps.REGISTER_BI) {
          if (input.length < 5) {
            return res.json({ sessionId: session.id, message: 'CON BI inválido.\n\nDigite o número do BI:' });
          }
          session.setData('bi', input);
          session.currentStep = steps.REGISTER_NUIT;
        } else if (session.currentStep === steps.REGISTER_NUIT) {
          if (!/^\d{9}$/.test(input)) {
            return res.json({ sessionId: session.id, message: 'CON NUIT inválido. Deve ter 9 dígitos.\n\nDigite o NUIT:' });
          }
          session.setData('nuit', input);
          session.currentStep = steps.REGISTER_VALIDATE;
        } else if (session.currentStep === steps.REGISTER_VALIDATE) {
          if (input === '0') {
            session.markCompleted();
            await db.run('UPDATE ussd_sessions SET currentStep = ?, data = ? WHERE id = ?', [session.currentStep, JSON.stringify(session.data), session.id]);
            return res.json({ sessionId: session.id, message: 'END Registo cancelado.\n\nObrigado.', endSession: true });
          }
          if (input !== '1') {
            return res.json({ sessionId: session.id, message: flowEngine.getResponse(session), error: 'Opcao invalida' });
          }

          // Confirmar registo com PayJA
          try {
            const payload = {
              phoneNumber: session.phoneNumber,
              name: session.getData('name'),
              bi: session.getData('bi'),
              nuit: session.getData('nuit'),
            };
            const reg = await payjaApi.registerCustomer(payload);

            // Atualizar sessao e dados
            session.isNewCustomer = false;
            session.setData('creditLimit', reg?.creditLimit || 0);
            session.setData('name', reg?.name || session.getData('name'));
            session.currentStep = steps.CHECK_CUSTOMER;
          } catch (err) {
            console.error('Erro ao registar cliente no PayJA:', err.message);
            return res.json({ sessionId: session.id, message: 'END Falha ao registar. Tente novamente mais tarde.', endSession: true });
          }
        }

        // Persistir sessao a cada passo
        await db.run('UPDATE ussd_sessions SET currentStep = ?, data = ? WHERE id = ?', [session.currentStep, JSON.stringify(session.data), session.id]);

        return res.json({ sessionId: session.id, message: flowEngine.getResponse(session), currentStep: session.currentStep });
      }

      // Processar entrada do usuario
      if (session.currentStep === steps.CHECK_CUSTOMER) {
        if (input === '1') {
          session.currentStep = steps.REQUEST_AMOUNT;
        } else if (input === '2') {
          // Estado do Empréstimo (implementar lógica se necessário)
          return res.json({
            sessionId: session.id,
            message: 'END Estado do Empréstimo: (em desenvolvimento)',
            endSession: true,
          });
        } else if (input === '3') {
          // Simulação (implementar lógica se necessário)
          return res.json({
            sessionId: session.id,
            message: 'END Simulação: (em desenvolvimento)',
            endSession: true,
          });
        } else if (input === '0') {
          session.markCompleted();
          return res.json({
            sessionId: session.id,
            message: 'END Obrigado!\n\nVolta depois.',
            endSession: true,
          });
        } else {
          return res.json({
            sessionId: session.id,
            message: flowEngine.getResponse(session),
            error: 'Opcao invalida',
          });
        }
      }

      // (Todas as etapas de registro removidas)

      // REQUEST_AMOUNT - Pedir valor
      if (session.currentStep === steps.REQUEST_AMOUNT) {
        const amount = parseFloat(input);
        if (isNaN(amount) || amount <= 0) {
          return res.json({
            sessionId: session.id,
            message: 'CON Valor invalido.\\n\\nIntroduza o valor novamente:',
            error: 'Valor deve ser numerico e maior que zero',
          });
        }

        const limit = session.getData('creditLimit') || 0;
        if (amount > limit) {
          return res.json({
            sessionId: session.id,
            message: 'CON Valor superior ao limite.\\n\\nIntroduza outro valor:',
            error: 'Valor excede o limite',
          });
        }

        session.setData('amount', amount);
        session.nextStep();
      }

      // CONFIRM_LOAN
      if (session.currentStep === steps.CONFIRM_LOAN) {
        if (input === '1') {
          session.nextStep();
        } else if (input === '0') {
          session.markCompleted();
          return res.json({
            sessionId: session.id,
            message: 'END Operacao cancelada.\\n\\nObrigado!',
            endSession: true,
          });
        } else {
          return res.json({
            sessionId: session.id,
            message: flowEngine.getResponse(session),
            error: 'Opcao invalida',
          });
        }
      }

      // PROCESSING
      if (session.currentStep === steps.PROCESSING) {
        session.nextStep();
        try {
          await payjaApi.requestLoan({
            phoneNumber: session.phoneNumber,
            amount: session.getData('amount'),
            termMonths: 12,
          });
        } catch (error) {
          console.error('Erro ao solicitar emprestimo:', error.message);
        }
      }

      // LOAN_COMPLETE
      if (session.currentStep === steps.LOAN_COMPLETE) {
        session.markCompleted();
        const message = flowEngine.getResponse(session);
        setTimeout(() => activeSessions.delete(sessionId), 5000);

        return res.json({
          sessionId: session.id,
          message: message,
          endSession: true,
          loanApplied: true,
        });
      }

      // Atualizar sessao
      await db.run(
        'UPDATE ussd_sessions SET currentStep = ?, data = ? WHERE id = ?',
        [session.currentStep, JSON.stringify(session.data), session.id]
      );

      res.json({
        sessionId: session.id,
        message: flowEngine.getResponse(session),
        currentStep: session.currentStep,
      });
    } catch (error) {
      console.error('Erro ao processar input:', error.message);
      res.status(500).json({
        error: 'Erro ao processar',
        message: 'END Erro ao processar.\\n\\nTente novamente.',
      });
    }
  });

  // Listar sessoes ativas
  router.get('/sessions', (req, res) => {
    const sessions = Array.from(activeSessions.values()).map(s => ({
      id: s.id,
      phoneNumber: s.phoneNumber,
      currentStep: s.currentStep,
      isNewCustomer: s.isNewCustomer,
      status: s.status,
    }));

    res.json({
      activeSessions: sessions.length,
      sessions: sessions,
    });
  });

  return router;
}
