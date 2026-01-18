import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BankSyncService {
  private readonly logger = new Logger(BankSyncService.name);

  constructor(private prisma: PrismaService) {}

  async handleSync(payload: any) {
    const { event, data } = payload;
    this.logger.log(`Recebido evento de sincronização: ${event}`);

    switch (event) {
      case 'customer.created':
      case 'customer.updated':
        return await this.upsertCustomer(data);
      case 'customer.deleted':
        return await this.deleteCustomer(data.nuit);
      default:
        this.logger.warn(`Evento desconhecido: ${event}`);
        return { success: false, message: 'Evento desconhecido' };
    }
  }

  private async upsertCustomer(data: any) {
    try {
      const customerData = {
        phoneNumber: data.telefone || `BANCO-${data.nuit}`,
        name: data.nome_completo,
        nuit: data.nuit,
        biNumber: data.bi,
        email: data.email || null,
        creditLimit: data.limite_credito || 0,
        creditScore: data.score_credito ?? null,
        salary: data.salario || data.renda_mensal || null,
        salaryBank: data.empregador || null,
        verified: true,
      };

      const existing = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { nuit: data.nuit },
            { biNumber: data.bi },
            { phoneNumber: data.telefone }
          ]
        }
      });

      if (existing) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: customerData,
        });
        this.logger.log(`Cliente atualizado: ${data.nuit}`);
        return { success: true, action: 'updated' };
      } else {
        await this.prisma.customer.create({
          data: customerData,
        });
        this.logger.log(`Cliente criado: ${data.nuit}`);
        return { success: true, action: 'created' };
      }
    } catch (error) {
      this.logger.error("Erro ao upsert cliente: ", error);
      return { success: false, error: error.message };
    }
  }

  private async deleteCustomer(nuit: string) {
    try {
      const existing = await this.prisma.customer.findUnique({
        where: { nuit }
      });

      if (existing) {
        await this.prisma.customer.delete({
          where: { id: existing.id }
        });
        this.logger.log(`Cliente removido: ${nuit}`);
        return { success: true, action: 'deleted' };
      }
      return { success: true, message: 'Cliente não encontrado' };
    } catch (error) {
      this.logger.error("Erro ao remover cliente: ", error);
      return { success: false, error: error.message };
    }
  }
}
