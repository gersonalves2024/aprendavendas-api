import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Script para migração da tabela Student.
 * Este script cria transações para todos os alunos que ainda não as possuem,
 * movendo os dados de curso e pagamento da tabela Student para Transaction.
 */
async function migrateStudentModel() {
  console.log('Iniciando migração do modelo Student...');
  
  try {
    // 1. Buscar todos os alunos que ainda têm dados de curso e pagamento
    const students = await prisma.student.findMany({
      where: {
        // Buscamos alunos que ainda têm courseId (campo que será removido)
        courseId: {
          not: null
        }
      },
      select: {
        id: true,
        courseId: true,
        courseModalityId: true,
        value: true,
        paymentType: true,
        installments: true,
        paymentStatus: true,
        paymentDate: true,
        paymentForecastDate: true,
        couponId: true,
        discountAmount: true,
        affiliateCommission: true,
        userId: true,
        transactions: {
          select: { id: true }
        }
      }
    });
    
    console.log(`Encontrados ${students.length} alunos para migrar.`);
    
    // 2. Para cada aluno, verificar se já tem transação e criar uma nova se necessário
    const results = await Promise.all(
      students.map(async (student) => {
        // Se o aluno já tem transações, não precisamos criar uma nova
        if (student.transactions && student.transactions.length > 0) {
          return { 
            studentId: student.id, 
            result: 'Pulado: aluno já possui transações' 
          };
        }
        
        try {
          // Criar uma nova transação com os dados do curso e pagamento do aluno
          const transaction = await prisma.transaction.create({
            data: {
              studentId: student.id,
              totalValue: student.value,
              paymentType: student.paymentType,
              installments: student.installments,
              paymentStatus: student.paymentStatus,
              paymentDate: student.paymentDate,
              paymentForecastDate: student.paymentForecastDate,
              createdById: student.userId,
              couponId: student.couponId,
              discountAmount: student.discountAmount,
              courses: {
                create: [{
                  courseId: student.courseId,
                  courseModalityId: student.courseModalityId
                }]
              }
            }
          });
          
          return {
            studentId: student.id,
            result: 'Sucesso',
            transactionId: transaction.id
          };
        } catch (error) {
          console.error(`Erro ao criar transação para aluno ${student.id}:`, error);
          return {
            studentId: student.id,
            result: 'Erro',
            error: (error as Error).message
          };
        }
      })
    );
    
    // 3. Analisar os resultados
    const successful = results.filter(r => r.result === 'Sucesso').length;
    const skipped = results.filter(r => r.result.startsWith('Pulado')).length;
    const failed = results.filter(r => r.result === 'Erro').length;
    
    console.log('Migração concluída:');
    console.log(`- Total processado: ${results.length}`);
    console.log(`- Sucesso: ${successful}`);
    console.log(`- Ignorados: ${skipped}`);
    console.log(`- Falhas: ${failed}`);
    
    // 4. Executar a migração SQL para remover os campos redundantes
    if (failed === 0) {
      console.log('\nTodos os dados foram migrados com sucesso.');
      console.log('Você pode agora executar a migração SQL para remover os campos redundantes.');
      console.log('Utilize: npx prisma migrate dev --name remove_redundant_fields_from_student');
    } else {
      console.log('\nATENÇÃO: Houve falhas na migração de dados.');
      console.log('Corrija os erros antes de prosseguir com a migração SQL.');
    }
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar a migração
migrateStudentModel()
  .catch(error => {
    console.error('Erro fatal durante a migração:', error);
    process.exit(1);
  }); 