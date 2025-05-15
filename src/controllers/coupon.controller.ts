import { Request, Response } from 'express';
import { PrismaClient, Prisma, CouponApplicationMode } from '@prisma/client';
import { generateCouponCode } from '../utils/codeGenerator';
import { z } from 'zod';

const prisma = new PrismaClient();

// Criar novo cupom para um afiliado, vendedor ou sem vinculação
export const createCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, userType, customName, expirationDate, usageLimit } = req.body;

    // Se userType não for NONE, verificar se o usuário existe e tem o papel correto
    if (userType !== 'NONE') {
      // Verificar se o usuário existe e é um afiliado ou vendedor
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          message: 'O usuário especificado não existe',
        });
      }

      // Verificar se o papel do usuário corresponde ao userType informado
      if ((userType === 'AFFILIATE' && user.role !== 'AFFILIATE') || 
          (userType === 'SELLER' && user.role !== 'SELLER')) {
        return res.status(400).json({
          error: 'Papel de usuário inválido',
          message: `O usuário selecionado não tem papel de ${userType === 'AFFILIATE' ? 'afiliado' : 'vendedor'}`,
        });
      }

      // Verificar se o usuário já possui um cupom ativo
      const existingActiveCoupon = await prisma.coupon.findFirst({
        where: { 
          userId,
          active: true
        },
      });

      if (existingActiveCoupon) {
        return res.status(400).json({
          error: 'Cupom ativo já existe',
          message: 'Este usuário já possui um cupom ativo. Desative o cupom existente antes de criar um novo.',
        });
      }
    }

    // Gerar código único para o cupom
    // Se não estiver vinculado a um usuário, usar base genérica
    const baseName = userType === 'NONE' ? 'GERAL' : 
      await prisma.user.findUnique({ where: { id: userId } })
        .then(user => user?.name || 'CUPOM');
    
    const code = generateCouponCode(baseName);

    // Criar cupom com modo de aplicação padrão (GENERAL)
    const coupon = await prisma.coupon.create({
      data: {
        code,
        userId: userType === 'NONE' ? undefined : userId, // Só associa userId se não for NONE
        customName,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        applicationMode: CouponApplicationMode.GENERAL,
      },
    });

    return res.status(201).json({
      message: 'Cupom criado com sucesso',
      coupon,
    });
  } catch (error) {
    console.error('Erro ao criar cupom:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar o cupom',
    });
  }
};

// Atualizar modo de aplicação do cupom
export const updateCouponApplicationMode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId, applicationMode } = req.body;

    // Verificar se o cupom existe
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!existingCoupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom especificado não existe',
      });
    }

    // Atualizar modo de aplicação
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { applicationMode },
    });

    return res.status(200).json({
      message: 'Modo de aplicação atualizado com sucesso',
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error('Erro ao atualizar modo de aplicação:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar o modo de aplicação',
    });
  }
};

// Criar configuração para cupom no modo geral
export const createGeneralCouponConfig = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId, courseModalityId, discountValue, discountPercent, commissionValue, commissionPercent } = req.body;

    // Verificar se o cupom existe e está no modo GENERAL
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom especificado não existe',
      });
    }

    if (coupon.applicationMode !== CouponApplicationMode.GENERAL) {
      return res.status(400).json({
        error: 'Modo de aplicação inválido',
        message: 'Este cupom não está configurado para modo GENERAL',
      });
    }

    // Verificar se a modalidade existe
    const courseModality = await prisma.courseModality.findUnique({
      where: { id: courseModalityId },
    });

    if (!courseModality) {
      return res.status(404).json({
        error: 'Modalidade não encontrada',
        message: 'A modalidade especificada não existe',
      });
    }

    // Verificar se já existe uma configuração para esta modalidade
    const existingConfig = await prisma.couponConfiguration.findFirst({
      where: {
        couponId,
        courseModalityId,
      },
    });

    if (existingConfig) {
      // Atualizar configuração existente
      const updatedConfig = await prisma.couponConfiguration.update({
        where: { id: existingConfig.id },
        data: {
          discountValue,
          discountPercent,
          commissionValue,
          commissionPercent,
        },
      });

      return res.status(200).json({
        message: 'Configuração de cupom atualizada com sucesso',
        config: updatedConfig,
      });
    }

    // Criar nova configuração
    const config = await prisma.couponConfiguration.create({
      data: {
        couponId,
        courseModalityId,
        discountValue,
        discountPercent,
        commissionValue,
        commissionPercent,
      },
    });

    return res.status(201).json({
      message: 'Configuração de cupom criada com sucesso',
      config,
    });
  } catch (error) {
    console.error('Erro ao criar configuração de cupom:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar a configuração de cupom',
    });
  }
};

