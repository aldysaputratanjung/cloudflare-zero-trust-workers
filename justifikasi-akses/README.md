# justifikasi-akses

Gateway Forward Worker for access justification.

## Config

Set the binding IDs in `wrangler.jsonc`:
- KV namespace `SESSIONS`
- D1 database `AUDIT`

## Schema

```bash
npx wrangler d1 execute AUDIT --file schema.sql
```

## Deploy

```bash
npm install
npx wrangler deploy
```

## Gateway Policy

Create a Zero Trust HTTP policy with action `Forward` and select this Worker.
