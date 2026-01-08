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
    
    // Verifica se comeca com 86 ou 87 e tem 9 digitos
    return /^(86|87)\d{7}$/.test(cleaned);
  }

  // Iniciar sessao USSD (*898#) - Fluxo unificado
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
        error: 'Numero de telemovel invalido. Deve comecar com 86 ou 87',
        message: 'END Numero invalido.\\n\\nDeve comecar com 86 ou 87.',
      });
    }

    try {
      // Verificar no PayJA se cliente existe
      let customerCheck = { exists: false, customer: null };
      
      try {
        customerCheck = await payjaApi.checkCustomerExists(phoneNumber);
      } catch (error) {
        console.log('Cliente nao encontrado no PayJA, considerando como novo');
        customerCheck = { exists: false };
      }

      // Criar sessao unificada
      const session = new UssdSession(phoneNumber, 'unified');
      session.nextStep(); // Vai para CHECK_REGISTRATION

      if (customerCheck.exists) {
        // Cliente ja registrado - Fluxo de emprestimo
        session.isNewCustomer = false;
        session.setData('name', customerCheck.customer?.name || '');
        session.setData('creditLimit', customerCheck.customer?.creditLimit || 0);
        session.setData('customerId', customerCheck.customer?.id || '');
      } else {
        // Cliente novo - Fluxo de registro
        session.isNewCustomer = true;
      }

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
        isNewCustomer: session.isNewCustomer,
        payjaConnection: customerCheck.exists ? 'found' : 'new',
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
        message: 'END Sessao expirou.\\n\\nMarque *898# novamente.',
      });
    }

    if (session.isExpired()) {
      activeSessions.delete(sessionId);
      return res.status(410).json({
        error: 'Sessao expirada',
        message: 'END Sessao expirou.\\n\\nMarque *898# novamente.',
      });
    }

    try {
      const steps = UssdSession.STEPS.UNIFIED;
      const input = String(userInput).trim();

      // Processar entrada do usuario
      if (session.currentStep === steps.CHECK_REGISTRATION) {
        if (session.isNewCustomer) {
          session.nextStep(); // REQUEST_REGISTER
        } else {
          if (input === '1') {
            session.currentStep = steps.REQUEST_AMOUNT;
          } else if (input === '0') {
            session.markCompleted();
            return res.json({
              sessionId: session.id,
              message: 'END Obrigado!\\n\\nVolta depois.',
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
      }

      // REQUEST_REGISTER - Pedir nome
      if (session.currentStep === steps.REQUEST_REGISTER) {
        session.setData('name', input);
        session.nextStep();
      }

      // REQUEST_NAME - Pedir BI
      if (session.currentStep === steps.REQUEST_NAME) {
        session.setData('bi', input);
        session.nextStep();
      }

      // REQUEST_BI - Pedir NUIT
      if (session.currentStep === steps.REQUEST_BI) {
        session.setData('nuit', input);
        session.nextStep();
      }

      // REQUEST_NUIT - Pedir banco
      if (session.currentStep === steps.REQUEST_NUIT) {
        session.setData('salaryBank', input);
        session.nextStep();
      }

      // VALIDATING - Simular validacao
      if (session.currentStep === steps.VALIDATING) {
        session.setData('creditLimit', 10000);
        session.nextStep();
      }

      // REGISTRATION_COMPLETE
      if (session.currentStep === steps.REGISTRATION_COMPLETE) {
        try {
          await payjaApi.registerCustomer({
            phoneNumber: session.phoneNumber,
            name: session.getData('name'),
            idDocument: session.getData('bi'),
            nuit: session.getData('nuit'),
          });
        } catch (error) {
          console.error('Erro ao registar cliente:', error.message);
        }

        session.markCompleted();
        const message = flowEngine.getResponse(session);
        setTimeout(() => activeSessions.delete(sessionId), 5000);

        return res.json({
          sessionId: session.id,
          message: message,
          endSession: true,
          registered: true,
        });
      }

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
          const reason = session.getData('reason') || null;
          const customerName = session.getData('name') || null;

          // Send full payload to PayJA including reason and customerName
          const resp = await payjaApi.requestLoan({
            phoneNumber: session.phoneNumber,
            amount: session.getData('amount'),
            termMonths: 12,
            reason,
            customerName
          });

          // Persist a local loan transaction in the simulator DB so loans.html shows it
          try {
            const id = uuidv4();
            const customerRow = await db.get(`SELECT id FROM customers WHERE phoneNumber = ?`, [session.phoneNumber]);
            const customerId = customerRow ? customerRow.id : null;
            const description = JSON.stringify({ termMonths: 12, payjaResponse: resp || null, reason, customerName });
            // Insert pending row, then update with PayJA status if available
            await db.run(`INSERT INTO transactions (id, customerId, type, amount, status, description, metadata, createdAt, updatedAt) VALUES (?, ?, 'loan', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, customerId, session.getData('amount'), 'pending', description, reason]);

            // If PayJA returned an identifier or success flag, update local transaction status
            try {
              const payjaId = resp?.id || resp?.loanId || resp?.data?.id || null;
              const payjaStatus = resp?.success ? 'ENVIADO_PAYJA' : (resp?.status || null);
              if (payjaId || payjaStatus) {
                const newDesc = JSON.stringify({ termMonths: 12, payjaResponse: resp || null, reason, customerName });
                const newMeta = JSON.stringify({ payjaId: payjaId || null });
                await db.run(`UPDATE transactions SET status = ?, description = ?, metadata = ? WHERE id = ?`, [payjaStatus || 'ENVIADO_PAYJA', newDesc, newMeta, id]);
              }
            } catch (updErr) {
              console.warn('Aviso: falha ao atualizar transacao com resposta do PayJA:', updErr?.message || updErr);
            }
          } catch (dbErr) {
            console.error('Erro ao gravar emprestimo localmente:', dbErr?.message || dbErr);
          }
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
