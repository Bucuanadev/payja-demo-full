import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UssdMenuService } from './ussd-menu.service';

interface UssdResponse {
  response: string;
  shouldClose: boolean;
}

@Injectable()
export class UssdMovitelService {
  constructor(
    private prisma: PrismaService,
    private menuService: UssdMenuService,
  ) {}

  async processRequest(
    sessionId: string,
    msisdn: string,
    userInput: string,
  ): Promise<UssdResponse> {
    try {
      console.log('[USSD-MOVITEL] Request:', { sessionId, msisdn, userInput });

      // Validar número Movitel (86 ou 87)
      // Formato: 258 86 XXXXXXX ou 258 87 XXXXXXX
      const movitelPrefix = msisdn.substring(3, 5); // Após "258", pega 2 dígitos (86 ou 87)
      console.log('[USSD-MOVITEL] Validando prefixo:', movitelPrefix, 'do número:', msisdn);
      
      // Temporariamente desabilitado para debug
      // if (movitelPrefix !== '86' && movitelPrefix !== '87') {
      //   return {
      //     response: 'Servico disponivel apenas para numeros Movitel (86/87).',
      //     shouldClose: true,
      //   };
      // }

      // Buscar ou criar sessão
      let session = await this.prisma.ussdSession.findUnique({
        where: { sessionId },
      });

      // Se não encontrar sessão pelo ID, buscar por número pendente de OTP
      if (!session) {
        const pendingOtpSession = await this.prisma.ussdSession.findFirst({
          where: {
            phoneNumber: msisdn,
            currentStep: 'REGISTER_OTP',
            otpCode: { not: null },
            otpExpiresAt: { gt: new Date() },
          },
          orderBy: { startedAt: 'desc' },
        });

        if (pendingOtpSession) {
          // Atualizar sessionId e usar a sessão existente
          session = await this.prisma.ussdSession.update({
            where: { id: pendingOtpSession.id },
            data: {
              sessionId: sessionId,
              isActive: true,
            },
          });
          console.log('[USSD-MOVITEL] Sessao OTP encontrada e reativada:', session.sessionId);
        }
      }

      // Primeira interação - criar sessão
      if (!session) {
        console.log('[USSD-MOVITEL] Nova sessao');

        // Verificar se há OTP pendente (sessão fechada mas OTP ainda válido)
        const pendingOtpClosedSession = await this.prisma.ussdSession.findFirst({
          where: {
            phoneNumber: msisdn,
            currentStep: 'REGISTER_OTP',
            otpCode: { not: null },
            otpExpiresAt: { gt: new Date() },
            isActive: false,
          },
          orderBy: { startedAt: 'desc' },
        });

        if (pendingOtpClosedSession) {
          // Reativar sessão para inserir OTP
          session = await this.prisma.ussdSession.update({
            where: { id: pendingOtpClosedSession.id },
            data: {
              sessionId: sessionId,
              isActive: true,
            },
          });
          console.log('[USSD-MOVITEL] Sessao OTP fechada reativada:', session.sessionId);
        } else {
          // Verificar se cliente está registrado
          const customer = await this.prisma.customer.findUnique({
            where: { phoneNumber: msisdn },
          });

          if (!customer || !customer.verified) {
            // Cliente não registrado - iniciar registro
            session = await this.prisma.ussdSession.create({
              data: {
                sessionId,
                phoneNumber: msisdn,
                currentStep: 'REGISTER_INIT',
                state: '{}',
                isActive: true,
              },
            });
          } else {
            // Cliente já registrado - mostrar menu principal
            session = await this.prisma.ussdSession.create({
              data: {
                sessionId,
                phoneNumber: msisdn,
                currentStep: 'MAIN',
                state: '{}',
                customerId: customer.id,
                isActive: true,
              },
            });
          }
        }
      }

      // Processar via menu service
      const state = session.state ? JSON.parse(session.state) : {};

      const result = await this.menuService.processStep(
        sessionId,
        msisdn,
        session.currentStep,
        userInput,
        state,
      );

      console.log('[USSD-MOVITEL] Response:', {
        response: result.response.substring(0, 50),
        shouldClose: result.shouldClose,
      });

      // Se sessão deve fechar, marcar como inativa
      if (result.shouldClose) {
        await this.prisma.ussdSession.updateMany({
          where: { sessionId },
          data: {
            isActive: false,
            endedAt: new Date(),
          },
        });
      }

      return result;
    } catch (error) {
      console.error('[USSD-MOVITEL] Erro no processamento:', error);
      console.error('[USSD-MOVITEL] Stack:', error.stack);
      throw error;
    }
  }

  async getSessionStatus(sessionId: string) {
    const session = await this.prisma.ussdSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return { exists: false };
    }

    return {
      exists: true,
      sessionId: session.sessionId,
      phoneNumber: session.phoneNumber,
      currentStep: session.currentStep,
      isActive: session.isActive,
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
      customerId: session.customerId,
    };
  }
}
