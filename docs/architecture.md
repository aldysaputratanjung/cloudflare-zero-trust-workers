# Architecture

```text
User (WARP/Zero Trust)
        |
        v
Cloudflare Gateway (HTTP policy Forward)
        |
        v
Worker: justifikasi-akses (interstitial + audit write)
        |
        v
D1 AUDIT  +  KV SESSIONS
        ^
        |
Worker: audit-dashboard (read D1 + render HTML)
        |
        v
Browser dashboard
```

- `justifikasi-akses` writes audit records and manages KV sessions.
- `audit-dashboard` reads the same D1 table and renders a real-time dashboard.
- Both Workers use the same `AUDIT` D1 database binding.
