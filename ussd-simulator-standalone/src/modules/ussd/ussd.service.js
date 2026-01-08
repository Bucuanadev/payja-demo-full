import { v4 as uuidv4 } from 'uuid';

export class UssdSession {
  static FLOWS = {
    UNIFIED: 'unified',
  };

  static STEPS = {
    UNIFIED: {
      START: 0,
      CHECK_REGISTRATION: 1,
      // Registro
      REQUEST_REGISTER: 2,
      REQUEST_NAME: 3,
      REQUEST_BI: 4,
      REQUEST_NUIT: 5,
      VALIDATING: 6,
      REGISTRATION_COMPLETE: 7,
      // Empréstimo
      REQUEST_AMOUNT: 10,
      CONFIRM_LOAN: 11,
      PROCESSING: 12,
      LOAN_COMPLETE: 13,
      // Erro
      ERROR: -1,
    },
  };

  constructor(phoneNumber, flow) {
    this.id = uuidv4();
    this.phoneNumber = phoneNumber;
    this.flow = flow;
    this.currentStep = 0;
    this.data = {};
    this.status = 'active';
    this.startedAt = new Date();
    this.timeout = 5 * 60 * 1000; // 5 minutos
    this.expiresAt = new Date(Date.now() + this.timeout);
    this.isNewCustomer = false;
  }

  isExpired() {
    return new Date() > this.expiresAt;
  }

  nextStep() {
    this.currentStep++;
    this.expiresAt = new Date(Date.now() + this.timeout);
  }

  setData(key, value) {
    this.data[key] = value;
  }

  getData(key) {
    return this.data[key];
  }

  markCompleted() {
    this.status = 'completed';
  }

  markError(message) {
    this.status = 'error';
    this.setData('error', message);
  }

  toJSON() {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      flow: this.flow,
      currentStep: this.currentStep,
      data: this.data,
      status: this.status,
      startedAt: this.startedAt,
      expiresAt: this.expiresAt,
      isNewCustomer: this.isNewCustomer,
    };
  }
}

export class UssdFlowEngine {
  getResponse(session) {
    const steps = UssdSession.STEPS.UNIFIED;

    // CHECK_REGISTRATION - Verifica se cliente está registado
    if (session.currentStep === steps.CHECK_REGISTRATION) {
      if (session.isNewCustomer) {
        return `CON Bem-vindo ao PayJA!\n\nRegistro rápido e gratuito.\nLeva apenas 2 minutos!\n\nContinue...`;
      } else {
        return `CON Bem-vindo ${session.getData('name') || 'Cliente'}!\n\nSeu limite: ${session.getData('creditLimit')} MZN\n\n1. Solicitar empréstimo\n0. Sair`;
      }
    }

    // FLUXO DE REGISTRO
    if (session.currentStep === steps.REQUEST_REGISTER) {
      return `CON Para completar o registro:\n\nIntroduza seu nome completo:`;
    }

    if (session.currentStep === steps.REQUEST_NAME) {
      return `CON Introduza seu número de BI:`;
    }

    if (session.currentStep === steps.REQUEST_BI) {
      return `CON Introduza seu número NUIT:`;
    }

    if (session.currentStep === steps.REQUEST_NUIT) {
      return `CON Introduza seu banco (nome):`;
    }

    if (session.currentStep === steps.VALIDATING) {
      return `CON Validando dados...\nAguarde...`;
    }

    if (session.currentStep === steps.REGISTRATION_COMPLETE) {
      const limit = session.getData('creditLimit') || '0';
      return `END ? Registrado com sucesso!\n\nLimite aprovado: ${limit} MZN\n\nReceba SMS com confirmaçao.`;
    }

    // FLUXO DE EMPRÉSTIMO
    if (session.currentStep === steps.REQUEST_AMOUNT) {
      const limit = session.getData('creditLimit') || '0';
      return `CON Solicitação de Empréstimo\n\nSeu limite: ${limit} MZN\n\nIntroduza o valor desejado:`;
    }

    if (session.currentStep === steps.CONFIRM_LOAN) {
      const amount = session.getData('amount');
      const rate = session.getData('interestRate') || '2.5';
      return `CON Confirma empréstimo de ${amount} MZN?\n\nTaxa: ${rate}% ao mês\n\n1. Confirmar\n0. Cancelar`;
    }

    if (session.currentStep === steps.PROCESSING) {
      return `CON Processando seu pedido...\nAguarde...`;
    }

    if (session.currentStep === steps.LOAN_COMPLETE) {
      const amount = session.getData('amount');
      return `END ? Empréstimo aprovado!\n\nValor: ${amount} MZN\nDesembolsado.\n\nReceba SMS com detalhes.`;
    }

    // ERRO
    if (session.currentStep === steps.ERROR) {
      const error = session.getData('error') || 'Erro desconhecido';
      return `END Erro: ${error}`;
    }

    return `CON Menu Principal\n\n1. Solicitar empréstimo\n0. Sair`;
  }
}