// Criar configuração para cupom no modo específico
export const createSpecificCouponConfig = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId, courseId, discountValue, discountPercent, commissionValue, commissionPercent } = req.body;

    // Verificar se o cupom existe e está no modo SPECIFIC
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom especificado não existe',
      });
    }

    if (coupon.applicationMode !== CouponApplicationMode.SPECIFIC) {
      return res.status(400).json({
        error: 'Modo de aplicação inválido',
        message: 'Este cupom não está configurado para modo SPECIFIC',
      });
    }

    // Verificar se o curso existe
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso não encontrado',
        message: 'O curso especificado não existe',
      });
    }

    // Verificar se já existe uma configuração para este curso
    const existingConfig = await prisma.couponConfiguration.findFirst({
      where: {
        couponId,
        courseId,
      },
    });

    if (existingConfig) {
      // Atualizar configuração existente
      const updatedConfig = await prisma.couponConfiguration.update({
        where: { id: existingConfig.id },
        data: {
          discountValue,
          discountPercent,
          commissionValue,
          commissionPercent,
        },
      });

      return res.status(200).json({
        message: 'Configuração de cupom atualizada com sucesso',
        config: updatedConfig,
      });
    }

    // Criar nova configuração
    const config = await prisma.couponConfiguration.create({
      data: {
        couponId,
        courseId,
        discountValue,
        discountPercent,
        commissionValue,
        commissionPercent,
      },
    });

    return res.status(201).json({
      message: 'Configuração de cupom criada com sucesso',
      config,
    });
  } catch (error) {
    console.error('Erro ao criar configuração de cupom:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar a configuração de cupom',
    });
  }
};

// Listar todas as configurações de um cupom
export const getCouponConfigurations = async (req: Request, res: Response): Promise<Response> => {
  try {
    const couponId = Number.parseInt(req.params.couponId, 10);

    if (Number.isNaN(couponId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID do cupom deve ser um número válido',
      });
    }

    // Verificar se o cupom existe
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom especificado não existe',
      });
    }

    // Buscar todas as configurações
    const configurations = await prisma.couponConfiguration.findMany({
      where: { couponId },
      include: {
        course: true,
        courseModality: true,
      },
    });

    return res.status(200).json({
      coupon,
      configurations,
    });
  } catch (error) {
    console.error('Erro ao listar configurações:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível listar as configurações do cupom',
    });
  }
};

// Excluir uma configuração específica
export const deleteCouponConfiguration = async (req: Request, res: Response): Promise<Response> => {
  try {
    const configId = Number.parseInt(req.params.configId, 10);

    if (Number.isNaN(configId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID da configuração deve ser um número válido',
      });
    }

    // Verificar se a configuração existe
    const config = await prisma.couponConfiguration.findUnique({
      where: { id: configId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'Configuração não encontrada',
        message: 'A configuração especificada não existe',
      });
    }

    // Excluir configuração
    await prisma.couponConfiguration.delete({
      where: { id: configId },
    });

    return res.status(200).json({
      message: 'Configuração excluída com sucesso',
    });
  } catch (error) {
    console.error('Erro ao excluir configuração:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível excluir a configuração',
    });
  }
};

// Buscar cupom por código
export const getCouponByCode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { code } = req.params;

    // Buscar cupom pelo código
    let coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        configurations: {
          include: {
            course: true,
            courseModality: true,
          },
        },
      },
    });

    // Se não encontrou pelo código, tentar encontrar pelo nome personalizado
    if (!coupon) {
      console.log(`Cupom não encontrado pelo código "${code}", tentando buscar por nome personalizado`);
      
      // Usar o Prisma para fazer uma busca case-insensitive
      const couponsWithCustomName = await prisma.coupon.findMany({
        where: { 
          customName: {
            equals: code,
            mode: 'insensitive' // Busca case-insensitive
          },
          active: true 
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          configurations: {
            include: {
              course: true,
              courseModality: true,
            },
          },
        },
      });

      console.log(`Encontrados ${couponsWithCustomName.length} cupons com o nome personalizado "${code}":`, 
        couponsWithCustomName.map(c => ({ id: c.id, code: c.code, customName: c.customName })));

      // Se encontrou exatamente um cupom com o nome personalizado, usar esse
      if (couponsWithCustomName.length === 1) {
        console.log(`Usando cupom encontrado por nome personalizado: ${couponsWithCustomName[0].code}`);
        coupon = couponsWithCustomName[0];
      }
      // Se encontrou mais de um, usar o primeiro ativo
      else if (couponsWithCustomName.length > 1) {
        const activeCoupon = couponsWithCustomName.find(c => c.active);
        if (activeCoupon) {
          console.log(`Encontrados múltiplos cupons, usando o primeiro ativo: ${activeCoupon.code}`);
          coupon = activeCoupon;
        }
      }
    }

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom com o código ou nome personalizado especificado não existe',
      });
    }

    return res.status(200).json(coupon);
  } catch (error) {
    console.error('Erro ao buscar cupom por código:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o cupom',
    });
  }
};

