const axios = require('axios');
const { parseString } = require('xml2js');
const util = require('util');
require('dotenv').config();

const parseXml = util.promisify(parseString);

// Credenciais da Yapay
const apiUrl = process.env.YAPAY_API_URL || 'https://api.intermediador.yapay.com.br';
const consumerKey = process.env.YAPAY_CONSUMER_KEY;
const consumerSecret = process.env.YAPAY_CONSUMER_SECRET;
const code = process.env.YAPAY_CODE;

console.log('Credenciais da Yapay:');
console.log('YAPAY_API_URL:', apiUrl);
console.log('YAPAY_CONSUMER_KEY (definida):', !!consumerKey);
console.log('YAPAY_CONSUMER_SECRET (definida):', !!consumerSecret);
console.log('YAPAY_CODE (definido):', !!code);

// Função para obter token
async function getAccessToken() {
  try {
    console.log('Fazendo requisição para obter token...');
    console.log('Endpoint:', `${apiUrl}/api/v1/authorizations/access_token`);
    
    const response = await axios.post(
      `${apiUrl}/api/v1/authorizations/access_token`,
      {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        code: code
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/xml' // Explicitamente aceitando XML
        }
      }
    );

    console.log('Resposta recebida da API Yapay (XML)');
    
    // Extrair o token usando regex para simplificar (em vez de usar xml2js)
    const xmlResponse = response.data;
    const accessTokenMatch = /<access_token>([^<]+)<\/access_token>/.exec(xmlResponse);
    
    if (!accessTokenMatch) {
      console.error('Token não encontrado na resposta XML');
      console.log('Resposta completa:', xmlResponse);
      return null;
    }
    
    const accessToken = accessTokenMatch[1];
    console.log('Token extraído do XML:', accessToken);
    
    return accessToken;
  } catch (error) {
    console.error('Erro ao obter token:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Função para gerar link de pagamento
async function generatePaymentLink(token) {
  if (!token) {
    console.error('Sem token válido para gerar link de pagamento');
    return;
  }
  
  try {
    console.log('Fazendo requisição para gerar link de pagamento...');
    console.log('Endpoint:', `${apiUrl}/api/v3/charges`);
    console.log('Token usado:', token);
    
    const orderNumber = `TEST${Date.now()}`;
    const paymentData = {
      order_number: orderNumber,
      code: 'TESTE',
      value: '10.00',
      description: 'Teste de Pagamento',
      max_split_transaction: '1',
      available_payment_methods: '27', // PIX
      new_checkout: true,
      use_cards: false,
      customer_email: 'teste@teste.com'
    };
    
    console.log('Dados:', paymentData);
    console.log('Cabeçalho de autorização:', `Token token=${token}, type=access_token`);
    
    const response = await axios.post(
      `${apiUrl}/api/v3/charges`,
      paymentData,
      {
        headers: {
          'Authorization': `Token token=${token}, type=access_token`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('Link de pagamento gerado com sucesso:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Erro ao gerar link de pagamento:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Executar o teste
(async () => {
  console.log('Iniciando teste da API Yapay...');
  const token = await getAccessToken();
  if (token) {
    console.log('Token obtido:', token);
    await generatePaymentLink(token);
  } else {
    console.error('Não foi possível obter o token.');
  }
})(); 