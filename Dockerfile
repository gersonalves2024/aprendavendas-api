# Estágio de build
FROM --platform=$BUILDPLATFORM node:20-alpine AS build

# Definir argumentos para multi-arquitetura
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETARCH

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências com flags para garantir compilação correta nas diferentes arquiteturas
RUN apk add --no-cache python3 make g++ git \
    && npm ci \
    && npm rebuild bcrypt --build-from-source

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# Estágio de produção
FROM --platform=$TARGETPLATFORM node:20-alpine

WORKDIR /app

# Definir NODE_ENV para produção
ENV NODE_ENV=production

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar a libssl antiga (1.1) usando um repositório legado do Alpine
# e outras dependências necessárias
RUN apk add --no-cache python3 make g++ \
    && apk add --no-cache libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.14/main \
    && npm ci --omit=dev \
    && npm rebuild bcrypt --build-from-source \
    && apk del python3 make g++

# Copiar código compilado
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Gerar novamente o Prisma Client para garantir compatibilidade
RUN npx prisma generate

# Expor a porta da aplicação
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"] 