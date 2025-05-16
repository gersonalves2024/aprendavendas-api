import axios, { AxiosError } from 'axios';

interface YapayTokenResponse {
  access_token: string;
  access_token_expiration: string;
  refresh_token: string;
  refresh_token_expiration: string;
}

export interface YapayPaymentLinkRequest {
  order_number: string; // CPF + timestamp
  code: string; // Código do curso
  value: string; // Valor em formato string "199.90"
  description: string; // Descrição do curso (ex: "Online MOPP")
  max_split_transaction: string; // Número máximo de parcelas
  available_payment_methods: string; // "3,4,5,16" para cartão ou "27" para PIX
  new_checkout: boolean; // Sempre true
  use_cards: boolean; // Sempre false
  customer_email?: string; // Email do aluno (opcional)
}

interface YapayPaymentLinkResponse {
  resource: string;
  id: number;
  order_number: string;
  code: string;
  value: string;
  description: string;
  max_split_transaction: number;
  available_payment_methods: string;
  payment_link: string;
  status: boolean | number; // Pode ser booleano ou número
  created_at: string;
}

class YapayService {
  private apiUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private code: string;
  private accessToken: string | null = null;
  private accessTokenExpiration: Date | null = null;

  constructor() {
    this.apiUrl = process.env.YAPAY_API_URL || 'https://api.intermediador.yapay.com.br';
    this.consumerKey = process.env.YAPAY_CONSUMER_KEY || '';
    this.consumerSecret = process.env.YAPAY_CONSUMER_SECRET || '';
    this.code = process.env.YAPAY_CODE || '';
    
    // Log dos valores no construtor
    console.log('YapayService inicializado com:');
    console.log('YAPAY_API_URL:', this.apiUrl);
    console.log('YAPAY_CONSUMER_KEY (definida):', !!this.consumerKey);
    console.log('YAPAY_CONSUMER_SECRET (definida):', !!this.consumerSecret);
    console.log('YAPAY_CODE (definido):', !!this.code);
  }

  /**
   * Obtém um token de acesso para a API da Yapay
   * @returns Token de acesso
   */
  async getAccessToken(): Promise<string> {
    // Verificar se já tem um token válido
    if (this.accessToken && this.accessTokenExpiration && this.accessTokenExpiration > new Date()) {
      return this.accessToken;
    }

    console.log("Tentando obter token de acesso Yapay...");
    console.log("YAPAY_API_URL:", this.apiUrl);
    console.log("YAPAY_CONSUMER_KEY definida:", !!this.consumerKey);
    console.log("YAPAY_CONSUMER_SECRET definida:", !!this.consumerSecret);
    console.log("YAPAY_CODE definido:", !!this.code);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/authorizations/access_token`,
        {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
          code: this.code
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/xml' // API responde com XML
          }
        }
      );

      // Resposta é XML, extrair o token com regex
      const xmlResponse = response.data;
      
      // Extrair access_token com regex
      const accessTokenMatch = /<access_token>([^<]+)<\/access_token>/.exec(xmlResponse);
      if (!accessTokenMatch) {
        console.error('Token não encontrado na resposta XML');
        throw new Error('Token não encontrado na resposta');
      }
      
      this.accessToken = accessTokenMatch[1];
      console.log("Token Yapay obtido com sucesso:", this.accessToken);
      
      // Extrair data de expiração
      const expirationMatch = /<access_token_expiration[^>]*>([^<]+)<\/access_token_expiration>/.exec(xmlResponse);
      if (expirationMatch) {
        const expirationDateStr = expirationMatch[1];
        this.accessTokenExpiration = new Date(expirationDateStr);
        console.log("Token expira em:", this.accessTokenExpiration);
      } else {
        // Se não conseguir extrair a data de expiração, definir para 24h no futuro
        this.accessTokenExpiration = new Date();
        this.accessTokenExpiration.setHours(this.accessTokenExpiration.getHours() + 24);
        console.log("Data de expiração não encontrada, definida para 24h:", this.accessTokenExpiration);
      }

      return this.accessToken;
    } catch (error: unknown) {
      console.error('Erro ao obter token de acesso da Yapay:');
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // A API respondeu com status de erro
        console.error("Status:", axiosError.response.status);
        console.error("Dados:", axiosError.response.data);
      } else if (axiosError.request) {
        // A requisição foi feita mas não houve resposta
        console.error("Não houve resposta:", axiosError.request);
      } else {
        // Algo aconteceu ao configurar a requisição
        console.error("Erro:", axiosError.message);
      }
      throw new Error('Falha ao autenticar com a API da Yapay');
    }
  }

  /**
   * Gera um link de pagamento para um estudante
   * @param paymentData Dados para geração do link de pagamento
   * @returns Dados do link de pagamento gerado
   */
  async generatePaymentLink(paymentData: YapayPaymentLinkRequest): Promise<YapayPaymentLinkResponse> {
    try {
      // Obter token de acesso
      const accessToken = await this.getAccessToken();
      console.log("Token usado para gerar link:", accessToken);

      // Fazer requisição para criar link de pagamento
      const response = await axios.post<YapayPaymentLinkResponse>(
        `${this.apiUrl}/api/v3/charges`,
        paymentData,
        {
          headers: {
            'Authorization': `Token token=${accessToken}, type=access_token`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log("Link de pagamento gerado com sucesso:", response.data.payment_link);
      return response.data;
    } catch (error: unknown) {
      console.error('Erro ao gerar link de pagamento na Yapay:');
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error("Status:", axiosError.response.status);
        console.error("Dados:", axiosError.response.data);
      } else if (axiosError.request) {
        console.error("Não houve resposta:", axiosError.request);
      } else {
        console.error("Erro:", axiosError.message);
      }
      throw new Error('Falha ao gerar link de pagamento');
    }
  }
}

export const yapayService = new YapayService(); 