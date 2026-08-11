# Webhook Delivery Service

Serviço de entrega de webhooks: recebe um evento, um destino e um secret, e garante que o
evento chega ao destino com assinatura HMAC, retry com backoff exponencial, dead letter queue e
histórico auditável de cada tentativa.

Especificação completa em [docs/spec.md](docs/spec.md).

## Stack

- NestJS (monorepo com dois apps: `api` e `worker`)
- PostgreSQL
- SQS (ElasticMQ como emulador local)
- ECS Fargate + Terraform (ainda não implementado)

## Estado atual

Em construção. Hoje existe a configuração tipada e validada no boot (`apps/api/src/config`) e o
ambiente local com Docker. As rotas da API, a persistência e o worker ainda não existem.

## Requisitos

- Node.js 20+
- Docker Desktop

## Ambiente local

O `docker-compose.yml` sobe dois serviços:

| Serviço | Imagem | Porta | Função |
|---|---|---|---|
| `db` | `postgres:17` | 5432 | Banco de dados |
| `mq` | `softwaremill/elasticmq-native:1.7.1` | 9324 | Emulador de SQS |

A aplicação roda fora do compose, direto na máquina, e alcança os dois por `localhost`.

As filas `webhook-delivery` e `webhook-delivery-dlq` são declaradas em
[elasticmq.conf](elasticmq.conf) e criadas no boot do container. Não há comando manual de
criação de fila.

### Subir do zero

```bash
cp .env.example .env
npm install
docker compose up -d --wait
```

O `--wait` só retorna quando os healthchecks dos dois containers passam. Sem ele o comando volta
antes de o Postgres aceitar conexão.

### Rodar a aplicação

```bash
npm run start:dev
```

O script `prestart:dev` executa `docker compose up -d --wait` antes de subir o Nest, então não é
preciso lembrar de ligar os containers. O comando é idempotente: se já estiverem no ar, retorna
imediatamente.

### Comandos úteis

```bash
docker compose ps                  # estado dos containers (deve mostrar "Up (healthy)")
docker compose logs -f db          # logs de um serviço
docker compose down                # derruba os containers, preserva os dados
docker compose down -v             # derruba tudo e APAGA o volume do Postgres
```

Use `down -v` quando o banco ficar sujo ou quando mudar `POSTGRES_USER`, `POSTGRES_PASSWORD` ou
`POSTGRES_DB`. Essas três variáveis só têm efeito na primeira inicialização, com o volume vazio.
Alterá-las sem apagar o volume não muda nada e gera erro de autenticação.

### Verificar o ambiente

```bash
# filas criadas
curl "http://localhost:9324/?Action=ListQueues"

# conexão com o banco
docker compose exec db psql -U webhook -d webhook_delivery -c "\conninfo"
```

O `ListQueues` deve retornar as duas filas. No PowerShell use `curl.exe`, porque `curl` é alias
de `Invoke-WebRequest`.

## Configuração

Todas as variáveis são validadas no boot contra um schema zod
([env.schema.ts](apps/api/src/config/env.schema.ts)). A aplicação não sobe se qualquer uma
estiver ausente ou malformada.

| Variável | Descrição |
|---|---|
| `NODE_ENV` | `development`, `production` ou `test` |
| `PORT` | Porta HTTP da API |
| `DATABASE_URL` | String de conexão do Postgres |
| `API_KEY` | Chave esperada no header `X-Api-Key` |
| `SQS_QUEUE_URL` | URL da fila de entregas |
| `AWS_REGION` | Região da AWS |
| `DB_POOL_SIZE` | Tamanho do pool de conexões |
| `LOG_LEVEL` | Nível de log |

As variáveis `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` não são lidas pela aplicação.
São consumidas pelo `docker-compose.yml` para inicializar o container do banco, e precisam ser
coerentes com o `DATABASE_URL`.

## Estrutura

```
apps/api/         API HTTP: ingestão de mensagens e consultas
apps/worker/      Worker de entrega (consome da fila)
libs/shared/      Código compartilhado entre os dois apps
docs/spec.md      Especificação do projeto
elasticmq.conf    Declaração das filas do emulador local
```

## Testes

```bash
npm test           # unitários
npm run test:e2e   # end to end
```