// Validar cupom para aplicação
export const validateCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { code, courseId, courseModalityId, value } = req.body;
    
    console.log('=================================================');
    console.log('VALIDAÇÃO DE CUPOM - DADOS RECEBIDOS');
    console.log('=================================================');
    console.log(`Código: ${code}`);
    console.log(`ID do Curso: ${courseId}`);
    console.log(`ID da Modalidade: ${courseModalityId}`);
    console.log(`Valor: ${value}`);

    // Buscar cupom pelo código
    let coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        configurations: true,
      },
    });

    // Se não encontrou pelo código, tentar encontrar pelo nome personalizado
    if (!coupon) {
      console.log(`Cupom não encontrado pelo código "${code}", tentando buscar por nome personalizado`);
      
      // Usar o Prisma para fazer uma busca case-insensitive
      const couponsWithCustomName = await prisma.coupon.findMany({
        where: { 
          customName: {
            equals: code,
            mode: 'insensitive' // Busca case-insensitive
          },
          active: true 
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          configurations: {
            include: {
              course: true,
              courseModality: true,
            },
          },
        },
      });

      console.log(`Encontrados ${couponsWithCustomName.length} cupons com o nome personalizado "${code}":`, 
        couponsWithCustomName.map(c => ({ id: c.id, code: c.code, customName: c.customName })));

      // Se encontrou exatamente um cupom com o nome personalizado, usar esse
      if (couponsWithCustomName.length === 1) {
        console.log(`Usando cupom encontrado por nome personalizado: ${couponsWithCustomName[0].code}`);
        coupon = couponsWithCustomName[0];
      }
      // Se encontrou mais de um, usar o primeiro ativo
      else if (couponsWithCustomName.length > 1) {
        const activeCoupon = couponsWithCustomName.find(c => c.active);
        if (activeCoupon) {
          console.log(`Encontrados múltiplos cupons, usando o primeiro ativo: ${activeCoupon.code}`);
          coupon = activeCoupon;
        }
      }
    }

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom com o código ou nome personalizado especificado não existe',
      });
    }

    if (!coupon.active) {
      return res.status(400).json({
        error: 'Cupom inativo',
        message: 'Este cupom não está mais ativo',
      });
    }

    // Verificar se o cupom está expirado
    if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
      return res.status(400).json({
        error: 'Cupom expirado',
        message: 'Este cupom já expirou',
      });
    }

    // Verificar se o cupom atingiu o limite de uso
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        error: 'Limite de uso excedido',
        message: 'Este cupom já atingiu seu limite máximo de uso',
      });
    }

    let discountAmount = 0;
    let commissionAmount = 0;
    let finalValue = value;
    let isValid = false;

    // Validar baseado no modo de aplicação
    if (coupon.applicationMode === CouponApplicationMode.GENERAL) {
      console.log('Modo GENERAL. Verificando configurações para modalidade:', courseModalityId);
      console.log('Configurações disponíveis:', JSON.stringify(coupon.configurations, null, 2));
      
      // Buscar qualquer configuração para a modalidade (ignorar valor exato)
      const config = coupon.configurations.find(
        (cfg) => cfg.courseModalityId === courseModalityId
      );

      if (config) {
        console.log('Configuração encontrada:', JSON.stringify(config, null, 2));
        isValid = true;
        // Calcular desconto
        if (config.discountValue) {
          discountAmount = config.discountValue;
          console.log(`Aplicando desconto fixo: ${discountAmount}`);
        } else if (config.discountPercent) {
          discountAmount = (value * config.discountPercent) / 100;
          console.log(`Aplicando desconto percentual: ${config.discountPercent}% sobre ${value} = ${discountAmount}`);
        }

        // Calcular comissão
        if (config.commissionValue) {
          commissionAmount = config.commissionValue;
          console.log(`Aplicando comissão fixa: ${commissionAmount}`);
        } else if (config.commissionPercent) {
          commissionAmount = (value * config.commissionPercent) / 100;
          console.log(`Aplicando comissão percentual: ${config.commissionPercent}% sobre ${value} = ${commissionAmount}`);
        }
      } else {
        console.log('Nenhuma configuração encontrada para a modalidade:', courseModalityId);
      }
    } else {
      // Modo SPECIFIC - buscar configuração para o curso específico
      console.log('Modo SPECIFIC. Verificando configurações para curso:', courseId);
      console.log('Configurações disponíveis:', JSON.stringify(coupon.configurations, null, 2));
      
      // Primeiro tentar encontrar uma configuração para o curso exato
      let config = coupon.configurations.find((cfg) => cfg.courseId === courseId);

      // Se não encontrar para o curso específico, pegar qualquer configuração
      if (!config && coupon.configurations.length > 0) {
        console.log('Nenhuma configuração encontrada para o curso específico. Usando primeira configuração disponível.');
        config = coupon.configurations[0];
      }

      if (config) {
        console.log('Configuração encontrada:', JSON.stringify(config, null, 2));
        isValid = true;
        // Calcular desconto
        if (config.discountValue) {
          discountAmount = config.discountValue;
          console.log(`Aplicando desconto fixo: ${discountAmount}`);
        } else if (config.discountPercent) {
          discountAmount = (value * config.discountPercent) / 100;
          console.log(`Aplicando desconto percentual: ${config.discountPercent}% sobre ${value} = ${discountAmount}`);
        }

        // Calcular comissão
        if (config.commissionValue) {
          commissionAmount = config.commissionValue;
          console.log(`Aplicando comissão fixa: ${commissionAmount}`);
        } else if (config.commissionPercent) {
          commissionAmount = (value * config.commissionPercent) / 100;
          console.log(`Aplicando comissão percentual: ${config.commissionPercent}% sobre ${value} = ${commissionAmount}`);
        }
      } else {
        console.log('Nenhuma configuração encontrada.');
      }
    }

    if (!isValid) {
      return res.status(400).json({
        error: 'Cupom não aplicável',
        message: 'Este cupom não é válido para o curso/modalidade/valor selecionado',
      });
    }

    // Calcular valor final
    finalValue = value - discountAmount;
    if (finalValue < 0) finalValue = 0;
    
    console.log('=================================================');
    console.log('RESULTADO DO CÁLCULO:');
    console.log(`Valor original: ${value}`);
    console.log(`Desconto aplicado: ${discountAmount}`);
    console.log(`Valor final: ${finalValue}`);
    console.log('=================================================');

    return res.status(200).json({
      valid: true,
      coupon,
      discountAmount,
      commissionAmount,
      originalValue: value,
      finalValue,
      affiliateId: coupon.user?.id || null,
    });
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível validar o cupom',
    });
  }
};

