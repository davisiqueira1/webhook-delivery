# Webhook Delivery Service Specification

## 1. What It Is

An infrastructure service that reliably delivers webhooks on behalf of third parties.

It knows nothing about anyone's business domain. It receives an event, a destination and a
secret, then guarantees that the event reaches that destination, with signing, retries,
exponential backoff, a dead letter queue and an auditable history of every attempt.

This is the product category of Svix, Hookdeck and Convoy.

### The Three Roles

| Role | Who it is | Relationship to the service |
|---|---|---|
| Producer | A payment gateway, for example | The customer of the service. Sends events through the API. |
| Deliverer | This project | Guarantees delivery. |
| Consumer | A store that is a customer of the gateway | Receives the `POST`. Does not know the service exists. |

A concrete example: the gateway approved payment for order `A-1002` belonging to StoreX. It
calls this service saying "notify StoreX", receives `202` within milliseconds and moves on. The
service takes over the dirty work of making the `POST` arrive at
`https://api.storex.com/webhooks`, however many attempts that takes. As far as StoreX is
concerned, the webhook arrives signed as coming from the gateway.

### Learning Objective

The business domain is deliberately trivial. The complexity, and the value, lives in the
architecture: guaranteed delivery, idempotency, backoff, dead letter queue, independent scaling
between API and worker, observability, and infrastructure declared entirely in Terraform.

---

## 2. Scope

- Registration of `Applications` and `Endpoints`, including generation of a signing secret
- Message ingestion with an immediate `202 Accepted` response
- Ingestion idempotency through the `Idempotency-Key` header
- Fan out: one message produces one delivery for each active endpoint of the application
- Asynchronous delivery by a decoupled worker consuming from SQS
- HMAC-SHA256 signing with replay protection
- Automatic retry with exponential backoff and jitter, up to five attempts
- Dead letter queue once attempts are exhausted
- Queryable history of every attempt
- SSRF protection when validating destination URLs
- Worker autoscaling driven by queue depth
- All infrastructure in Terraform, with clean `apply` and `destroy`
- Test receiver with programmable behaviors
- End to end test running against the real AWS environment

---

## 3. Architecture

```text
                          ┌────────────────────────────────────────┐
                          │  VPC                                   │
   Producer               │                                        │
      │                   │   public subnets                       │
      │ POST /messages    │   ┌──────────────┐      ┌────────────┐ │
      └──────────────────────▶│     ALB      │      │    NAT     │ │
                          │   └──────┬───────┘      └─────┬──────┘ │
        ◀─── 202 ──────────────────  │                    │        │
                          │   private subnets             │        │
                          │   ┌──────▼───────┐            │        │
                          │   │ ECS Fargate  │            │        │
                          │   │     API      │            │        │
                          │   └──┬────────┬──┘            │        │
                          │      │        │               │        │
                          │      ▼        ▼               │        │
                          │  ┌───────┐ ┌──────────┐       │        │
                          │  │  RDS  │ │   SQS    │       │        │
                          │  │  PG   │ │ delivery │       │        │
                          │  └───▲───┘ └────┬─────┘       │        │
                          │      │          │             │        │
                          │   ┌──┴──────────▼───┐         │        │
                          │   │  ECS Fargate    │─────────┘        │
                          │   │     Worker      │                  │
                          │   │  (autoscaling)  │                  │
                          │   └────────┬────────┘                  │
                          │            │ 5 failures                │
                          │        ┌───▼───┐                       │
                          │        │  DLQ  │                       │
                          │        └───────┘                       │
                          └────────────────────────────────────────┘
                                       │
                                       ▼  signed POST
                              Consumer (customer endpoint)
```

Two ECS services scale independently. The API scales by request volume while the worker scales
by queue depth, because they carry different kinds of load.

---

## 4. Data Model (PostgreSQL)

