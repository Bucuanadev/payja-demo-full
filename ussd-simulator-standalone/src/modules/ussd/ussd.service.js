import { v4 as uuidv4 } from 'uuid';

export class UssdSession {
  static FLOWS = {
    UNIFIED: 'unified',
  };

  static STEPS = {
    UNIFIED: {
      START: 0,
      CHECK_CUSTOMER: 1,
      REGISTER_NAME: 2,
      REGISTER_BI: 3,
      REGISTER_NUIT: 4,
      REGISTER_VALIDATE: 5,
      REQUEST_AMOUNT: 10,
      CONFIRM_LOAN: 11,
      PROCESSING: 12,
      LOAN_COMPLETE: 13,
      REJECTED: 99,
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
    this.timeout = 5 * 60 * 1000;
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

    if (session.currentStep === steps.REJECTED) {
      const reason = session.getData('rejectionReason') || 'Não cumpre os requisitos mínimos.';
      return `END Pedido Indisponível\n\nLamentamos, mas a sua solicitação não pode ser processada por:\n\n- ${reason}\n\nRegularize a sua situação e tente novamente.`;
    }

    if (session.currentStep === steps.REGISTER_NAME) {
      return `CON Bem-vindo ao Crédito Nedbank\n\nPor favor, introduza o seu nome completo:`;
    }

    if (session.currentStep === steps.REGISTER_BI) {
      return `CON Obrigado. Agora introduza o número do BI:`;
    }

    if (session.currentStep === steps.REGISTER_NUIT) {
      return `CON Último passo: introduza o seu NUIT (9 dígitos):`;
    }

    if (session.currentStep === steps.REGISTER_VALIDATE) {
      return `CON Confirma os seus dados?\n\nNome: ${session.getData('name') || ''}\nBI: ${session.getData('bi') || ''}\nNUIT: ${session.getData('nuit') || ''}\n\n1. Confirmar\n0. Cancelar`;
    }

    if (session.currentStep === steps.CHECK_CUSTOMER) {
      return `CON Crédito Nedbank\n\n1. Crédito Instantâneo\n2. Estado do Empréstimo\n3. Ajuda\n0. Voltar`;
    }

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
      return `END Empréstimo aprovado!\n\nValor: ${amount} MZN\nDesembolsado.\n\nReceba SMS com detalhes.`;
    }

    if (session.currentStep === steps.ERROR) {
      const error = session.getData('error') || 'Erro desconhecido';
      return `END Erro: ${error}`;
    }

    return `CON Menu Principal\n\n1. Solicitar empréstimo\n0. Sair`;
  }
}