// Listar todos os cupons (para admin)
export const listAllCoupons = async (req: Request, res: Response): Promise<Response> => {
  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        configurations: {
          include: {
            course: true,
            courseModality: true,
          },
        },
        students: {
          select: {
            id: true,
            fullName: true,
            registrationDate: true,
            value: true,
            discountAmount: true,
            affiliateCommission: true,
            course: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            courseModality: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json(coupons);
  } catch (error) {
    console.error('Erro ao listar cupons:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível listar os cupons',
    });
  }
};

// Buscar cupom do afiliado (para o próprio afiliado)
export const getAffiliateCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID do usuário deve ser um número válido',
      });
    }

    // Buscar usuário para confirmar que é afiliado
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'O usuário especificado não existe',
      });
    }

    if (user.role !== 'AFFILIATE') {
      return res.status(400).json({
        error: 'Usuário não é afiliado',
        message: 'Apenas usuários com papel de afiliado podem ter cupons',
      });
    }

    // Buscar cupom ativo do afiliado
    const coupon = await prisma.coupon.findFirst({
      where: { 
        userId,
        active: true
      },
      include: {
        configurations: {
          include: {
            course: true,
            courseModality: true,
          },
        },
        students: {
          select: {
            id: true,
            fullName: true,
            registrationDate: true,
            value: true,
            discountAmount: true,
            affiliateCommission: true,
            course: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            courseModality: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'Este afiliado não possui um cupom ativo',
      });
    }

    return res.status(200).json(coupon);
  } catch (error) {
    console.error('Erro ao buscar cupom do afiliado:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o cupom',
    });
  }
};