```sql
applications
  id                uuid        PK
  name              text        NOT NULL
  created_at        timestamptz NOT NULL

endpoints
  id                uuid        PK
  application_id    uuid        FK -> applications
  url               text        NOT NULL         -- https:// required
  secret            text        NOT NULL         -- shown only at creation
  is_active         boolean     NOT NULL DEFAULT true
  created_at        timestamptz NOT NULL

messages
  id                uuid        PK
  application_id    uuid        FK -> applications
  event_type        text        NOT NULL
  payload           jsonb       NOT NULL
  idempotency_key   text        NULL
  created_at        timestamptz NOT NULL
  UNIQUE (application_id, idempotency_key)

deliveries                                        -- one (message, endpoint) pair
  id                uuid        PK
  message_id        uuid        FK -> messages
  endpoint_id       uuid        FK -> endpoints
  status            text        NOT NULL          -- pending|delivering|delivered|failed
  attempt_count     int         NOT NULL DEFAULT 0
  completed_at      timestamptz NULL
  UNIQUE (message_id, endpoint_id)

delivery_attempts
  id                uuid        PK
  delivery_id       uuid        FK -> deliveries
  attempt_number    int         NOT NULL
  status_code       int         NULL              -- null when no response arrived
  error             text        NULL              -- ECONNREFUSED, ETIMEDOUT, ...
  duration_ms       int         NOT NULL
  attempted_at      timestamptz NOT NULL
```

### Why `deliveries` Exists

A single message can target several endpoints, and each destination has its own lifecycle. One
may succeed on the first attempt while another lands in the dead letter queue. Without this
table, `attempt_number` would be ambiguous about which destination it refers to. Message status
is derived from its deliveries: `delivered` when all of them succeeded, `partial` when results
are mixed, and `failed` when all of them failed.

---

## 5. API

Authentication uses an `X-Api-Key` header on every route, compared against a single value read
from Secrets Manager.

### `POST /applications`

```json
// request
{ "name": "StoreX" }

// 201
{ "id": "app_...", "name": "StoreX", "createdAt": "2026-08-04T10:00:00Z" }
```

### `POST /applications/:applicationId/endpoints`

```json
// request
{ "url": "https://api.storex.com/webhooks" }

// 201  the secret appears ONLY here
{
  "id": "ep_...",
  "url": "https://api.storex.com/webhooks",
  "secret": "whsec_A7f3k9...",
  "isActive": true
}
```

Errors: `400` when the URL is invalid, is not `https`, or resolves to a private IP range as
described in section 8.

### `GET /applications/:applicationId/endpoints`

Lists endpoints. The `secret` is never returned.

### `POST /applications/:applicationId/messages`

```json
// request                          optional header: Idempotency-Key: pay_9981
{
  "eventType": "payment.approved",
  "payload": { "orderId": "A-1002", "amount": 149.90 }
}

// 202
{
  "messageId": "msg_...",
  "status": "pending",
  "deliveries": [ { "id": "dlv_...", "endpointId": "ep_...", "status": "pending" } ]
}
```

The rule is that this route responds within milliseconds. The API never performs the delivery
`POST` itself. It persists the message and enqueues the work.

Resending with the same `Idempotency-Key` returns `202` with the same `messageId` and does not
enqueue anything again.

### `GET /messages/:messageId`

```json
{
  "id": "msg_...",
  "eventType": "payment.approved",
  "status": "delivered",
  "createdAt": "...",
  "deliveries": [
    { "id": "dlv_...", "endpointId": "ep_...", "status": "delivered", "attemptCount": 3 }
  ]
}
```

### `GET /messages/:messageId/attempts`

```json
[
  { "deliveryId": "dlv_...", "attempt": 1, "at": "10:00:00", "error": "ECONNREFUSED", "durationMs": 1203 },
  { "deliveryId": "dlv_...", "attempt": 2, "at": "10:00:34", "statusCode": 500,        "durationMs": 890  },
  { "deliveryId": "dlv_...", "attempt": 3, "at": "10:02:41", "statusCode": 200,        "durationMs": 340  }
]
```

### `GET /health` and `GET /health/ready`

`/health` always responds and serves as the liveness probe. `/health/ready` checks the database
and the queue, and is the target of the target group health check.

---

## 6. Signing

Headers sent to the consumer:

```http
webhook-id: dlv_7f3a9c...
webhook-timestamp: 1785000000
webhook-signature: v1,3xR9kP2mQ8...
```

The signed content is `{webhook-id}.{webhook-timestamp}.{raw-body}`, using `HMAC-SHA256` with
the endpoint secret, encoded as base64.

The consumer recalculates the signature and compares it in constant time. The timestamp is part
of the signed content so that a captured legitimate webhook cannot be replayed later. Consumers
are advised to reject timestamps older than five minutes.

The `v1,` prefix exists so the algorithm can change in the future without breaking existing
integrations.

---

## 7. Delivery and Retry

### Cycle

1. The worker receives `{ deliveryId }` from SQS
2. It loads the delivery, the message and the endpoint
3. It validates the destination against SSRF rules from section 8, because DNS may have changed
   since registration
