import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject, ZodTypeAny } from 'zod';
import { ZodError } from 'zod';

/**
 * Mapeamento de nomes de campos para exibição amigável ao usuário
 */
const fieldDisplayNames: Record<string, string> = {
  fullName: 'Nome completo',
  cpf: 'CPF',
  email: 'E-mail',
  ddd: 'DDD',
  phone: 'Telefone',
  birthDate: 'Data de nascimento',
  courseModalityId: 'Modalidade do curso',
  courseId: 'Curso',
  value: 'Valor',
  totalValue: 'Valor total',
  paymentType: 'Tipo de pagamento',
  installments: 'Parcelas',
  paymentStatus: 'Status de pagamento',
  paymentDate: 'Data de pagamento',
  paymentForecastDate: 'Previsão de pagamento',
  password: 'Senha',
  confirmPassword: 'Confirmar senha',
  cnhNumber: 'Número da CNH',
  cnhType: 'Categoria da CNH',
  renach: 'RENACH',
  existingStudentId: 'ID do estudante',
  courses: 'Cursos',
  name: 'Nome',
  role: 'Perfil de usuário',
  code: 'Código',
  active: 'Ativo',
  createdAt: 'Data de criação',
  updatedAt: 'Data de atualização'
};

/**
 * Obtém o nome de exibição para um campo
 */
const getFieldDisplayName = (field: string): string => {
  // Se o campo contém um índice de array (ex: courses.0.courseId)
  if (field.match(/\.\d+\./)) {
    const parts = field.split('.');
    const lastPart = parts.pop();
    if (lastPart && fieldDisplayNames[lastPart]) {
      return fieldDisplayNames[lastPart];
    }
  }
  
  // Retornar o nome mapeado ou formatar o nome do campo com capitalização se não estiver no mapa
  return fieldDisplayNames[field] || 
    field.replace(/([A-Z])/g, ' $1')  // Inserir espaço antes de letras maiúsculas
         .replace(/^./, match => match.toUpperCase()) // Capitalizar primeira letra
         .trim();
};

/**
 * Converte a fonte de dados em uma descrição amigável
 */
const sourceToDescription = (source: 'body' | 'query' | 'params'): string => {
  const descriptions = {
    body: 'entrada',
    query: 'parâmetros de consulta',
    params: 'parâmetros de rota'
  };
  return descriptions[source];
};

/**
 * Middleware para validar os dados de entrada usando um schema Zod
 * @param schema - O schema Zod para validar os dados
 * @param source - A fonte dos dados a serem validados (body, query, params)
 */
export const validate = (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validationResult = schema.safeParse(data);

      if (!validationResult.success) {
        const formattedErrors = formatZodErrors(validationResult.error);
        
        return res.status(400).json({
          error: `Dados de ${sourceToDescription(source)} inválidos`,
          details: formattedErrors
        });
      }
      
      // Atualiza os dados da requisição com os dados validados e transformados pelo Zod
      req[source] = validationResult.data;
      
      return next();
    } catch (error) {
      console.error(`Erro na validação de ${source}:`, error);
      
      if (error instanceof ZodError) {
        const formattedErrors = formatZodErrors(error);
        
        return res.status(400).json({
          error: `Dados de ${sourceToDescription(source)} inválidos`,
          details: formattedErrors
        });
      }
      
      return res.status(500).json({ 
        error: 'Erro durante a validação dos dados',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };
};

/**
 * Formata os erros Zod para um formato mais amigável
 */
const formatZodErrors = (error: ZodError) => {
  const result: Record<string, { message: string; path?: string[] }> = {};
  
  for (const err of error.errors) {
    const pathStr = err.path.map(p => String(p)).join('.');
    
    // Obtenha o nome de exibição do campo
    const fieldName = getFieldDisplayName(pathStr);
    
    // Melhora a mensagem para ser mais descritiva
    let enhancedMessage = err.message;
    
    // Se a mensagem for apenas "Required", adicione o nome do campo
    if (enhancedMessage === 'Required') {
      enhancedMessage = `O campo ${fieldName} é obrigatório`;
    } 
    // Para outras mensagens genéricas, adicione o nome do campo se não estiver incluído
    else if (enhancedMessage && !enhancedMessage.toLowerCase().includes(fieldName.toLowerCase())) {
      // Verifique se a mensagem já contém uma frase completa
      if (!enhancedMessage.match(/^[A-Z]/)) {
        // Só adicione o nome do campo se a mensagem não começar com letra maiúscula
        enhancedMessage = `${fieldName}: ${enhancedMessage}`;
      }
    }
    
    result[pathStr] = {
      message: enhancedMessage,
      path: err.path.map(p => String(p))
    };
  }
  
  return result;
}; 