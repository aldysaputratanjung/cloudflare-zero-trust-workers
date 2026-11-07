export interface Env {
  AUDIT: D1Database;
  DASHBOARD_PASSWORD?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Optional simple password gate. For real deployments prefer Cloudflare Access.
    const authResp = checkAuth(request, env.DASHBOARD_PASSWORD);
    if (authResp) return authResp;

    if (url.pathname === "/api/audit") {
      return await apiAudit(request, env);
    }

    return new Response(dashboardHTML(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};

function checkAuth(request: Request, pwd?: string): Response | null {
  if (!pwd || pwd.length === 0) return null;
  const header = request.headers.get("Authorization") || "";
  const expected = "Basic " + btoa("audit:" + pwd);
  if (header === expected) return null;
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Justifikasi Akses"' },
  });
}

async function apiAudit(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 2000);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  let rows: any[] = [];
  let meta = null;
  try {
    const result = await env.AUDIT.prepare(
      "SELECT id, user, host, reason, ts FROM audit ORDER BY ts DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    rows = result.results as any[];
    meta = result.meta;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("D1 query failed", msg);
    return new Response(JSON.stringify({ error: "D1 query failed", message: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const withWIB = rows.map((r) => ({
    ...r,
    wib:
      r.ts != null
        ? new Date(r.ts).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }) + " WIB"
        : null,
  }));

  return new Response(JSON.stringify({ rows: withWIB, meta }), {
    headers: { "content-type": "application/json" },
  });
}

function dashboardHTML(): string {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Justifikasi Akses — Audit Trail</title>
  <style>
    :root {
      --bg-base: #EDF1F5;
      --surface: #FFFFFF;
      --ink: #1E2329;
      --muted: #5C636A;
      --rule: #C9D0D6;
      --accent: #B94E2E;
      --accent-light: #F3E7E3;
      --live: #2E6B54;
      --radius: 6px;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg-base);
      color: var(--ink);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    .wrap {
      max-width: 1160px;
      margin: 0 auto;
      padding: 40px 24px 64px;
    }
    header {
      margin-bottom: 28px;
    }
    .eyebrow {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.02em;
      margin: 0 0 6px;
      font-weight: 500;
    }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 400;
      font-size: 32px;
      line-height: 1.12;
      margin: 0 0 8px;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      max-width: 60ch;
      margin: 0;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      background: var(--surface);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      padding: 12px 14px;
    }
    .toolbar input[type="search"] {
      flex: 1 1 240px;
      min-width: 180px;
      padding: 8px 12px;
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      font: inherit;
      background: var(--bg-base);
      color: var(--ink);
    }
    .toolbar button {
      padding: 8px 14px;
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
    }
    .toolbar button:hover { border-color: var(--muted); }
    .toolbar button.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
    .toolbar button.primary:hover { background: #2a3036; }

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--rule);
      display: inline-block;
    }
    .live-dot.on { background: var(--live); }

    .status {
      font-size: 12px;
      color: var(--muted);
      margin-left: auto;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    thead th {
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid var(--rule);
      font-weight: 500;
      font-size: 12px;
      color: var(--muted);
      user-select: none;
      cursor: pointer;
      white-space: nowrap;
    }
    thead th:hover { color: var(--ink); }
    thead th .arrow { margin-left: 6px; color: var(--accent); opacity: 0; }
    thead th.sort .arrow { opacity: 1; }

    td {
      padding: 14px 16px;
      vertical-align: top;
      border-bottom: 1px solid #E2E6EA;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    td.reason {
      font-family: system-ui, sans-serif;
      min-width: 240px;
      max-width: 420px;
      word-break: break-word;
    }
    tr:last-child td { border-bottom: 0; }
    tr.recent td:first-child {
      border-left: 3px solid var(--accent);
      background: linear-gradient(90deg, var(--accent-light) 0, transparent 6px);
    }
    tr:hover td { background: #f8f9fa; }

    .empty, .error, .loading {
      padding: 48px 24px;
      text-align: center;
      color: var(--muted);
    }
    .error { color: var(--accent); }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--rule);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin .8s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    footer {
      margin-top: 18px;
      font-size: 12px;
      color: var(--muted);
    }

    @media (max-width: 760px) {
      h1 { font-size: 26px; }
      table, thead, tbody, tr, td, th { display: block; }
      thead { display: none; }
      tr { padding: 16px; border-bottom: 1px solid var(--rule); }
      td { padding: 6px 0; border: 0; }
      td::before {
        content: attr(data-label);
        display: block;
        font-size: 11px;
        color: var(--muted);
        font-family: system-ui, sans-serif;
        margin-bottom: 2px;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">AUDIT TRAIL</p>
      <h1>Justifikasi Akses</h1>
      <p class="subtitle">
        Daftar akses ke situs yang memerlukan alasan. Waktu ditampilkan dalam WIB (Asia/Jakarta).
      </p>
    </header>

    <div class="toolbar">
      <input type="search" id="filter" placeholder="Cari user, host, atau alasan..." autocomplete="off" />
      <button id="refreshBtn">Refresh</button>
      <button id="exportBtn" class="primary">Export CSV</button>
      <label class="toggle">
        <input type="checkbox" id="autoRefresh" checked />
        <span class="live-dot on" id="liveDot"></span>
        Auto-refresh
      </label>
      <div class="status" id="status">Memuat...</div>
    </div>

    <div class="card">
      <table id="auditTable">
        <thead>
          <tr>
            <th data-col="wib">Waktu (WIB) <span class="arrow">&#8595;</span></th>
            <th data-col="user">User <span class="arrow">&#8595;</span></th>
            <th data-col="host">Host <span class="arrow">&#8595;</span></th>
            <th data-col="reason">Alasan Akses <span class="arrow">&#8595;</span></th>
          </tr>
        </thead>
        <tbody id="tbody">
          <tr><td colspan="4" class="loading"><div class="spinner"></div>Memuat data audit...</td></tr>
        </tbody>
      </table>
    </div>

    <footer>
      Sumber: D1 <code>justifikasi-akses</code> · Refresh otomatis setiap 10 detik.
      Data primer dicatat oleh Worker Forward Gateway sebelum diteruskan ke upstream.
    </footer>
  </div>

  <script>
    (function () {
      const tbody = document.getElementById("tbody");
      const filterInput = document.getElementById("filter");
      const refreshBtn = document.getElementById("refreshBtn");
      const exportBtn = document.getElementById("exportBtn");
      const autoBox = document.getElementById("autoRefresh");
      const liveDot = document.getElementById("liveDot");
      const status = document.getElementById("status");
      let data = [];
      let sortCol = "wib";
      let sortAsc = false;
      let timer = null;

      const fmt = (n) => new Intl.NumberFormat("id-ID").format(n);

      async function load() {
        status.textContent = "Memuat...";
        try {
          const res = await fetch("./api/audit?limit=500");
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || "Fetch failed");
          data = json.rows || [];
          apply();
          status.textContent = "Diperbarui " + new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";
        } catch (err) {
          tbody.innerHTML = "<tr><td colspan=4 class=error>Gagal membaca audit. " + escapeHtml(String(err)) + "</td></tr>";
          status.textContent = "Gagal memuat";
        }
      }

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      }

      function sortData() {
        const dir = sortAsc ? 1 : -1;
        data.sort((a, b) => {
          if (sortCol === "wib") {
            return (a.ts - b.ts) * dir;
          }
          const va = String(a[sortCol]).toLowerCase();
          const vb = String(b[sortCol]).toLowerCase();
          return va.localeCompare(vb) * dir;
        });
      }

      function apply() {
        const q = filterInput.value.trim().toLowerCase();
        let filtered = data;
        if (q) {
          filtered = data.filter((r) =>
            [r.user, r.host, r.reason, r.wib].some((v) => String(v).toLowerCase().includes(q))
          );
        }
        sortData();

        if (filtered.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty">Tidak ada catatan.</td></tr>';
          return;
        }

        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const rows = filtered.map((r) => {
          const recent = now - r.ts < oneHour ? "recent" : "";
          return (
            '<tr class="' + recent + '">' +
            '<td data-label="Waktu">' + escapeHtml(r.wib || "-") + '</td>' +
            '<td data-label="User">' + escapeHtml(r.user) + '</td>' +
            '<td data-label="Host">' + escapeHtml(r.host) + '</td>' +
            '<td data-label="Alasan" class="reason">' + escapeHtml(r.reason) + '</td>' +
            "</tr>"
          );
        }).join("");
        tbody.innerHTML = rows;
      }

      function exportCSV() {
        let csv = "Waktu,WIB_Timestamp,User,Host,Alasan\\n";
        data.forEach((r) => {
          csv += [r.wib, r.ts, r.user, r.host, r.reason]
            .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
            .join(",") + "\\n";
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "audit-justifikasi-" + new Date().toISOString().slice(0, 10) + ".csv";
        a.click();
      }

      function schedule() {
        clearInterval(timer);
        liveDot.classList.toggle("on", autoBox.checked);
        if (autoBox.checked) {
          timer = setInterval(load, 10000);
        }
      }

      filterInput.addEventListener("input", apply);
      refreshBtn.addEventListener("click", load);
      exportBtn.addEventListener("click", exportCSV);
      autoBox.addEventListener("change", schedule);

      document.querySelectorAll("thead th").forEach((th) => {
        th.addEventListener("click", () => {
          const col = th.dataset.col;
          if (sortCol === col) {
            sortAsc = !sortAsc;
          } else {
            sortCol = col;
            sortAsc = col === "wib" ? false : true;
          }
          document.querySelectorAll("thead th").forEach((h) => h.classList.remove("sort"));
          th.classList.add("sort");
          th.querySelector(".arrow").innerHTML = sortAsc ? "&#8593;" : "&#8595;";
          apply();
        });
      });

      load();
      schedule();
    })();
  </script>
</body>
</html>`;
}
