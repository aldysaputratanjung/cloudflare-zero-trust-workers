/**
 * Logika murni "Justifikasi Akses" - dipisah agar bisa diuji tanpa runtime workerd.
 */

export const FORM_FIELD = "reason";
export const FORM_MARKER = "justification_submitted";

export interface JustificationDecision {
  action: "pass" | "form" | "submit";
}

export function decide(hasSession: boolean, method: string): JustificationDecision {
  if (hasSession) return { action: "pass" };
  if (method === "POST") return { action: "submit" };
  return { action: "form" };
}

export function validateReason(
  raw: unknown,
  maxLen: number,
): { ok: true; reason: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "Alasan akses wajib diisi." };
  }
  const reason = raw.trim();
  if (reason.length < 4) {
    return { ok: false, error: "Alasan terlalu singkat (min. 4 karakter)." };
  }
  if (reason.length > maxLen) {
    return { ok: false, error: `Alasan terlalu panjang (maks. ${maxLen} karakter).` };
  }
  return { ok: true, reason };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function formHtml(host: string, email: string, errorMessage?: string): string {
  const safeHost = escapeHtml(host);
  const safeEmail = escapeHtml(email);
  const errBlock = errorMessage
    ? `<div class="error">${escapeHtml(errorMessage)}</div>`
    : "";
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Justifikasi Akses - ${safeHost}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:system-ui,sans-serif;background:#111827;color:#f3f4f6;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1f2937;padding:2rem;border-radius:12px;max-width:520px;width:92%}
  h2{margin-top:0} .muted{color:#9ca3af;font-size:.9rem}
  textarea{width:100%;min-height:90px;border-radius:8px;border:1px solid #374151;
           background:#111827;color:#f3f4f6;padding:.6rem;font:inherit;margin:.8rem 0}
  button{background:#f97316;border:0;color:#111827;font-weight:600;
         padding:.65rem 1.4rem;border-radius:8px;cursor:pointer}
  .error{background:#7f1d1d;padding:.6rem;border-radius:8px;margin-bottom:.8rem}
</style></head><body>
<div class="card">
  <h2>Akses ke ${safeHost}</h2>
  <p class="muted">Halo <strong>${safeEmail}</strong>, akses ke situs ini dicatat untuk keperluan audit.
  Sebelum melanjutkan, jelaskan tujuan Anda. Anda tidak akan diminta lagi selama sesi berlaku.</p>
  ${errBlock}
  <form method="POST">
    <input type="hidden" name="${FORM_MARKER}" value="1">
    <label for="reason">Alasan akses:</label>
    <textarea id="reason" name="${FORM_FIELD}" required
      placeholder="Contoh: mengirim slip gaji karyawan via email pribadi"></textarea>
    <button type="submit">Lanjutkan akses</button>
  </form>
</div>
</body></html>`;
}

export function isJustificationSubmission(form: FormData): boolean {
  return form.get(FORM_MARKER) === "1";
}
