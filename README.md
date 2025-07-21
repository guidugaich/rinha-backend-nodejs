# Rinha Backend 2025

Sistema de processamento de pagamentos desenvolvido como parte do desafio da [Rinha de Backend 2025](https://github.com/zanfranceschi/rinha-de-backend-2025), desenvolvido com Node.js/TypeScript, Fastify, PostgreSQL e Redis.

## Arquitetura de Serviços

A aplicação utiliza uma arquitetura de serviços distribuída definida no `docker-compose.yml`, composta pelos seguintes componentes:

#### Load Balancer Nginx
- **Container**: `nginx`
- **Função**: Balanceamento de carga entre as instâncias da API
- **Configuração**: Round-robin entre `api1:9999` e `api2:9999`
- **Recursos**: 0.1 CPU, 20MB RAM

#### API Node.js/Fastify
- **Containers**: `api1` e `api2`
- **Função**: Processamento de requisições de pagamento
- **Tecnologia**: Node.js + TypeScript + Fastify
- **Recursos por instância**: 0.425 CPU, 100MB RAM

#### Banco para persistência (PostgreSQL)
- **Container**: `db`
- **Função**: Persistência de dados de pagamentos
- **Recursos**: 0.5 CPU, 110MB RAM

#### Cache (Redis)
- **Container**: `cache`
- **Função**: Cache distribuído para health status dos payment processors
- **Recursos**: 0.05 CPU, 20MB RAM

## Processamento assíncrono com fila in-memory

### Fila In-Memory

O sistema implementa uma fila FIFO simples e eficiente em memória:

```typescript
const queue: PaymentJob[] = [];

export function addPaymentJob(job: PaymentJob) {
  queue.push(job);
}
```

### Fluxo de Processamento

#### 1. **Recepção da Requisição**
- Cliente faz POST para `/payments` com o body:

```typescript
export interface PaymentRequest {
    correlationId: string;
    amount: number;
}
```
- Sistema responde imediatamente com `202 Accepted`
- Job é adicionado à fila para processamento assíncrono

#### 2. **Worker de Processamento**
```typescript
async function processQueue() {
  if (queue.length === 0) {
    setTimeout(processQueue, 500); // Polling a cada 500ms
    return;
  }

  const job = queue.shift(); // FIFO
  
  // Processamento do job...
  
  process.nextTick(processQueue); // Continuidade não-bloqueante
}
```

#### 3. **Ciclo de Vida do Pagamento**
1. **Pending**: Job criado na fila + registro no BD como 'pending'
2. **Final Status**: 
   - `processed` (sucesso)
   - `failed` (falha em ambos os processadores)

### Características da Fila

#### ✅ Vantagens: Zero overhead de rede ou serialização, implementação direta e fácil debug, baixa latência com resposta HTTP imediata (202)

#### ⚠️ Limitações: Jobs são perdidos em caso de restart, uma única instância por fila, não há retry de processamentos com falha

### Tolerância a Falhas

#### Estratégia de Fallback
- Tentativa com processor primário (baseado em health status)
- Em caso de falha, tentativa com processor secundário
- Dual-processor approach aumenta taxa de sucesso

#### Tratamento de Erros
```typescript
try {
  await createPendingPayment(job.correlationId, job.amountInCents, job.createdAt);
  const result = await processPayment(paymentData);
  // Atualização do status...
} catch (error) {
  console.error(`Error processing job for correlationId ${job.correlationId}:`, error);
  // Log e continue - cliente já recebeu 202
}
```

## Estratégia de Cache dos Health Status

O sistema implementa uma estratégia de cache para monitorar a saúde dos payment processors externos:

#### Cache Híbrido (Redis + Local)
```typescript
// Cache distribuído (Redis)
const CACHE_KEY = 'processor_health';
const LOCK_KEY = 'health_check_lock';

// Cache local por instância
let localHealthCache: CachedHealth = {
  default: { failing: false, minResponseTime: Infinity },
  fallback: { failing: false, minResponseTime: Infinity },
};
```

Ambas as instancias verificam o serviço externo de health-check dos payment processors a cada 5 segundos, respeitando o rate-limit. Para evitar race condition, utiliza-se um sistema de locks distribuídos, com TTL de 4 segundos (menor que o intervalo de checagem):

```typescript
async function updateHealthStatus() {
  const lockAcquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');

  if (lockAcquired) {
    const [defaultStatus, fallbackStatus] = await Promise.all([
      checkProcessorHealth(processorDefaultHost!),
      checkProcessorHealth(processorFallbackHost!),
    ]);

    const newHealth: CachedHealth = { default: defaultStatus, fallback: fallbackStatus };

    await redis.set(CACHE_KEY, JSON.stringify(newHealth));
    localHealthCache = newHealth;
  } else {
    const cachedHealth = await redis.get(CACHE_KEY);
    if (cachedHealth) {
      localHealthCache = JSON.parse(cachedHealth);
    }
  }
}
```

Então, a qualquer momento, uma das instancias vai "ganhar a corrida" e atualizar tanto o cache distribuido (Redis) como o cache local em memória. A instancia que perder o lock, vai simplesmente ler do Redis e também atualizar o cache local. No momento de decisão dos processor, ambas as instancias terão dados atualizados da saúde dos processors no cache local para fazer uma decisão informada.

## Estratégia de Seleção de Processor
1. **Prioridade por Disponibilidade**: Se apenas um dos processadores estiver disponível, será utilizado.
2. **Otimização por Performance**: Caso ambos estejam disponíveis, a escolha será baseada em tempo de resposta e threshold de lucro. Se o minResponseTime do default for 50% maior do que o do fallback, será utilizado o fallback. Essa taxa foi definida a partir de alguns testes locais.

```typescript
export function getBestProcessor(): 'default' | 'fallback' {
  // Regra 1: Evitar processadores falhando
  if (defaultHealth.failing && !fallbackHealth.failing) return 'fallback';
  if (!defaultHealth.failing && fallbackHealth.failing) return 'default';

  // Regra 2: Otimização por lucro
  const PROFIT_THRESHOLD = 1.5;
  if (defaultHealth.minResponseTime > fallbackHealth.minResponseTime * PROFIT_THRESHOLD) {
    return 'fallback';
  }

  return 'default';
}
```

## Como Executar

```bash
# Iniciar toda a infraestrutura
docker-compose up --build

# A aplicação estará disponível em:
# http://localhost:9999
```

## Endpoints

- `POST /payments` - Criação de pagamento (assíncrono)
- `GET /payments/summary` - Relatório de pagamentos processados
- `GET /health` - Health check da aplicação
- `GET /health/db` - Health check do banco de dados

## Variáveis de Ambiente

```env
APP_PORT=9999
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=rinha
POSTGRES_PASSWORD=rinha
POSTGRES_DB=rinha
REDIS_HOST=cache
REDIS_PORT=6379
PAYMENT_PROCESSOR_DEFAULT_HOST=http://payment-processor-default:8080
PAYMENT_PROCESSOR_FALLBACK_HOST=http://payment-processor-fallback:8080
```