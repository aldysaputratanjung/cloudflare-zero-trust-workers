# Cloudflare Zero Trust Workers

Kumpulan Worker untuk audit dan monitoring akses melalui Cloudflare Zero Trust Gateway.

## Repo Structure

```text
cloudflare-zero-trust-workers/
├── justifikasi-akses/    # Gateway Forward Worker
├── audit-dashboard/      # Web dashboard for audit trail
└── docs/               # Architecture & runbooks
```

## Workers

### 1. `justifikasi-akses`

Worker yang dipasang sebagai **Gateway Forward action** di Cloudflare Zero Trust.

**What it does:**
- Intercepts HTTP traffic to sensitive hosts.
- Shows an interstitial page asking the user for a justification reason.
- Writes `{user, host, reason, timestamp}` to a D1 database for audit.
- Skips subsequent challenges for 24 hours using KV.
- Continues the request normally after justification.

**Bindings / resources:**
- `SESSIONS` KV namespace — cached justification sessions
- `AUDIT` D1 database — audit trail records
- `SESSION_TTL_SECONDS` — configurable KV TTL
- `REASON_MAX_LENGTH` — max reason length

**Deploy:**
```bash
cd justifikasi-akses
npm install
npx wrangler d1 execute AUDIT --file schema.sql
npx wrangler deploy
```

Then create a Gateway HTTP policy with action **Forward** and select this Worker.

---

### 2. `audit-dashboard`

Worker that serves a dashboard reading the audit trail from the same D1 database.

**What it shows:**
- `user`, `host`, `reason`, `waktu (WIB)`
- Real-time auto-refresh, search, column sort, CSV export
- Mobile-responsive table / card view

**Bindings / resources:**
- `AUDIT` D1 database (same database as `justifikasi-akses`)

**Deploy:**
```bash
cd audit-dashboard
npm install
npx wrangler deploy
```

**Security note:** `audit-dashboard` is exposed on `workers.dev` by default. Protect it with Cloudflare Access or add a `DASHBOARD_PASSWORD` secret.

## Requirements

- Node.js + npm
- Wrangler CLI authenticated with a Cloudflare API token that has:
  - `Cloudflare Workers:Edit`
  - `Cloudflare D1:Edit`
  - `Cloudflare Gateway:Edit` (for creating the Forward policy)

## License

Private — for internal use.
