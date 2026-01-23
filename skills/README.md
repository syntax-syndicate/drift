# Drift Skills

Production-ready Agent Skills for building enterprise SaaS applications.

## What are Agent Skills?

Agent Skills are folders of instructions, scripts, and resources that AI agents (GitHub Copilot, Claude, etc.) can load to perform specialized tasks. They follow the [Agent Skills open standard](https://agentskills.io).

## Available Skills (75)

### 🏗️ Foundations
| Skill | Description | Time |
|-------|-------------|------|
| [environment-config](./environment-config/) | Centralized env var management with validation | ~2h |
| [typescript-strict](./typescript-strict/) | Strict TypeScript with branded types and Result patterns | ~1h |
| [monorepo-structure](./monorepo-structure/) | Turborepo + pnpm workspace setup | ~2h |
| [feature-flags](./feature-flags/) | Feature flag system for safe rollouts | ~4h |

### 🔐 Auth & Security
| Skill | Description | Time |
|-------|-------------|------|
| [supabase-auth](./supabase-auth/) | Supabase authentication with SSR support | ~4h |
| [jwt-auth](./jwt-auth/) | JWT authentication with refresh tokens | ~4h |
| [middleware-protection](./middleware-protection/) | Route protection with Next.js middleware | ~2h |
| [tier-entitlements](./tier-entitlements/) | Subscription tier-based feature gating | ~3h |
| [row-level-security](./row-level-security/) | PostgreSQL RLS for multi-tenant apps | ~4h |
| [oauth-social-login](./oauth-social-login/) | Google/GitHub OAuth integration | ~6h |
| [webhook-security](./webhook-security/) | Secure webhook signature verification | ~3h |
| [audit-logging](./audit-logging/) | Compliance-ready audit trails | ~4h |
| [error-sanitization](./error-sanitization/) | Production-safe error handling without info leakage | ~2h |
| [file-uploads](./file-uploads/) | Secure uploads with malware scanning and deduplication | ~6h |

### 🛡️ Resilience
| Skill | Description | Time |
|-------|-------------|------|
| [circuit-breaker](./circuit-breaker/) | Prevent cascade failures with circuit breaker pattern | ~4h |
| [retry-fallback](./retry-fallback/) | Exponential backoff with graceful fallbacks | ~2h |
| [graceful-degradation](./graceful-degradation/) | Keep systems running when dependencies fail | ~3h |
| [graceful-shutdown](./graceful-shutdown/) | Clean shutdown with job tracking and buffer draining | ~3h |
| [backpressure](./backpressure/) | Bounded buffers and adaptive flushing | ~4h |
| [distributed-lock](./distributed-lock/) | Prevent race conditions across instances | ~3h |
| [leader-election](./leader-election/) | Single leader with automatic failover | ~4h |
| [resilient-storage](./resilient-storage/) | Multi-backend storage with automatic failover | ~6h |

### ⚙️ Workers & Background
| Skill | Description | Time |
|-------|-------------|------|
| [background-jobs](./background-jobs/) | Robust background job processing | ~4h |
| [dead-letter-queue](./dead-letter-queue/) | Store failed jobs for replay | ~3h |
| [job-state-machine](./job-state-machine/) | Validated state transitions for async jobs | ~4h |
| [worker-orchestration](./worker-orchestration/) | Coordinate multiple background workers | ~4h |

### 🔌 API
| Skill | Description | Time |
|-------|-------------|------|
| [rate-limiting](./rate-limiting/) | Subscription-aware API rate limiting | ~4h |
| [idempotency](./idempotency/) | Safe retry handling for critical operations | ~4h |
| [api-versioning](./api-versioning/) | Backward-compatible API evolution | ~3h |
| [pagination](./pagination/) | Cursor-based pagination for large datasets | ~2h |
| [request-validation](./request-validation/) | Schema validation with Zod/Pydantic | ~2h |
| [api-client](./api-client/) | Typed API client with auto token refresh | ~5h |
| [data-transformers](./data-transformers/) | Centralized data transformation logic | ~2h |

### 🚨 Errors
| Skill | Description | Time |
|-------|-------------|------|
| [error-handling](./error-handling/) | Consistent error responses and logging | ~3h |
| [exception-taxonomy](./exception-taxonomy/) | Hierarchical exceptions with error codes | ~3h |

### 📊 Data Pipeline
| Skill | Description | Time |
|-------|-------------|------|
| [batch-processing](./batch-processing/) | Collect-then-batch for 30-40% throughput gains | ~4h |
| [checkpoint-resume](./checkpoint-resume/) | Exactly-once processing with distributed coordination | ~4h |
| [deduplication](./deduplication/) | Content-based deduplication with reputation scoring | ~4h |
| [validation-quarantine](./validation-quarantine/) | Quality scoring and quarantine for suspicious data | ~4h |
| [geographic-clustering](./geographic-clustering/) | O(n) grid-based clustering with risk scoring | ~5h |
| [snapshot-aggregation](./snapshot-aggregation/) | Daily compression with merge logic | ~4h |
| [analytics-pipeline](./analytics-pipeline/) | Redis counters with periodic PostgreSQL flush | ~6h |
| [community-feed](./community-feed/) | Social feed with trending algorithms and pagination | ~6h |
| [fuzzy-matching](./fuzzy-matching/) | Multi-stage fuzzy matching for entity reconciliation | ~6h |
| [scoring-engine](./scoring-engine/) | Statistical scoring with percentiles and decay | ~6h |

### 💳 Integrations
| Skill | Description | Time |
|-------|-------------|------|
| [stripe-integration](./stripe-integration/) | Complete Stripe payments integration | ~6h |
| [email-service](./email-service/) | Transactional email with templates | ~4h |
| [ai-generation-client](./ai-generation-client/) | AI API integration with retry and content safety | ~6h |

### 🤖 AI
| Skill | Description | Time |
|-------|-------------|------|
| [prompt-engine](./prompt-engine/) | Template-based prompt building with brand injection | ~5h |
| [ai-coaching](./ai-coaching/) | Multi-turn conversational AI for intent extraction | ~8h |
| [provenance-audit](./provenance-audit/) | AI generation audit trails with decision factors | ~8h |

### 🚀 Performance
| Skill | Description | Time |
|-------|-------------|------|
| [caching-strategies](./caching-strategies/) | Multi-layer caching with Redis | ~4h |

### 🗄️ Database
| Skill | Description | Time |
|-------|-------------|------|
| [database-migrations](./database-migrations/) | Zero-downtime schema changes | ~3h |
| [soft-delete](./soft-delete/) | Recoverable deletion with audit trails | ~2h |

### 📡 Realtime
| Skill | Description | Time |
|-------|-------------|------|
| [sse-streaming](./sse-streaming/) | Server-sent events for real-time updates | ~3h |
| [sse-resilience](./sse-resilience/) | Redis-backed SSE with heartbeat and recovery | ~7h |
| [websocket-management](./websocket-management/) | Production WebSocket connection management | ~4h |
| [atomic-matchmaking](./atomic-matchmaking/) | Two-phase commit matchmaking with graceful disconnection handling | ~6h |
| [server-tick](./server-tick/) | Server-authoritative tick system with lag compensation | ~8h |

### 🏢 Architecture
| Skill | Description | Time |
|-------|-------------|------|
| [multi-tenancy](./multi-tenancy/) | Multi-tenant SaaS architecture | ~6h |

### 🔧 Operations
| Skill | Description | Time |
|-------|-------------|------|
| [health-checks](./health-checks/) | Kubernetes-ready health endpoints | ~2h |
| [worker-health-monitoring](./worker-health-monitoring/) | Heartbeat-based worker health with failure rate tracking | ~5h |
| [anomaly-detection](./anomaly-detection/) | Rule-based anomaly detection with cooldowns | ~5h |
| [logging-observability](./logging-observability/) | Structured logging with correlation IDs | ~4h |
| [metrics-collection](./metrics-collection/) | Prometheus-compatible metrics collection | ~3h |

### 🎨 Frontend
| Skill | Description | Time |
|-------|-------------|------|
| [design-tokens](./design-tokens/) | WCAG-compliant design token system | ~4h |
| [pwa-setup](./pwa-setup/) | Progressive Web App configuration | ~2h |
| [game-loop](./game-loop/) | Fixed timestep game loop with interpolation | ~4h |
| [mobile-components](./mobile-components/) | Touch-optimized mobile UI components | ~3h |

### 🚀 Performance
| Skill | Description | Time |
|-------|-------------|------|
| [intelligent-cache](./intelligent-cache/) | Type-specific TTLs with get-or-generate pattern | ~5h |

### ☁️ Infrastructure
| Skill | Description | Time |
|-------|-------------|------|
| [cloud-storage](./cloud-storage/) | Cloud storage with signed URLs and multi-tenant isolation | ~4h |

## Installation

### Option 1: Drift CLI (Recommended)

```bash
# Install a single skill
drift skills install circuit-breaker

# Install multiple skills
drift skills install circuit-breaker rate-limiting stripe-integration

# List available skills
drift skills list

# Search skills
drift skills search auth

# Get skill details
drift skills info jwt-auth
```

### Option 2: Manual Copy

Copy the skill folder to your project's `.github/skills/` directory:

```bash
cp -r drift/skills/circuit-breaker .github/skills/
```

## Usage

Once installed, skills are automatically discovered by compatible agents:

- **GitHub Copilot**: Skills in `.github/skills/` are loaded when relevant
- **Claude Code**: Register as a plugin marketplace
- **VS Code**: Works with Copilot agent mode

Just ask naturally:
- "Add circuit breaker to my API client"
- "Implement rate limiting for my endpoints"
- "Set up Stripe subscription billing"
- "Add OAuth login with Google"
- "Implement cursor pagination for my list endpoints"

## Creating Custom Skills

Use the template:

```bash
cp -r drift/skills/_template drift/skills/my-skill
```

Then edit `SKILL.md` with your instructions.

## Philosophy

- **Real Code > Theory**: Every skill includes working code from production
- **Minimal Dependencies**: Prefer stdlib and simple abstractions
- **Production-First**: Error handling, edge cases, observability built-in
- **48-Hour Rule**: Each skill should be implementable in under 48 hours

## License

MIT - Use these skills freely in your projects.