4. It builds the headers, signs the payload and issues the `POST` with a 10 second timeout
5. It records a row in `delivery_attempts` in every case, success or failure
6. It decides:
   - Any `2xx` means the delivery becomes `delivered` and the message is removed from the queue
   - Anything else triggers `ChangeMessageVisibility` with the calculated backoff

### Policy

| Parameter | Value |
|---|---|
| Maximum attempts | 5 (`maxReceiveCount = 5` in the redrive policy) |
| Queue default visibility timeout | 60s |
| HTTP timeout per attempt | 10s |
| Success condition | any `2xx` |

Base backoff between attempts, with equal jitter applied as
`delay = base/2 + random(0, base/2)`:

| After attempt | Base | Actual range |
|---|---|---|
| 1st | 30s | 15s to 30s |
| 2nd | 2min | 1min to 2min |
| 3rd | 8min | 4min to 8min |
| 4th | 32min | 16min to 32min |
| 5th | none | moves to the dead letter queue |

Jitter prevents a thousand messages queued for the same failing endpoint from returning at the
same instant and knocking over a service that was in the middle of recovering.

### Why `ChangeMessageVisibility` Instead of a Scheduler

No scheduling code is written. On failure the worker hides the message for the duration of the
backoff and SQS returns it at the right moment on its own. The attempt counter comes for free
through `ApproximateReceiveCount`, and the redrive policy moves the message to the dead letter
queue automatically on the fifth receive.

There is a constraint to respect: the visibility timeout must be longer than the processing
time. With a 10 second HTTP timeout, the 60 second default leaves comfortable headroom. If that
relationship is violated, SQS redelivers the message while the worker is still processing it and
the consumer receives a duplicate webhook.

### Guarantee

Delivery is at-least-once. Duplicates are possible and are a characteristic of the system rather
than a defect. For that reason the signature carries a stable `webhook-id` and consumers are
expected to deduplicate on it. This is documented as part of the public API contract.

---

## 8. Security

### SSRF, the Central Threat

The customer supplies an arbitrary URL and the service issues a `POST` to it from inside the
VPC. With no defense, someone points it at `http://169.254.169.254/` and reads the IAM
credentials of the task.

Validation is mandatory both at registration time and again before every delivery, because DNS
can change between those two moments through DNS rebinding:

