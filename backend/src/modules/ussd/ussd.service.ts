import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { LoansService } from '../loans/loans.service';
import { InterestRateService } from '../loans/interest-rate.service';
import { SmsService } from '../sms/sms.service';
import { CrossValidationService } from '../cross-validation/cross-validation.service';
import { BankAdaptersService } from '../bank-adapters/bank-adapters-v2.service';

interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
}

export interface UssdResponse {
  message: string;
  continueSession: boolean;
}

@Injectable()
export class UssdService {
  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
    private loansService: LoansService,
    private interestRateService: InterestRateService,
    private smsService: SmsService,
    private crossValidationService: CrossValidationService,
    private bankAdaptersService: BankAdaptersService,
  ) {}

  async handleUssdRequest(request: UssdRequest): Promise<UssdResponse> {
    try {
      const { sessionId, phoneNumber, text } = request;

      // Buscar ou criar sessão
      let session = await this.getOrCreateSession(sessionId, phoneNumber);

      // Se texto vazio, é o início - verificar se cliente está registrado
      if (!text || text === '') {
        const customer = await this.prisma.customer.findUnique({
          where: { phoneNumber },
        });

        // Se não está verificado, redirecionar para registro
        if (!customer || !customer.verified) {
          return {
            message: `BEM-VINDO AO PAYJA

⚠️ Registro necessário!

Para solicitar empréstimos, você precisa completar seu registro primeiro.

Disque *899# para se registrar.

Leva apenas 2 minutos!`,
            continueSession: false,
          };
        }

        return this.showMainMenu();
      }

      // Processar entrada baseado no step atual
      const inputs = text.split('*');
      const lastInput = inputs[inputs.length - 1];

      return await this.processStep(session, lastInput, phoneNumber);
    } catch (error) {
      console.error('Erro em handleUssdRequest:', error);
      return {
        message: 'Erro ao processar solicitação. Tente novamente.',
        continueSession: false,
      };
    }
  }

  private async getOrCreateSession(sessionId: string, phoneNumber: string) {
    let session = await this.prisma.ussdSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      // Criar ou buscar cliente
      let customer = await this.prisma.customer.findUnique({
        where: { phoneNumber },
      });

      if (!customer) {
        customer = await this.prisma.customer.create({
          data: { phoneNumber },
        });
      }

      session = await this.prisma.ussdSession.create({
        data: {
          sessionId,
          phoneNumber,
          currentStep: 'MENU_PRINCIPAL',
          state: '{}',
        },
      });
    }

    return session;
  }

  private async getActiveBanks(): Promise<{ code: string; name: string }[]> {
    // Consultar bancos parceiros ativos; se não houver, criar o mock padrão
    let banks = await this.prisma.bankPartner.findMany({
      where: { active: true },
      select: { code: true, name: true, apiUrl: true },
    });

    if (!banks.length) {
      const apiUrl = process.env.BANK_MOCK_URL || 'http://localhost:4000';

      await this.prisma.bankPartner.upsert({
        where: { code: 'GHW' },
        update: {
          name: 'Banco Mock',
          apiUrl,
          active: true,
          verified: true,
        },
        create: {
          code: 'GHW',
          name: 'Banco Mock',
          apiUrl,
          active: true,
          verified: true,
        },
      });

      banks = await this.prisma.bankPartner.findMany({
        where: { active: true },
        select: { code: true, name: true, apiUrl: true },
      });
    }

    // Recarregar adaptadores para refletir bancos atuais
    await this.bankAdaptersService.initializeAdapters();

    return banks;
  }

  private showMainMenu(): UssdResponse {
    return {
      message: `BEM-VINDO AO PAYJA
      
1. Solicitar Empréstimo
2. Meus Empréstimos
3. Meu Perfil
4. Ajuda`,
      continueSession: true,
    };
  }

  private async processStep(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    const step = session.currentStep;
    const state = session.state ? JSON.parse(session.state) : {};
    
    console.log(`[USSD] Step: ${step}, Input: ${input}, Phone: ${phoneNumber}`);

    switch (step) {
      case 'MENU_PRINCIPAL':
        return this.handleMainMenu(session, input);
      
      case 'SOLICITAR_VALOR':
        return this.handleLoanAmount(session, input);
      
      case 'SOLICITAR_PRAZO':
        return this.handleLoanTerm(session, input);
      
      case 'SOLICITAR_MOTIVO':
        return this.handleLoanPurpose(session, input);
      
      case 'ESCOLHER_BANCO':
        return this.handleBankSelection(session, input);
      
      case 'TERMOS':
        return this.handleTermsAcceptance(session, input);
      
      case 'CONFIRMAR':
        return this.handleConfirmation(session, input, phoneNumber);
      
      // Fluxo de REGISTRO
      case 'REGISTRO_INICIAL':
        return this.handleRegistroInicial(session, input);
      
      case 'REGISTRO_NUIT':
        return this.handleRegistroNuit(session, input, phoneNumber);
      
      case 'REGISTRO_NOME':
        return this.handleRegistroNome(session, input, phoneNumber);
      
      case 'REGISTRO_BI':
        return this.handleRegistroBi(session, input, phoneNumber);
      
      case 'REGISTRO_VALIDAR':
        return this.handleRegistroValidar(session, input, phoneNumber);
      
      default:
        console.error(`[USSD] Step desconhecido: ${step}`);
        await this.endSession(session.id);
        return this.showMainMenu();
    }
  }

  private async handleMainMenu(session: any, input: string): Promise<UssdResponse> {
    // Verificar novamente se está verificado antes de permitir empréstimo
    if (input === '1') {
      const customer = await this.prisma.customer.findUnique({
        where: { phoneNumber: session.phoneNumber },
      });

      if (!customer || !customer.verified) {
        return {
          message: `⚠️ Registro incompleto!

Para solicitar empréstimos, complete seu registro em *899#

Isso garante:
✓ Aprovação mais rápida
✓ Melhores taxas
✓ Limites maiores`,
          continueSession: false,
        };
      }

      const creditLimit = customer.creditLimit ?? 0;

      if (creditLimit <= 0) {
        return {
          message: `⚠️ Limite indisponível.

Complete ou refaça seu registro em *899# para receber um limite aprovado.`,
          continueSession: false,
        };
      }

      await this.updateSession(session.id, 'SOLICITAR_VALOR', { creditLimit });
      return {
        message: `Seu limite aprovado: ${creditLimit} MZN

Digite o valor que deseja (mínimo 500 MZN):`,
        continueSession: true,
      };
    }

    switch (input) {
      case '2':
        return this.showMyLoans(session.phoneNumber);
      
      case '3':
        return this.showProfile(session.phoneNumber);
      
      case '4':
        return this.showHelp();
      
      default:
        return {
          message: 'Opção inválida. Tente novamente.',
          continueSession: false,
        };
    }
  }

  private async handleLoanAmount(session: any, input: string): Promise<UssdResponse> {
    const amount = parseFloat(input);

    if (isNaN(amount) || amount < 500) {
      return {
        message: 'Valor inválido. Digite um valor maior que 500 MZN.',
        continueSession: true,
      };
    }

    const currentState = session.state ? JSON.parse(session.state) : {};

    // Buscar cliente para validar contra creditLimit
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: session.phoneNumber },
    });

    const limit = currentState.creditLimit ?? customer?.creditLimit ?? 0;

    if (!limit || limit < 500) {
      return {
        message: 'Limite não disponível no momento. Complete seu registro ou tente novamente mais tarde.',
        continueSession: false,
      };
    }

    if (amount > limit) {
      return {
        message: `Valor excede seu limite de ${limit} MZN.\n\nDigite um novo valor (máx ${limit} MZN):`,
        continueSession: true,
      };
    }

    const state = { ...currentState, amount, creditLimit: limit };
    await this.updateSession(session.id, 'SOLICITAR_PRAZO', state);

    // Usar menu dinâmico com taxas
    const menu = this.interestRateService.getUssdTermMenu();

    return {
      message: `Valor: ${amount} MZN\n\n${menu}`,
      continueSession: true,
    };
  }

  private async handleLoanTerm(session: any, input: string): Promise<UssdResponse> {
    const option = parseInt(input);
    const termConfig = this.interestRateService.getConfigByMenuOption(option);

    if (!termConfig) {
      return {
        message: 'Opção inválida. Escolha de 1 a 6.',
        continueSession: true,
      };
    }

    // Armazenar prazo e taxa
    const state = JSON.parse(session.state);
    const newState = {
      ...state,
      termDays: termConfig.days,
      termMonths: termConfig.months,
      interestRate: termConfig.rate,
      termLabel: termConfig.label,
    };

    await this.updateSession(session.id, 'SOLICITAR_MOTIVO', newState);

    return {
      message: `Para que você precisa do empréstimo?\n\n1. Negócio\n2. Educação\n3. Saúde\n4. Emergência\n5. Outro`,
      continueSession: true,
    };
  }

  private async handleLoanPurpose(session: any, input: string): Promise<UssdResponse> {
    const purposeMap = {
      '1': 'Negócio',
      '2': 'Educação',
      '3': 'Saúde',
      '4': 'Emergência',
      '5': 'Outro',
    };

    const purpose = purposeMap[input];
    if (!purpose) {
      return {
        message: 'Opção inválida. Escolha de 1 a 5.',
        continueSession: true,
      };
    }

    const state = JSON.parse(session.state);

    // Buscar bancos ativos (ou criar mock padrão)
    const banks = await this.getActiveBanks();

    if (!banks.length) {
      return {
        message: 'Nenhum banco disponível no momento. Tente novamente mais tarde.',
        continueSession: false,
      };
    }

    const bankMenu = banks
      .map((b, idx) => `${idx + 1}. ${b.name}`)
      .join('\n');

    await this.updateSession(session.id, 'ESCOLHER_BANCO', { ...state, purpose, banks });

    return {
      message: `Escolha o banco para desembolso:

${bankMenu}`,
      continueSession: true,
    };
  }

  private async handleBankSelection(session: any, input: string): Promise<UssdResponse> {
    const state = JSON.parse(session.state);
    const banks = state.banks || [];

    const index = parseInt(input, 10) - 1;
    const bank = banks[index];

    if (!bank) {
      return {
        message: 'Opção inválida. Escolha um número do menu.',
        continueSession: true,
      };
    }
    const { amount, termDays, termMonths, interestRate, termLabel, purpose } = state;

    // Buscar configuração completa
    const config = termDays 
      ? this.interestRateService.getConfigByDays(termDays)
      : this.interestRateService.getConfigByMonths(termMonths);

    if (!config) {
      return {
        message: 'Erro ao processar prazo selecionado.',
        continueSession: false,
      };
    }

    // Calcular valores com base no tipo de pagamento
    const calculation = this.interestRateService.calculateInstallmentAmount(
      amount,
      config,
    );

    const totalAmount = calculation.totalAmount;
    const installmentAmount = calculation.installmentAmount;
    const numberOfInstallments = calculation.numberOfInstallments;

    // Preparar informação de pagamento
    let paymentInfo: string;
    if (config.installmentType === 'SINGLE') {
      paymentInfo = `Pagamento único: ${totalAmount.toFixed(2)} MZN`;
    } else {
      paymentInfo = `${numberOfInstallments} parcelas de ${installmentAmount.toFixed(2)} MZN`;
    }

    // Adicionar informação de desconto para liquidação antecipada
    let discountInfo = '';
    if (config.earlyPaymentDiscount) {
      discountInfo = `\n\n💡 Liquidação antecipada: ${config.earlyPaymentDiscount}% desconto`;
    }

    await this.updateSession(session.id, 'TERMOS', { 
      ...state, 
      bankCode: bank.code,
      bankName: bank.name,
      totalAmount, 
      installmentAmount,
      numberOfInstallments,
      monthlyPayment: installmentAmount, // Para compatibilidade
      interestRate,
      hasEarlyPaymentDiscount: !!config.earlyPaymentDiscount,
    });

    return {
      message: `RESUMO DO EMPRÉSTIMO:
      
Valor: ${amount} MZN
Prazo: ${termLabel}
Taxa: ${interestRate}%
Banco: ${bank.name}
Total a pagar: ${totalAmount.toFixed(2)} MZN
${paymentInfo}${discountInfo}

Próximo: Termos e Condições

1. Continuar
2. Cancelar`,
      continueSession: true,
    };
  }

  private async handleTermsAcceptance(session: any, input: string): Promise<UssdResponse> {
    if (input === '2') {
      await this.endSession(session.id);
      return {
        message: 'Solicitação cancelada.',
        continueSession: false,
      };
    }

    if (input !== '1') {
      return {
        message: 'Opção inválida. Escolha 1 ou 2.',
        continueSession: true,
      };
    }

    const state = JSON.parse(session.state);
    
    // Buscar dados do cliente para mostrar nos termos
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: session.phoneNumber },
    });

    await this.updateSession(session.id, 'CONFIRMAR', state);

    return {
      message: `TERMOS E CONDIÇÕES - PayJA

Nome: ${customer.name || 'N/A'}
NUIT: ${customer.nuit || 'N/A'}

Ao confirmar, você concorda com:

✓ Taxas de juros conforme prazo
✓ Comissões: E-Mola (3%), PayJA (3%), Banco (8%)
✓ Multa de 1%/dia por atraso (máx 10%)
✓ Análise de crédito obrigatória

Desconto de 2% para liquidação antecipada (6+ meses)

1. Aceito os termos
2. Não aceito`,
      continueSession: true,
    };
  }

  private async handleConfirmation(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    if (input !== '1') {
      await this.endSession(session.id);
      return {
        message: 'Termos não aceitos. Solicitação cancelada.',
        continueSession: false,
      };
    }

    try {
      console.log('[USSD] Iniciando confirmacao para', phoneNumber);
      
      const state = JSON.parse(session.state);
      console.log('[USSD] State:', state);
      
      const { 
        amount, 
        termMonths, 
        termDays,
        purpose, 
        totalAmount, 
        monthlyPayment, 
        bankCode, 
        bankName,
        interestRate,
        termLabel,
        numberOfInstallments,
      } = state;

      // Buscar cliente
      const customer = await this.prisma.customer.findUnique({
        where: { phoneNumber },
      });

      if (!customer) {
        console.error('[USSD] Cliente nao encontrado:', phoneNumber);
        return {
          message: 'Erro: Cliente não encontrado. Complete seu registro em *899#',
          continueSession: false,
        };
      }

      console.log('[USSD] Cliente encontrado:', customer.id);

      // Registrar aceite dos termos
      try {
        await this.loansService.acceptTerms(customer.id, '1.0');
        console.log('[USSD] Termos aceitos');
      } catch (error) {
        console.error('[USSD] Erro ao aceitar termos:', error);
      }

      // Criar empréstimo
      console.log('[USSD] Criando emprestimo...');
      const loan = await this.loansService.createLoan({
        customerId: customer.id,
        amount,
        termMonths: termMonths || 1,
        termDays: termDays,
        purpose,
        totalAmount,
        monthlyPayment,
        bankCode,
        bankName,
        interestRate: interestRate || 15,
      });
      console.log('[USSD] Emprestimo criado:', loan.id);

      // Calcular scoring
      console.log('[USSD] Calculando scoring...');
      const scoring = await this.scoringService.calculateScoring(customer.id, loan.id, bankCode);
      console.log('[USSD] Scoring calculado:', scoring.id);

      let disbursementSuccess = false;
      let disbursementMessage = '';

      if (scoring.decision === 'APPROVED' && bankCode) {
        console.log('[USSD] Solicitando desembolso ao banco', bankCode);
        try {
          const disbursement = await this.bankAdaptersService.requestDisbursement({
            customerId: customer.id,
            loanId: loan.id,
            amount,
            bankCode,
          });

          if (disbursement.success) {
            disbursementSuccess = true;
            await this.loansService.updateLoanStatus(loan.id, 'DISBURSED');

            const creditAmount = disbursement.disbursedAmount || amount;
            const reference = disbursement.transactionId || loan.id.substring(0, 8);

            await this.smsService.notifyDisbursement(phoneNumber, creditAmount, reference);

            const payjaPhone = process.env.PAYJA_NOTIFICATION_PHONE;
            if (payjaPhone) {
              await this.smsService.sendSms(
                payjaPhone,
                `PayJA ALERTA: Desembolso de ${creditAmount} MZN via ${bankName} para ${phoneNumber}. Ref ${reference}`,
                'NOTIFICATION',
              );
            }

            disbursementMessage = 'Desembolso solicitado ao banco. O valor será enviado para sua carteira móvel.';
          } else {
            disbursementMessage = disbursement.error || 'Banco ainda não confirmou o desembolso.';
          }
        } catch (error) {
          console.error('[USSD] Erro no desembolso:', error);
          disbursementMessage = error.message || 'Erro ao solicitar desembolso ao banco.';
        }
      }

      // Enviar SMS de confirmação com nome e NUIT
      try {
        const installmentInfo = numberOfInstallments > 1 
          ? `${numberOfInstallments} parcelas de ${monthlyPayment.toFixed(2)} MZN`
          : `Pagamento unico: ${totalAmount.toFixed(2)} MZN`;

        const smsMessage = `PayJA - Solicitacao recebida!

Nome: ${customer.name || 'N/A'}
NUIT: ${customer.nuit || 'N/A'}

Valor: ${amount} MZN
Prazo: ${termLabel}
${installmentInfo}
Ref: ${loan.id.substring(0, 8)}

Analise em andamento. Resposta em breve!`;

        await this.smsService.sendSms(phoneNumber, smsMessage, 'LOAN_STATUS');
        console.log('[USSD] SMS de confirmacao enviado para', phoneNumber);
      } catch (error) {
        console.error('[USSD] Erro ao enviar SMS:', error);
      }

      // Mensagem de sucesso
      const installmentInfo = numberOfInstallments > 1 
        ? `\n${numberOfInstallments} parcelas de ${monthlyPayment.toFixed(2)} MZN`
        : `\nPagamento único: ${totalAmount.toFixed(2)} MZN`;

      await this.endSession(session.id);

      console.log('[USSD] Confirmacao concluida com sucesso!');

      const disbursementInfo = scoring.decision === 'APPROVED' && bankCode
        ? disbursementSuccess
          ? '\nDesembolso: enviado para sua carteira móvel.'
          : disbursementMessage
            ? `\nStatus banco: ${disbursementMessage}`
            : '\nStatus banco: aguardando confirmação de desembolso.'
        : '\nStatus banco: aguardando aprovação de crédito.';

      return {
        message: `✓ Solicitação enviada com sucesso!
        
Nome: ${customer.name}
NUIT: ${customer.nuit}
Referência: ${loan.id.substring(0, 8)}
Prazo: ${termLabel}
Taxa: ${interestRate}%${installmentInfo}

${disbursementInfo}

Aguarde análise de crédito.
Você receberá SMS com o resultado.

Obrigado por usar PayJA!`,
        continueSession: false,
      };
    } catch (error) {
      console.error('[USSD] ERRO DETALHADO:', error);
      console.error('[USSD] Stack:', error.stack);
      await this.endSession(session.id);
      return {
        message: 'Erro ao processar solicitação: ' + error.message + '\n\nTente novamente ou contate o suporte.',
        continueSession: false,
      };
    }
  }

  private async showMyLoans(phoneNumber: string): Promise<UssdResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: { loans: { take: 3, orderBy: { createdAt: 'desc' } } },
    });

    if (!customer?.loans?.length) {
      return {
        message: 'Você ainda não tem empréstimos.',
        continueSession: false,
      };
    }

    const loansList = customer.loans
      .map((loan, i) => `${i + 1}. ${loan.amount} MZN - ${loan.status}`)
      .join('\n');

    return {
      message: `MEUS EMPRÉSTIMOS:\n\n${loansList}`,
      continueSession: false,
    };
  }

  private async showProfile(phoneNumber: string): Promise<UssdResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });

    return {
      message: `MEU PERFIL:
      
Telefone: ${customer.phoneNumber}
Nome: ${customer.name || 'Não informado'}
Status: ${customer.verified ? 'Verificado' : 'Não verificado'}`,
      continueSession: false,
    };
  }

  private showHelp(): UssdResponse {
    return {
      message: `AJUDA PAYJA:
      
Central de atendimento: 800-PAYJA
WhatsApp: +258 84 123 4567
Email: ajuda@payja.co.mz

Horário: Seg-Sex 8h-18h`,
      continueSession: false,
    };
  }

  private async updateSession(sessionId: string, step: string, state: any) {
    return this.prisma.ussdSession.update({
      where: { id: sessionId },
      data: {
        currentStep: step,
        state: JSON.stringify(state),
        lastActivity: new Date(),
      },
    });
  }

  private async endSession(sessionId: string) {
    return this.prisma.ussdSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });
  }

  // ============================================
  // FLUXO DE REGISTRO COM VALIDAÇÃO CRUZADA
  // ============================================

  private async handleRegistroInicial(session: any, input: string): Promise<UssdResponse> {
    await this.updateSession(session.id, 'REGISTRO_NUIT', {});
    
    return {
      message: `BEM-VINDO AO REGISTRO PAYJA!

Você será solicitado a informar seus dados. Leva apenas 2 minutos.

Digite seu NUIT (14 dígitos):`,
      continueSession: true,
    };
  }

  private async handleRegistroNuit(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    // Validar NUIT (14 dígitos)
    if (!input || input.length !== 14 || isNaN(Number(input))) {
      return {
        message: 'NUIT inválido. Digite exatamente 14 dígitos.',
        continueSession: true,
      };
    }

    const state = { nuit: input };
    await this.updateSession(session.id, 'REGISTRO_NOME', state);

    return {
      message: 'Digite seu nome completo (como está no documento):',
      continueSession: true,
    };
  }

  private async handleRegistroNome(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    if (!input || input.length < 3) {
      return {
        message: 'Nome inválido. Digite seu nome completo.',
        continueSession: true,
      };
    }

    const state = JSON.parse(session.state);
    state.name = input;
    await this.updateSession(session.id, 'REGISTRO_BI', state);

    return {
      message: 'Digite seu número de BI (sem espaços ou caracteres especiais):',
      continueSession: true,
    };
  }

  private async handleRegistroBi(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    if (!input || input.length < 7) {
      return {
        message: 'BI inválido. Tente novamente.',
        continueSession: true,
      };
    }

    const state = JSON.parse(session.state);
    state.biNumber = input;
    await this.updateSession(session.id, 'REGISTRO_VALIDAR', state);

    // Mostrar resumo dos dados e iniciar validação
    return {
      message: `DADOS INFORMADOS:

NUIT: ${state.nuit}
Nome: ${state.name}
BI: ${state.biNumber}
Telefone: ${phoneNumber}

Validando dados no banco...

1. Confirmar e validar
2. Cancelar`,
      continueSession: true,
    };
  }

  private async handleRegistroValidar(session: any, input: string, phoneNumber: string): Promise<UssdResponse> {
    if (input === '2') {
      await this.endSession(session.id);
      return {
        message: 'Registro cancelado. Tente novamente depois.',
        continueSession: false,
      };
    }

    if (input !== '1') {
      return {
        message: 'Opção inválida. Escolha 1 ou 2.',
        continueSession: true,
      };
    }

    try {
      const state = JSON.parse(session.state);
      const { nuit, name, biNumber } = state;

      console.log('[USSD-REGISTRO] Iniciando validação cruzada para', nuit);

      // 1. Fazer validação cruzada com banco parceiro
      const validationResult = await this.crossValidationService.validateCustomer({
        nuit,
        name,
        biNumber,
        phoneNumber,
      });

      console.log('[USSD-REGISTRO] Resultado validação:', validationResult);

      if (validationResult.approved) {
        // 2. Se aprovado, atualizar cliente no PayJA
        const customer = await this.prisma.customer.update({
          where: { phoneNumber },
          data: {
            nuit,
            name,
            biNumber,
            verified: true, // Marcar como verificado
            creditLimit: validationResult.creditLimit,
          },
        });

        // 3. Enviar SMS de aprovação
        try {
          const smsMessage = `PayJA - Registro aprovado!

Bem-vindo ${name}!

NUIT: ${nuit}
Limite de crédito: ${validationResult.creditLimit} MZN
Score de correspondência: ${validationResult.matchScore}%

Você já pode solicitar empréstimos!
Disque *899# para continuar.

Obrigado!`;

          await this.smsService.sendSms(phoneNumber, smsMessage, 'NOTIFICATION');
          console.log('[USSD-REGISTRO] SMS de aprovação enviado');
        } catch (smsError) {
          console.error('[USSD-REGISTRO] Erro ao enviar SMS:', smsError);
        }

        await this.endSession(session.id);

        return {
          message: `✓ REGISTRO APROVADO!

Nome: ${name}
NUIT: ${nuit}
Limite: ${validationResult.creditLimit} MZN
Score: ${validationResult.matchScore}%

Você já pode solicitar empréstimos!

Disque *899# para acessar a plataforma.

Obrigado por usar PayJA!`,
          continueSession: false,
        };
      } else {
        // 4. Se não aprovado, mostrar motivo
        try {
          const smsMessage = `PayJA - Registro não aprovado

Desculpe ${name}, seu registro não foi aprovado.

Motivo: ${validationResult.reason}

Contate suporte: 84 123 4567

Equipe PayJA`;

          await this.smsService.sendSms(phoneNumber, smsMessage, 'NOTIFICATION');
        } catch (smsError) {
          console.error('[USSD-REGISTRO] Erro ao enviar SMS de rejeição:', smsError);
        }

        await this.endSession(session.id);

        return {
          message: `❌ REGISTRO NÃO APROVADO

${validationResult.reason}

Score de correspondência: ${validationResult.matchScore}%

Contate suporte: 84 123 4567

Equipe PayJA`,
          continueSession: false,
        };
      }
    } catch (error) {
      console.error('[USSD-REGISTRO] ERRO:', error);
      await this.endSession(session.id);
      return {
        message: `Erro ao processar registro: ${error.message}

Contate suporte: 84 123 4567`,
        continueSession: false,
      };
    }
  }
}
