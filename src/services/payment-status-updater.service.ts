import { PrismaClient } from '@prisma/client';
import { yapayService } from './yapay.service';

// Cliente Prisma para acesso ao banco de dados
const prisma = new PrismaClient();

/**
 * Serviço para atualizar o status de pagamentos via Yapay
 */
export class PaymentStatusUpdaterService {
  /**
   * Mapeia status da Yapay para o formato do sistema
   */
  private mapYapayStatusToSystemStatus(yapayStatus: string): string {
    // Garantir que o status está em lowercase para normalização
    const normalizedStatus = yapayStatus?.toLowerCase() || '';
    
    // Log do status original para debug
    console.log(`Mapeando status Yapay: "${yapayStatus}" (normalizado: "${normalizedStatus}")`);
    
    // Mapeamento completo de status da Yapay para o sistema
    const statusMap: Record<string, string> = {
      'waiting_payment': 'Pendente',
      'pending': 'Pendente',
      'em análise': 'Pendente',
      'in_analysis': 'Pendente',
      'canceled': 'Cancelado',
      'cancelled': 'Cancelado',
      'disapproved': 'Cancelado',
      'approved': 'Pago',
      'paid': 'Pago',
      'completed': 'Pago',
      'chargeback': 'Cancelado'
    };
    
    // Verificar se o status é um dos conhecidos
    const mappedStatus = statusMap[normalizedStatus];
    
    // Se não encontrou um mapeamento específico, tentar identificar por palavras-chave
    if (!mappedStatus) {
      console.log(`Status "${normalizedStatus}" não encontrado no mapeamento direto, verificando por palavras-chave...`);
      
      if (normalizedStatus.includes('approv') || normalizedStatus.includes('paid') || normalizedStatus.includes('pago')) {
        console.log(`Status "${normalizedStatus}" identificado como PAGO por palavras-chave`);
        return 'Pago';
      }
      
      if (normalizedStatus.includes('cancel') || normalizedStatus.includes('denied') || normalizedStatus.includes('reject')) {
        console.log(`Status "${normalizedStatus}" identificado como CANCELADO por palavras-chave`);
        return 'Cancelado';
      }
      
      // Se não conseguiu identificar, manter como pendente
      console.log(`Status "${normalizedStatus}" não identificado, mantendo como PENDENTE`);
      return 'Pendente';
    }
    
    console.log(`Status "${normalizedStatus}" mapeado para "${mappedStatus}"`);
    return mappedStatus;
  }

