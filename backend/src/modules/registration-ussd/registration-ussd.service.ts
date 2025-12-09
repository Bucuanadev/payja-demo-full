import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SmsService } from '../sms/sms.service';
import { BankAdaptersService } from '../bank-adapters/bank-adapters-v2.service';

interface UssdResponse {
  message: string;
  continueSession: boolean;
}

@Injectable()
export class RegistrationUssdService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private bankAdaptersService: BankAdaptersService,
  ) {}

  async handleRegistrationUssd(
    sessionId: string,
    phoneNumber: string,
    text: string,
  ): Promise<UssdResponse> {
    try {
      console.log('[REG] Phone:', phoneNumber, '| Text:', text);

      // Verificar se já registrado
      const customer = await this.prisma.customer.findUnique({
        where: { phoneNumber },
      });

      if (customer?.verified) {
        return {
          message: 'Ola ' + customer.name + '!\n\nVoce ja esta registrado.\nAcesse *898# para emprestimos.',
          continueSession: false,
        };
      }

      // Buscar/criar sessão
      let session = await this.prisma.ussdSession.findFirst({
        where: { sessionId },
      });

      if (!session) {
        session = await this.prisma.ussdSession.create({
          data: {
            sessionId,
            phoneNumber,
            currentStep: 'START',
            state: JSON.stringify({}),
          },
        });
      }

      const inputs = text ? text.split('*') : [];
      const step = session.currentStep;
      const data = session.state ? JSON.parse(session.state) : {};

      console.log('[REG] Step:', step, '| Inputs:', inputs.length);

      // INÍCIO
      if (inputs.length === 0) {
        await this.updateSession(sessionId, 'WELCOME', {});
        return {
          message: 'BEM-VINDO AO REGISTRO PayJA\n\n1. Iniciar registro\n2. Cancelar\n3. Concluir registro (com codigo SMS)',
          continueSession: true,
        };
      }

      const lastInput = inputs[inputs.length - 1];

      // WELCOME
      if (step === 'WELCOME' || step === 'START') {
        if (lastInput === '2') {
          return { message: 'Registro cancelado.', continueSession: false };
        }
        if (lastInput === '3') {
          // Opção 3: Concluir registro com código SMS
          await this.updateSession(sessionId, 'VERIFICATION', {});
          return { message: 'Digite o codigo SMS de 6 digitos:', continueSession: true };
        }
        if (lastInput !== '1') {
          return { message: 'Opcao invalida.\n\n1. Iniciar\n2. Cancelar\n3. Concluir registro', continueSession: true };
        }
        await this.updateSession(sessionId, 'NUIT', {});
        return { message: 'Digite seu NUIT (9 digitos):', continueSession: true };
      }

      // NUIT
      if (step === 'NUIT') {
        if (!/^\d{9}$/.test(lastInput)) {
          return { message: 'NUIT invalido. Deve ter 9 digitos.\n\nDigite novamente:', continueSession: true };
        }
        data.nuit = lastInput;
        await this.updateSession(sessionId, 'NAME', data);
        return { message: 'Digite seu nome completo:', continueSession: true };
      }

      // NAME
      if (step === 'NAME') {
        if (lastInput.length < 3) {
          return { message: 'Nome muito curto.\n\nDigite seu nome completo:', continueSession: true };
        }
        data.name = lastInput;
        await this.updateSession(sessionId, 'BI', data);
        return { message: 'Digite o numero do seu BI:', continueSession: true };
      }

      // BI
      if (step === 'BI') {
        if (lastInput.length < 9) {
          return { message: 'BI invalido.\n\nDigite novamente:', continueSession: true };
        }
        data.biNumber = lastInput;
        await this.updateSession(sessionId, 'BI_ISSUE', data);
        return { message: 'Data de emissao do BI (DD/MM/AAAA):\n\nEx: 15/03/2020', continueSession: true };
      }

      // BI_ISSUE
      if (step === 'BI_ISSUE') {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(lastInput)) {
          return { message: 'Data invalida. Use DD/MM/AAAA\n\nEx: 15/03/2020', continueSession: true };
        }
        data.biIssueDate = lastInput;
        await this.updateSession(sessionId, 'BI_EXPIRY', data);
        return { message: 'Data de expiracao do BI (DD/MM/AAAA):\n\nEx: 15/03/2030', continueSession: true };
      }

      // BI_EXPIRY
      if (step === 'BI_EXPIRY') {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(lastInput)) {
          return { message: 'Data invalida. Use DD/MM/AAAA\n\nEx: 15/03/2030', continueSession: true };
        }
        data.biExpiryDate = lastInput;
        await this.updateSession(sessionId, 'PROFESSION', data);
        return {
          message: 'Profissao:\n\n1. Funcionario Publico\n2. Funcionario Privado\n3. Empresario\n4. Trabalhador Independente\n5. Estudante\n6. Outro',
          continueSession: true,
        };
      }

      // PROFESSION
      if (step === 'PROFESSION') {
        const professions: Record<string, string> = {
          '1': 'Funcionario Publico',
          '2': 'Funcionario Privado',
          '3': 'Empresario',
          '4': 'Trabalhador Independente',
          '5': 'Estudante',
          '6': 'Outro',
        };
        if (!professions[lastInput]) {
          return { message: 'Opcao invalida. Escolha 1-6.', continueSession: true };
        }
        data.profession = professions[lastInput];
        await this.updateSession(sessionId, 'SALARY', data);
        return {
          message: 'Digite seu salario mensal (MZN):\n\nEx: 15000',
          continueSession: true,
        };
      }

      // SALARY
      if (step === 'SALARY') {
        const salary = parseFloat(lastInput);
        if (isNaN(salary) || salary < 1000) {
          return { message: 'Salario invalido. Digite um valor maior que 1000 MZN:', continueSession: true };
        }
        data.salary = salary;
        await this.updateSession(sessionId, 'BANK', data);
        return {
          message: 'Banco onde recebe salario:\n\n1. BCI\n2. Standard Bank\n3. Millennium BIM\n4. Absa\n5. Banco Terra\n6. Outro',
          continueSession: true,
        };
      }

      // BANK
      if (step === 'BANK') {
        const banks: Record<string, string> = {
          '1': 'BCI',
          '2': 'Standard Bank',
          '3': 'Millennium BIM',
          '4': 'Absa',
          '5': 'Banco Terra',
          '6': 'Outro',
        };
        if (!banks[lastInput]) {
          return { message: 'Opcao invalida. Escolha 1-6.', continueSession: true };
        }
        data.salaryBank = banks[lastInput];
        data.verificationCodeSent = true;

        // Enviar SMS
        try {
          await this.smsService.sendVerificationCode(phoneNumber);
          console.log('[REG] SMS enviado para', phoneNumber);
        } catch (error) {
          console.error('[REG] Erro ao enviar SMS:', error);
        }

        await this.updateSession(sessionId, 'VERIFICATION', data);
        return {
          message: 'Codigo SMS enviado para ' + phoneNumber + '\n\nDigite o codigo de 6 digitos:',
          continueSession: true,
        };
      }

      // VERIFICATION
      if (step === 'VERIFICATION') {
        if (!/^\d{6}$/.test(lastInput)) {
          return { message: 'Codigo invalido. Deve ter 6 digitos.\n\nDigite novamente:', continueSession: true };
        }

        // Verificar código
        const isValid = await this.smsService.verifyCode(phoneNumber, lastInput);
        if (!isValid) {
          return { message: 'Codigo incorreto ou expirado.\n\nDigite novamente:', continueSession: true };
        }

        // Buscar dados da última sessão de registro completo
        let registrationData = data;
        if (!data.name || !data.nuit) {
          console.log('[REG] Buscando dados de sessao anterior...');
          const lastSession = await this.prisma.ussdSession.findFirst({
            where: { 
              phoneNumber,
              state: { not: '{}' },
            },
            orderBy: { lastActivity: 'desc' },
          });
          
          if (lastSession && lastSession.state) {
            const parsed = JSON.parse(lastSession.state);
            if (parsed.name && parsed.nuit) {
              registrationData = parsed;
              console.log('[REG] Dados recuperados:', registrationData);
            }
          }
        }

        if (!registrationData.name || !registrationData.nuit) {
          return { 
            message: 'Erro: Nao encontrei seus dados de registro.\n\nPor favor, inicie um novo registro com opcao 1.',
            continueSession: false 
          };
        }

        await this.updateSession(sessionId, 'CONFIRM', registrationData);
        const msg = 'CONFIRME SEUS DADOS:\n\n' +
          'Nome: ' + registrationData.name + '\n' +
          'NUIT: ' + registrationData.nuit + '\n' +
          'BI: ' + registrationData.biNumber + '\n' +
          'Profissao: ' + registrationData.profession + '\n' +
          'Salario: ' + (registrationData.salary || 'N/A') + ' MZN\n' +
          'Banco: ' + registrationData.salaryBank + '\n\n' +
          '1. Confirmar\n2. Cancelar';
        return { message: msg, continueSession: true };
      }

      // CONFIRM
      if (step === 'CONFIRM') {
        if (lastInput !== '1') {
          return { message: 'Registro cancelado.', continueSession: false };
        }

        try {
          console.log('[REG-BANCO] Iniciando validação com banco para', data.nuit);

          // 1. Buscar dados do cliente no banco (via bank-partners)
          const banks = await this.prisma.bankPartner.findMany({
            where: { active: true },
          });

          if (!banks.length) {
            console.error('[REG-BANCO] Nenhum banco parceiro ativo');
            return {
              message: 'Erro: Nenhum banco disponível no momento.\n\nTente novamente mais tarde.',
              continueSession: false,
            };
          }

          let bankValidationResult = null;
          let successBank = null;

          // 2. Tentar validar em cada banco até encontrar o cliente
          for (const bank of banks) {
            try {
              console.log('[REG-BANCO] Consultando', bank.name, 'para', data.nuit);

              const eligibility = await this.bankAdaptersService.checkEligibility(
                bank.code,
                {
                  customerId: phoneNumber,
                  phoneNumber,
                  nuit: data.nuit,
                  nome: data.name,
                  bi: data.biNumber,
                }
              );

              if (eligibility.eligible) {
                bankValidationResult = eligibility;
                successBank = bank;
                console.log('[REG-BANCO] Cliente encontrado em', bank.name);
                break;
              }
            } catch (error) {
              console.log('[REG-BANCO] Erro consultando', bank.name, ':', error.message);
              continue;
            }
          }

          if (!bankValidationResult || !successBank) {
            console.log('[REG-BANCO] Cliente não encontrado em nenhum banco');
            
            try {
              await this.smsService.sendSms(
                phoneNumber,
                `PayJA - Registro não aprovado.\n\nDesculpe, não encontramos seus dados em nenhum banco parceiro.\n\nContate suporte: 800-PAYJA`,
                'NOTIFICATION'
              );
            } catch (smsError) {
              console.error('[REG-BANCO] Erro ao enviar SMS:', smsError);
            }

            await this.prisma.ussdSession.update({
              where: { sessionId },
              data: { isActive: false, endedAt: new Date() },
            });

            return {
              message: '❌ Registro não aprovado\n\nNão encontramos seus dados em nenhum banco parceiro.\n\nContate suporte para mais informações.',
              continueSession: false,
            };
          }

          // 3. Se encontrou no banco, registrar no PayJA com dados do banco
          console.log('[REG-BANCO] Registrando cliente com dados do banco:', successBank.name);

          const customer = await this.prisma.customer.upsert({
            where: { phoneNumber },
            update: {
              name: data.name,
              nuit: data.nuit,
              biNumber: data.biNumber,
              biIssueDate: data.biIssueDate,
              biExpiryDate: data.biExpiryDate,
              profession: data.profession,
              salary: data.salary,
              salaryBank: successBank.name,
              creditLimit: bankValidationResult.maxAmount || 0,
              verified: true,
              channel: 'MOVITEL',
            },
            create: {
              phoneNumber,
              name: data.name,
              nuit: data.nuit,
              biNumber: data.biNumber,
              biIssueDate: data.biIssueDate,
              biExpiryDate: data.biExpiryDate,
              profession: data.profession,
              salary: data.salary,
              salaryBank: successBank.name,
              creditLimit: bankValidationResult.maxAmount || 0,
              verified: true,
              channel: 'MOVITEL',
            },
          });

          // 4. Limpar sessão
          await this.prisma.ussdSession.update({
            where: { sessionId },
            data: { isActive: false, endedAt: new Date() },
          });

          console.log('[REG-BANCO] Registro completo para', phoneNumber, '| Banco:', successBank.name, '| Limite:', bankValidationResult.maxAmount);

          // 5. Enviar SMS de aprovação
          try {
            await this.smsService.sendSms(
              phoneNumber,
              `PayJA - Registro aprovado!\n\nOlá ${data.name}!\n\nBanco: ${successBank.name}\nLimite aprovado: ${(bankValidationResult.maxAmount || 0).toFixed(0)} MZN\n\nVocê já pode solicitar empréstimos!\nDisque *898# para continuar.\n\nBem-vindo ao PayJA!`,
              'NOTIFICATION'
            );
          } catch (smsError) {
            console.error('[REG-BANCO] Erro ao enviar SMS:', smsError);
          }

          const finalMsg = `✓ REGISTRO APROVADO!\n\nOlá ${data.name}!\n\nBanco: ${successBank.name}\nLimite aprovado: ${(bankValidationResult.maxAmount || 0).toFixed(0)} MZN\n\nVocê já pode solicitar empréstimos!\nDisque *898# para acessar.\n\nBem-vindo ao PayJA!`;

          return { message: finalMsg, continueSession: false };
        } catch (error) {
          console.error('[REG-BANCO] ERRO:', error);
          await this.prisma.ussdSession.update({
            where: { sessionId },
            data: { isActive: false, endedAt: new Date() },
          });

          return {
            message: 'Erro ao processar registro.\n\nTente novamente ou contate suporte.',
            continueSession: false,
          };
        }
      }

      return { message: 'Erro no fluxo. Tente novamente.', continueSession: false };

    } catch (error) {
      console.error('[REG] Erro:', error);
      return {
        message: 'Erro ao processar. Tente novamente.',
        continueSession: false,
      };
    }
  }

  private async updateSession(sessionId: string, step: string, data: any): Promise<void> {
    await this.prisma.ussdSession.updateMany({
      where: { sessionId },
      data: {
        currentStep: step,
        state: JSON.stringify(data),
        lastActivity: new Date(),
      },
    });
    console.log('[REG] Sessao atualizada -> Step:', step);
  }
}
