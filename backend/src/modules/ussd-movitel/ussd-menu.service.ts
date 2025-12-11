import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OtpService } from './otp.service';
import { LoansService } from '../loans/loans.service';
import { ScoringService } from '../scoring/scoring.service';
import { CrossValidationService } from '../cross-validation/cross-validation.service';

interface UssdResponse {
  response: string;
  shouldClose: boolean;
}

@Injectable()
export class UssdMenuService {
  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
    private loansService: LoansService,
    private scoringService: ScoringService,
    private crossValidationService: CrossValidationService,
  ) {}

  async processStep(
    sessionId: string,
    msisdn: string,
    currentStep: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    console.log('[USSD-MENU] Processando:', { currentStep, userInput });

    // Se está em REGISTER_OTP, processar como OTP independente do estado
    if (currentStep === 'REGISTER_OTP') {
      return this.handleOtpInput(sessionId, msisdn, userInput, state);
    }

    switch (currentStep) {
      case 'MAIN':
        return this.showMainMenu(sessionId, msisdn, userInput);

      case 'REGISTER_INIT':
        return this.handleRegisterInit(sessionId, userInput);

      case 'REGISTER_NUIT':
        return this.handleNuitInput(sessionId, msisdn, userInput, state);

      case 'REGISTER_BI':
        return this.handleBiInput(sessionId, userInput, state);

      case 'REGISTER_INSTITUTION':
        return this.handleInstitutionInput(sessionId, msisdn, userInput, state);

      case 'REGISTER_OTP':
        return this.handleOtpInput(sessionId, msisdn, userInput, state);

      case 'LOAN_AMOUNT':
        return this.handleLoanAmount(sessionId, msisdn, userInput, state);

      case 'LOAN_CONFIRM':
        return this.handleLoanConfirm(sessionId, userInput, state);

      case 'LOAN_PURPOSE':
        return this.handleLoanPurpose(sessionId, userInput, state);

      case 'LOAN_BANK':
        return this.handleBankSelection(sessionId, userInput, state);

      case 'LOAN_TERMS':
        return this.handleTermsAcceptance(sessionId, msisdn, userInput, state);

      case 'MY_LOANS':
        return this.showMyLoans(msisdn);

      case 'MY_PROFILE':
        return this.showProfile(msisdn);

      default:
        return {
          response: 'Erro no fluxo. Tente novamente.',
          shouldClose: true,
        };
    }
  }

  // ========== MENU PRINCIPAL ==========
  private async showMainMenu(
    sessionId: string,
    msisdn: string,
    userInput: string,
  ): Promise<UssdResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: msisdn },
    });

    // Cliente não registrado ou não verificado
    if (!customer || !customer.verified) {
      await this.updateSession(sessionId, 'REGISTER_INIT', {});
      return {
        response:
          'Nao estas registrado. Efectue registro (2min):\n\n1. Registrar\n2. Cancelar',
        shouldClose: false,
      };
    }

    // Cliente registrado - mostrar menu
    if (!userInput || userInput === '') {
      return {
        response:
          'Bem-vindo ao Txeneka Male!\n\n1. Solicitar emprestimo\n2. Meus emprestimos\n3. Meu perfil\n4. Ajuda',
        shouldClose: false,
      };
    }

    // Processar escolha do menu
    if (userInput === '1') {
      await this.updateSession(sessionId, 'LOAN_AMOUNT', {});
      const limit = customer.creditLimit || customer.salary ? customer.salary * 2 : 50000;
      return {
        response: `Digite valor (1000 - ${limit} MZN):`,
        shouldClose: false,
      };
    }

    if (userInput === '2') {
      return this.showMyLoans(msisdn);
    }

    if (userInput === '3') {
      return this.showProfile(msisdn);
    }

    if (userInput === '4') {
      return {
        response:
          'AJUDA - Txeneka Male\n\nCentral: 0800-PAYJA\nWhatsApp: +258 84 123 4567\nEmail: suporte@payja.co.mz',
        shouldClose: true,
      };
    }

    return {
      response:
        'Opcao invalida.\n\n1. Solicitar emprestimo\n2. Meus emprestimos\n3. Meu perfil\n4. Ajuda',
      shouldClose: false,
    };
  }

  // ========== FLUXO DE REGISTRO ==========
  private async handleRegisterInit(
    sessionId: string,
    userInput: string,
  ): Promise<UssdResponse> {
    // Primeira vez - mostrar mensagem de boas-vindas
    if (!userInput || userInput === '') {
      return {
        response: 'Nao estas registrado. Efectue registro (2min):\n\n1. Registrar\n2. Cancelar',
        shouldClose: false,
      };
    }

    if (userInput === '2') {
      await this.closeSession(sessionId);
      return {
        response: 'Registro cancelado.',
        shouldClose: true,
      };
    }

    if (userInput === '1') {
      await this.updateSession(sessionId, 'REGISTER_NUIT', {});
      return {
        response: 'Digite NUIT (9 digitos):',
        shouldClose: false,
      };
    }

    return {
      response:
        'Opcao invalida.\n\n1. Registrar\n2. Cancelar',
        shouldClose: false,
    };
  }

  private async handleNuitInput(
    sessionId: string,
    msisdn: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    // Validar apenas 9 dígitos numéricos
    const nuitRegex = /^\d{9}$/;
    if (!nuitRegex.test(userInput)) {
      return {
        response: 'NUIT invalido. Digite 9 digitos.\n\nTente novamente:',
        shouldClose: false,
      };
    }

    // Verificar se NUIT já existe
    const existing = await this.prisma.customer.findFirst({
      where: { nuit: userInput },
    });

    if (existing) {
      return {
        response: 'NUIT ja registrado. Contacte suporte.',
        shouldClose: true,
      };
    }

    state.nuit = userInput;
    await this.updateSession(sessionId, 'REGISTER_BI', state);

    return {
      response: 'Digite numero do BI:',
      shouldClose: false,
    };
  }

  private async handleBiInput(
    sessionId: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    if (userInput.length < 9) {
      return {
        response: 'BI deve ter pelo menos 9 caracteres.\n\nTente novamente:',
        shouldClose: false,
      };
    }

    state.bi = userInput;
    await this.updateSession(sessionId, 'REGISTER_INSTITUTION', state);

    return {
      response: 'Digite Instituicao/Empresa onde trabalha:',
      shouldClose: false,
    };
  }

  private async handleInstitutionInput(
    sessionId: string,
    msisdn: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    if (userInput.length < 3) {
      return {
        response: 'Nome muito curto.\n\nDigite novamente:',
        shouldClose: false,
      };
    }

    state.institution = userInput;

    // Gerar e enviar OTP
    console.log('[USSD-MENU] Gerando OTP para:', msisdn);
    const otp = await this.otpService.generateAndSendOTP(sessionId, msisdn);

    await this.updateSessionWithOtp(sessionId, 'REGISTER_OTP', state, otp);

    return {
      response: `Enviamos OTP para ${msisdn}. Verifique SMS.`,
      shouldClose: true, // Fecha sessão USSD - usuário deve retornar com OTP
    };
  }

  private async handleOtpInput(
    sessionId: string,
    msisdn: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    // Se não há input, é primeira vez retornando - mostrar mensagem
    if (!userInput || userInput === '') {
      return {
        response: 'Digite o codigo OTP enviado por SMS:',
        shouldClose: false,
      };
    }

    // Buscar sessão com OTP
    const session = await this.prisma.ussdSession.findUnique({
      where: { sessionId },
    });

    if (!session || !session.otpCode || !session.otpExpiresAt) {
      return {
        response: 'Sessao expirada. Comece novamente.',
        shouldClose: true,
      };
    }

    // Verificar OTP
    const isValid = await this.otpService.verifyOTP(
      session.otpCode,
      userInput,
      session.otpExpiresAt,
    );

    if (!isValid) {
      const attempts = session.otpAttempts + 1;

      if (attempts >= 3) {
        await this.closeSession(sessionId);
        return {
          response: 'Numero maximo de tentativas excedido. Comece novamente.',
          shouldClose: true,
        };
      }

      await this.prisma.ussdSession.update({
        where: { sessionId },
        data: { otpAttempts: attempts },
      });

      return {
        response: `OTP invalido. Tentativas restantes: ${3 - attempts}\n\nTente novamente:`,
        shouldClose: false,
      };
    }

    // OTP válido - Validar cliente com sistema cruzado
    try {
      console.log('[USSD-MENU] Iniciando validação cruzada...');
      
      // Executar validação cruzada Emola ↔ Banco
      const validation = await this.crossValidationService.validateCustomer({
        nuit: state.nuit,
        biNumber: state.bi,
        name: state.institution, // Nome temporário
        phoneNumber: msisdn,
        institution: state.institution,
      });

      console.log('[USSD-MENU] Validação cruzada concluída:', {
        approved: validation.approved,
        matchScore: validation.matchScore,
        creditLimit: validation.creditLimit,
      });

      // Se não aprovado, retornar mensagem
      if (!validation.approved) {
        await this.closeSession(sessionId);
        return {
          response: `Registro nao aprovado:\n${validation.reason}\n\nContate suporte: 84 123 4567`,
          shouldClose: true,
        };
      }

      // Cliente aprovado - criar registro
      const customer = await this.prisma.customer.create({
        data: {
          phoneNumber: msisdn,
          nuit: state.nuit,
          biNumber: state.bi,
          name: validation.details.emolaData?.fullName || state.institution,
          verified: true,
          profession: validation.details.emolaData?.institution || 'Empregado',
          channel: 'MOVITEL',
          creditLimit: validation.creditLimit,
        },
      });

      console.log('[USSD-MENU] Cliente criado:', customer.id);

      // Criar score baseado na validação
      await this.prisma.scoringResult.create({
        data: {
          customer: { connect: { id: customer.id } },
          finalScore: validation.details.emolaData?.creditScore || 650,
          risk: validation.details.emolaData?.riskCategory || 'MEDIUM',
          factors: JSON.stringify({
            matchScore: validation.matchScore,
            creditLimit: validation.creditLimit,
            validation: validation.details,
          }),
          decision: 'APPROVED',
          maxAmount: validation.creditLimit,
        },
      });

      // Limpar OTP e ir para menu principal
      await this.prisma.ussdSession.update({
        where: { sessionId },
        data: {
          currentStep: 'MAIN',
          state: '{}',
          otpCode: null,
          otpExpiresAt: null,
          otpAttempts: 0,
          customerId: customer.id,
        },
      });

      // Enviar SMS de confirmação
      await this.otpService.sendRegistrationConfirmation(msisdn, customer.nuit);

      return {
        response:
          `Registro aprovado!\n\nLimite disponivel: ${validation.creditLimit.toLocaleString()} MZN\n\nAcesse *898# para solicitar emprestimo.`,
        shouldClose: true,
      };
    } catch (error) {
      console.error('[USSD-MENU] Erro ao criar cliente:', error);
      return {
        response: 'Erro ao completar registro. Tente novamente.',
        shouldClose: true,
      };
    }
  }

  // ========== FLUXO DE EMPRÉSTIMO ==========
  private async handleLoanAmount(
    sessionId: string,
    msisdn: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    const amount = parseFloat(userInput);

    if (isNaN(amount)) {
      return {
        response: 'Valor invalido. Digite numeros apenas:',
        shouldClose: false,
      };
    }

    if (amount < 1000) {
      return {
        response: 'Minimo: 1000 MZN.\n\nDigite novo valor:',
        shouldClose: false,
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: msisdn },
    });

    const limit = customer.creditLimit || customer.salary ? customer.salary * 2 : 50000;

    if (amount > limit) {
      return {
        response: `Excede seu limite de ${limit} MZN.\n\nDigite novo valor:`,
        shouldClose: false,
      };
    }

    // Calcular juros (15%)
    const interest = amount * 0.15;
    const total = amount + interest;

    state.loanAmount = amount;
    state.interest = interest;
    state.totalAmount = total;

    await this.updateSession(sessionId, 'LOAN_CONFIRM', state);

    return {
      response: `Valor: ${amount.toFixed(2)} MZN\nTaxa: 15% = ${interest.toFixed(2)} MZN\nTotal: ${total.toFixed(2)} MZN\n\nProsseguir?\n1. Sim\n2. Nao`,
      shouldClose: false,
    };
  }

  private async handleLoanConfirm(
    sessionId: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    if (userInput === '2') {
      await this.updateSession(sessionId, 'MAIN', {});
      return {
        response: 'Cancelado. Retornando ao menu.',
        shouldClose: true,
      };
    }

    if (userInput === '1') {
      await this.updateSession(sessionId, 'LOAN_PURPOSE', state);
      return {
        response:
          'Selecione finalidade:\n\n1. Negocio\n2. Educacao\n3. Saude\n4. Emergencia\n5. Outros',
        shouldClose: false,
      };
    }

    return {
      response: 'Opcao invalida.\n\n1. Sim\n2. Nao',
      shouldClose: false,
    };
  }

  private async handleLoanPurpose(
    sessionId: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    const purposes: Record<string, string> = {
      '1': 'Negocio',
      '2': 'Educacao',
      '3': 'Saude',
      '4': 'Emergencia',
      '5': 'Outros',
    };

    if (!purposes[userInput]) {
      return {
        response: 'Opcao invalida. Escolha 1-5.',
        shouldClose: false,
      };
    }

    state.purpose = purposes[userInput];
    await this.updateSession(sessionId, 'LOAN_BANK', state);

    return {
      response: 'Selecione banco:\n\n1. [Banco 1]\n2. [Banco 2]',
      shouldClose: false,
    };
  }

  private async handleBankSelection(
    sessionId: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    const banks: Record<string, { code: string; name: string }> = {
      '1': { code: 'LETSEGO', name: 'Letsego' },
      '2': { code: 'BAYPORT', name: 'Bayport' },
    };

    if (!banks[userInput]) {
      return {
        response: 'Opcao invalida.\n\n1. [Banco 1]\n2. [Banco 2]',
        shouldClose: false,
      };
    }

    state.bankCode = banks[userInput].code;
    state.bankName = banks[userInput].name;

    await this.updateSession(sessionId, 'LOAN_TERMS', state);

    return {
      response:
        'TERMOS E CONDICOES:\n\n1. A aprovacao do credito e condicionada a analise de risco\n2. A cobranca e feita nos dias 25 ao 5 de cada mes\n\n1. Aceito\n2. Rejeito',
      shouldClose: false,
    };
  }

  private async handleTermsAcceptance(
    sessionId: string,
    msisdn: string,
    userInput: string,
    state: any,
  ): Promise<UssdResponse> {
    if (userInput === '2') {
      await this.updateSession(sessionId, 'MAIN', {});
      return {
        response: 'Pedido cancelado.',
        shouldClose: true,
      };
    }

    if (userInput === '1') {
      try {
        const customer = await this.prisma.customer.findUnique({
          where: { phoneNumber: msisdn },
        });

        // Criar empréstimo
        const loan = await this.loansService.createLoan({
          customerId: customer.id,
          amount: state.loanAmount,
          termMonths: 1,
          purpose: state.purpose,
          totalAmount: state.totalAmount,
          monthlyPayment: state.totalAmount,
        });

        console.log('[USSD-MENU] Emprestimo criado:', loan.id);

        // Calcular scoring
        await this.scoringService.calculateScoring(customer.id, loan.id);

        // Limpar sessão
        await this.updateSession(sessionId, 'MAIN', {});

        // Enviar SMS de confirmação
        await this.otpService.sendLoanConfirmation(
          msisdn,
          loan.id,
          state.loanAmount,
        );

        return {
          response: `Pedido #${loan.id.substring(0, 8)} enviado!\n\nAguarde SMS com resultado em ate 24h.`,
          shouldClose: true,
        };
      } catch (error) {
        console.error('[USSD-MENU] Erro ao criar emprestimo:', error);
        return {
          response: 'Erro ao processar pedido. Tente novamente.',
          shouldClose: true,
        };
      }
    }

    return {
      response: 'Opcao invalida.\n\n1. Aceito\n2. Rejeito',
      shouldClose: false,
    };
  }

  // ========== CONSULTAS ==========
  private async showMyLoans(msisdn: string): Promise<UssdResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: msisdn },
      include: { loans: { take: 3, orderBy: { createdAt: 'desc' } } },
    });

    if (!customer?.loans?.length) {
      return {
        response: 'Voce ainda nao tem emprestimos.',
        shouldClose: true,
      };
    }

    const loansList = customer.loans
      .map((loan, i) => `${i + 1}. ${loan.amount} MZN - ${loan.status}`)
      .join('\n');

    return {
      response: `MEUS EMPRESTIMOS:\n\n${loansList}`,
      shouldClose: true,
    };
  }

  private async showProfile(msisdn: string): Promise<UssdResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: msisdn },
    });

    const limit = customer.salary ? customer.salary * 2 : 0;

    return {
      response: `MEU PERFIL:\n\nTelefone: ${customer.phoneNumber}\nNUIT: ${customer.nuit || 'N/A'}\nLimite: ${limit} MZN\nStatus: ${customer.verified ? 'Verificado' : 'Pendente'}`,
      shouldClose: true,
    };
  }

  // ========== HELPERS ==========
  private async updateSession(
    sessionId: string,
    step: string,
    state: any,
  ): Promise<void> {
    await this.prisma.ussdSession.updateMany({
      where: { sessionId },
      data: {
        currentStep: step,
        state: JSON.stringify(state),
        lastActivity: new Date(),
      },
    });
  }

  private async updateSessionWithOtp(
    sessionId: string,
    step: string,
    state: any,
    otp: { code: string; expiresAt: Date },
  ): Promise<void> {
    await this.prisma.ussdSession.updateMany({
      where: { sessionId },
      data: {
        currentStep: step,
        state: JSON.stringify(state),
        otpCode: otp.code,
        otpExpiresAt: otp.expiresAt,
        otpAttempts: 0,
        lastActivity: new Date(),
      },
    });
  }

  private async closeSession(sessionId: string): Promise<void> {
    await this.prisma.ussdSession.updateMany({
      where: { sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });
  }
}