  /**
   * Verifica e atualiza o status de todas as transações pendentes
   * @returns Objeto com informações sobre as atualizações realizadas
   */
  async updatePendingPayments(): Promise<{
    checked: number;
    updated: number;
    errors: number;
    details: Array<{
      orderNumber: string;
      status: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    console.log('Iniciando verificação de pagamentos pendentes...');
    
    const result = {
      checked: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{
        orderNumber: string;
        status: string;
        success: boolean;
        error?: string;
      }>
    };

    try {
      // Buscar links de pagamento com status pendente (1)
      const pendingLinks = await prisma.paymentLink.findMany({
        where: {
          status: 1, // Status pendente
        },
        include: {
          student: true,
          transaction: true,
        },
      });

      console.log(`Encontrados ${pendingLinks.length} links de pagamento pendentes para verificação.`);
      result.checked = pendingLinks.length;

      // Processar cada link pendente
      for (const link of pendingLinks) {
        try {
          console.log(`Verificando status do pagamento: ${link.orderNumber}`);
          
          // Consultar status atual na Yapay
          const statusResponse = await yapayService.checkTransactionStatus(link.orderNumber);
          
          // Mapear o status da Yapay para o formato do sistema
          const systemStatus = this.mapYapayStatusToSystemStatus(statusResponse.status);
          
          console.log(`Status atual do pagamento ${link.orderNumber}: Yapay=${statusResponse.status}, Sistema=${systemStatus}`);
          
          // Verificar se o status mudou
          const currentStatus = link.status === 1 ? 'Pendente' : 
                               link.status === 2 ? 'Pago' : 
                               link.status === 3 ? 'Cancelado' : 'Desconhecido';
          
          if (systemStatus !== currentStatus) {
            console.log(`Atualizando status do pagamento ${link.orderNumber} de ${currentStatus} para ${systemStatus}`);
            
            // Mapear para o valor numérico do status
            const numericStatus = systemStatus === 'Pago' ? 2 : 
                                 systemStatus === 'Cancelado' ? 3 : 1;
            
            // Atualizar o status do link de pagamento
            await prisma.paymentLink.update({
              where: { id: link.id },
              data: { 
                status: numericStatus,
                updatedAt: new Date()
              }
            });
            
            // Se o link de pagamento está associado a uma transação, atualizar o status da transação também
            if (link.transactionId) {
              console.log(`Atualizando status da transação ID ${link.transactionId} para ${systemStatus}`);
              
              await prisma.transaction.update({
                where: { id: link.transactionId },
                data: {
                  paymentStatus: systemStatus,
                  // Se foi pago, atualizar a data de pagamento na transação
                  ...(systemStatus === 'Pago' ? { paymentDate: new Date() } : 
                     systemStatus === 'Cancelado' ? { paymentDate: null } : {})
                }
              });
            }
            
            result.updated++;
            result.details.push({
              orderNumber: link.orderNumber,
              status: systemStatus,
              success: true
            });
          } else {
            console.log(`Status do pagamento ${link.orderNumber} não mudou (${currentStatus}).`);
            result.details.push({
              orderNumber: link.orderNumber,
              status: currentStatus,
              success: true
            });
          }
          
        } catch (error) {
          console.error(`Erro ao processar pagamento ${link.orderNumber}:`, error);
          result.errors++;
          result.details.push({
            orderNumber: link.orderNumber,
            status: 'Error',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      console.log(`Verificação de pagamentos concluída. Verificados: ${result.checked}, Atualizados: ${result.updated}, Erros: ${result.errors}`);
      return result;
      
    } catch (error) {
      console.error('Erro ao buscar pagamentos pendentes:', error);
      throw error;
    }
  }

  /**
   * Verifica e atualiza o status de um link de pagamento específico
   * @param linkId ID do link de pagamento ou studentId para verificar o último link do estudante
   * @param isStudentId Se true, o linkId é na verdade um studentId
   * @returns Resultado da verificação
   */
  async checkSpecificPaymentLink(linkId: number, isStudentId: boolean = false): Promise<{
    orderNumber: string;
    oldStatus: string;
    newStatus: string;
    updated: boolean;
    studentUpdated: boolean;
    error?: string;
  }> {
    try {
      // Buscar o link de pagamento
      let paymentLink;
      
      if (isStudentId) {
        // Buscar o último link de pagamento do estudante
        paymentLink = await prisma.paymentLink.findFirst({
          where: { 
            studentId: linkId,
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            student: true,
            transaction: true,
          },
        });
      } else {
        // Buscar o link específico
        paymentLink = await prisma.paymentLink.findUnique({
          where: { id: linkId },
          include: {
            student: true,
            transaction: true,
          },
        });
      }

      if (!paymentLink) {
        throw new Error(isStudentId 
          ? `Nenhum link de pagamento encontrado para o estudante ID ${linkId}` 
          : `Link de pagamento ID ${linkId} não encontrado`);
      }

      // Mapear o status atual do sistema
      const currentStatus = paymentLink.status === 1 ? 'Pendente' : 
                            paymentLink.status === 2 ? 'Pago' : 
                            paymentLink.status === 3 ? 'Cancelado' : 'Desconhecido';
      
      // Obter status da Yapay, independente do status atual - garantimos verificação sempre atualizada
      console.log(`Consultando status do pagamento ${paymentLink.orderNumber} na Yapay (status atual: ${currentStatus})...`);
      
      // Consultar status atual na Yapay
      const statusResponse = await yapayService.checkTransactionStatus(paymentLink.orderNumber);
      
      // Mapear o status da Yapay para o formato do sistema
      const systemStatus = this.mapYapayStatusToSystemStatus(statusResponse.status);
      
      console.log(`Status atual do pagamento ${paymentLink.orderNumber}: Yapay=${statusResponse.status}, Sistema=${systemStatus}`);
      
      let updated = false;
      
      // Verificar se o status mudou
      if (systemStatus !== currentStatus) {
        console.log(`Atualizando status do pagamento ${paymentLink.orderNumber} de ${currentStatus} para ${systemStatus}`);
        
        // Mapear para o valor numérico do status
        const numericStatus = systemStatus === 'Pago' ? 2 : 
                              systemStatus === 'Cancelado' ? 3 : 1;
        
        // Atualizar o status do link de pagamento
        await prisma.paymentLink.update({
          where: { id: paymentLink.id },
          data: { 
            status: numericStatus,
            updatedAt: new Date()
          }
        });
        
        updated = true;
        
        // Se o link de pagamento está associado a uma transação, atualizar o status da transação também
        if (paymentLink.transactionId) {
          console.log(`Atualizando status da transação ID ${paymentLink.transactionId} para ${systemStatus}`);
          
          await prisma.transaction.update({
            where: { id: paymentLink.transactionId },
            data: { 
              paymentStatus: systemStatus,
              // Se foi pago, atualizar a data de pagamento na transação
              ...(systemStatus === 'Pago' ? { paymentDate: new Date() } : 
                 systemStatus === 'Cancelado' ? { paymentDate: null } : {})
            }
          });
        }
      } else {
        console.log(`O status do pagamento ${paymentLink.orderNumber} não mudou: ${currentStatus}`);
      }
      
      return {
        orderNumber: paymentLink.orderNumber,
        oldStatus: currentStatus,
        newStatus: systemStatus,
        updated,
        studentUpdated: false // Sempre false já que não atualizamos mais o campo no Student
      };
      
    } catch (error) {
      console.error('Erro ao verificar link de pagamento específico:', error);
      return {
        orderNumber: '',
        oldStatus: '',
        newStatus: '',
        updated: false,
        studentUpdated: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Instância única do serviço
export const paymentStatusUpdater = new PaymentStatusUpdaterService(); 