// Ativar/desativar cupom
export const toggleCouponStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const couponId = Number.parseInt(req.params.couponId, 10);
    const { active } = req.body;

    if (Number.isNaN(couponId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID do cupom deve ser um número válido',
      });
    }

    const couponSchema = z.object({
      active: z.boolean({
        required_error: 'O status de ativação é obrigatório',
        invalid_type_error: 'O status de ativação deve ser um booleano',
      }),
    });

    try {
      couponSchema.parse({ active });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          message: err.errors[0].message,
        });
      }
    }

    // Verificar se o cupom existe
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!existingCoupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'O cupom especificado não existe',
      });
    }

    // Atualizar status do cupom
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { active },
    });

    const statusMessage = active ? 'ativado' : 'desativado';

    return res.status(200).json({
      message: `Cupom ${statusMessage} com sucesso`,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error('Erro ao atualizar status do cupom:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar o status do cupom',
    });
  }
};

// Buscar cupom ativo do usuário (para o próprio usuário - afiliado ou vendedor)
export const getActiveUserCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID do usuário deve ser um número válido',
      });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'O usuário especificado não existe',
      });
    }

    // Verificar se é afiliado ou vendedor
    if (user.role !== 'AFFILIATE' && user.role !== 'SELLER') {
      return res.status(400).json({
        error: 'Usuário não é afiliado ou vendedor',
        message: 'Apenas usuários com papel de afiliado ou vendedor podem ter cupons',
      });
    }

    // Buscar cupom ativo do usuário
    const coupon = await prisma.coupon.findFirst({
      where: { 
        userId,
        active: true
      },
      include: {
        configurations: {
          include: {
            course: true,
            courseModality: true,
          },
        },
        students: {
          select: {
            id: true,
            fullName: true,
            registrationDate: true,
            value: true,
            discountAmount: true,
            affiliateCommission: true,
            course: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            courseModality: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado',
        message: 'Este usuário não possui um cupom ativo',
      });
    }

    return res.status(200).json(coupon);
  } catch (error) {
    console.error('Erro ao buscar cupom do usuário:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o cupom',
    });
  }
};

// Obter estatísticas do dashboard do afiliado
export const getAffiliateDashboardStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'O ID do usuário deve ser um número válido',
      });
    }

    // Verificar se o usuário existe e é um afiliado
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'O usuário especificado não existe',
      });
    }

    if (user.role !== 'AFFILIATE') {
      return res.status(400).json({
        error: 'Usuário não é afiliado',
        message: 'Apenas usuários com papel de afiliado podem acessar estas estatísticas',
      });
    }
    
    // Buscar o cupom ativo do afiliado com suas vendas
    const coupon = await prisma.coupon.findFirst({
      where: { 
        userId,
        active: true
      },
      include: {
        students: {
          select: {
            id: true,
            registrationDate: true,
            affiliateCommission: true
          },
        },
      },
    });
    
    // Inicializar estatísticas
    const stats = {
      totalSales: 0,
      pendingAmount: 0,
      totalAmount: 0,
      monthlySales: 0,
      lastPaymentDate: null
    };
    
    if (coupon && coupon.students && coupon.students.length > 0) {
      // Calcular estatísticas
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      stats.totalSales = coupon.students.length;
      
      // Vendas do mês atual
      stats.monthlySales = coupon.students.filter(sale => {
        const saleDate = new Date(sale.registrationDate);
        return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      }).length;
      
      // Somar comissões (assumindo que todas as comissões estão pendentes por simplicidade)
      stats.pendingAmount = coupon.students.reduce((total, sale) => total + (sale.affiliateCommission || 0), 0);
      
      // Em um sistema real, precisaríamos de um status de pagamento para cada comissão
      // Por enquanto, estamos apenas simulando que comissões mais antigas que 30 dias já foram pagas
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      stats.totalAmount = coupon.students
        .filter(sale => new Date(sale.registrationDate) < thirtyDaysAgo)
        .reduce((total, sale) => total + (sale.affiliateCommission || 0), 0);
    }
    
    return res.status(200).json(stats);
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas do afiliado:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar as estatísticas do afiliado',
    });
  }
}; 