- Only the `https` scheme is accepted
- Only port `443` is accepted
- The hostname is resolved and rejected if any resolved IP falls within
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`,
  `169.254.0.0/16`, `0.0.0.0/8`, `::1`, `fc00::/7`, `fe80::/10`
- Redirects are not followed (`maxRedirects: 0`), since a `302` pointing at an internal IP would
  bypass the entire validation

Infrastructure reinforces this: the worker task role carries minimal permissions, and Fargate
tasks already use IMDSv2 with a restricted hop limit. Application level defense still comes
first.

### Other Controls

- The endpoint `secret` is returned exactly once, at creation time
- RDS credentials and the API key live in Secrets Manager and are injected through the `secrets`
  block of the task definition, never as literal environment variables in Terraform
- Signature comparison uses `crypto.timingSafeEqual` for constant time behavior
- The consumer response body is not stored, only the status code and error, which avoids
  retaining third party data without need
- Security groups are chained by reference: ALB to API, API and worker to RDS. No inbound
  `0.0.0.0/0` exists anywhere except on the ALB

---

## 9. Infrastructure

### Terraform Modules

```text
infra/
├── bootstrap/              tfstate bucket (applied once, with local state)
├── modules/
│   ├── network/            VPC, 2 AZs, public and private subnets, IGW, 1 NAT, routes
│   ├── alb/                ALB, listener, target group, health check
│   ├── ecs-cluster/        cluster, capacity providers, execution role
│   ├── ecs-service/        reusable module, instantiated twice
│   ├── rds/                PostgreSQL, subnet group, parameter group
│   ├── queue/              main queue, DLQ, redrive policy
│   └── observability/      log groups, alarms, dashboard
└── envs/dev/               module composition, backend and variables
```

The `ecs-service` module is parameterized and used twice:

| Instance | ALB | Autoscaling | Command |
|---|---|---|---|
| `api` | yes, with target group | by CPU (min 1, max 3) | `node dist/apps/api/main.js` |
| `worker` | no | by queue backlog (min 1, max 6) | `node dist/apps/worker/main.js` |

### One Image, Two Commands

A multi stage Dockerfile compiles both applications and produces a single image in ECR. Both
task definitions point at that same image and differ only in the `command` field.

The reason is one build and one push, and more importantly that API and worker can never end up
running different versions. Separate images would allow a partial deploy in which the worker
consumes a message format the API no longer produces.

### Worker Autoscaling

Target tracking runs against a calculated backlog per task metric:

```text
ApproximateNumberOfMessagesVisible / RunningTaskCount
```

The target is roughly 30 messages per task. Scaling by CPU would be wrong here, because the
worker spends most of its time blocked on network I/O with CPU near zero even while the queue is
full.

### Terraform State

An S3 backend with versioning and `use_lockfile = true`, which uses native locking through S3
conditional writes and requires no DynamoDB table. The bucket is created by `infra/bootstrap/`,
applied once with local state and committed.

---

## 10. Observability

### Logs

Structured JSON, one event per line, with mandatory correlation fields on every worker line:
`applicationId`, `messageId`, `deliveryId` and `attemptNumber`. Without them, investigating a
delivery that failed four times across forty minutes is impractical.

### Alarms

| Alarm | Condition | What it indicates |
|---|---|---|
| DLQ not empty | `ApproximateNumberOfMessagesVisible > 0` | Deliveries gave up |
| Queue aging | `ApproximateAgeOfOldestMessage > 5min` | Worker cannot keep up or is stuck |
| ALB 5xx | `HTTPCode_Target_5XX_Count > 0` | API is failing |
| RDS connections | `DatabaseConnections > 70` | Connection pool exhausting under scale |
| Worker has no task | `RunningTaskCount = 0` for 2min | Service is down |

The RDS connection alarm is not decorative. A `db.t4g.micro` accepts roughly 85 connections,
while six worker tasks with a pool of 20 would request 120. The pool size per task must be sized
against the maximum task count rather than the normal one, and that calculation belongs in the
README.

### Dashboard

A single panel showing ingestion rate, queue depth, worker task count, delivery latency at p50
and p95, success rate by attempt number, and dead letter queue size.

---

## 11. Test Receiver

A Lambda with a Function URL, which gives a public HTTPS endpoint with no ALB at negligible
cost. It represents a third party the service does not control, so it is deliberately simple and
does not use NestJS.

| Route | Behavior | What it exercises |
|---|---|---|
| `/ok` | always `200` | happy path |
| `/fail` | always `500` | attempt exhaustion into the dead letter queue |
| `/flaky` | fails 3 times, then `200` | backoff and recovery |
| `/slow` | sleeps 40s | worker HTTP timeout |
| `/bad-sig` | validates the signature and logs the result | HMAC correctness |

The same file runs as a local HTTP server through `docker-compose` for day to day development.

---

## 12. Configuration

| Variable | Source | Example |
|---|---|---|
| `NODE_ENV` | env | `production` |
| `PORT` | env (API only) | `3000` |
| `DATABASE_URL` | Secrets Manager | |
| `API_KEY` | Secrets Manager | |
| `SQS_QUEUE_URL` | env | |
| `AWS_REGION` | env | `us-east-1` |
| `DELIVERY_TIMEOUT_MS` | env | `10000` |
| `DB_POOL_SIZE` | env | `10` |
| `WORKER_CONCURRENCY` | env | `10` |
| `LOG_LEVEL` | env | `info` |

All variables are validated at startup against a typed schema. The application fails to boot if
any of them is missing, rather than discovering the problem in the middle of the night.

---

## 13. Definition of Done

The project is complete when, starting from nothing:

1. `terraform apply` in `infra/envs/dev` brings up the entire stack with no manual intervention
2. The deploy script builds, pushes to ECR and updates both services
3. The end to end test passes against the real AWS environment:
   - Creates an application and an endpoint pointing at `/flaky`
   - Sends a message and receives `202`
   - Waits and confirms `delivered` with four recorded attempts
   - Repeats against `/fail` and confirms the message reaches the dead letter queue after the
     fifth attempt
   - Resends with the same `Idempotency-Key` and confirms nothing was duplicated
   - Attempts to register `https://169.254.169.254/` and confirms a `400` rejection
4. A load test with 5,000 messages shows the worker scaling from 1 to N tasks and returning to 1
   after draining
5. `terraform destroy` removes everything with no orphaned resources
6. The README documents the architecture, the decisions taken and how to bring the stack up from
   scratch

The criteria are about infrastructure and behavior rather than features, which is what keeps
focus where the learning is.
