import cron from 'node-cron';
import { paymentStatusUpdater } from '../services/payment-status-updater.service';

/**
 * Job cron para verificar o status dos pagamentos periodicamente
 * Executa a cada 5 minutos
 */
export const startPaymentStatusChecker = (): void => {
  console.log('Iniciando job de verificação de pagamentos...');
  
  // Executa a cada 5 minutos (formato: segundo minuto hora dia mês diaSemana)
  cron.schedule('0 */5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Executando verificação automática de pagamentos pendentes...`);
    
    try {
      const result = await paymentStatusUpdater.updatePendingPayments();
      console.log('Resultado da verificação automática:', {
        verificados: result.checked,
        atualizados: result.updated,
        erros: result.errors
      });
    } catch (error) {
      console.error('Erro na execução automática de verificação de pagamentos:', error);
    }
  });
  
  console.log('Job de verificação de pagamentos iniciado com sucesso!');
}; 