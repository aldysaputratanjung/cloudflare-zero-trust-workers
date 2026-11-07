/**
 * Worker "Justifikasi Akses" untuk Gateway Forward action (public beta).
 * Kontrak: class GatewayMiddleware extends WorkerEntrypoint; handle(request, context, next);
 * next() maks 1x; identitas dari context.identity(); fail-closed.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import type {
  GatewayMiddlewareContext,
  GatewayMiddlewareNext,
} from "@cloudflare/zt-types";
import {
  formHtml,
  isJustificationSubmission,
  validateReason,
} from "./logic.js";

interface Env {
  SESSIONS: KVNamespace;
  AUDIT: D1Database;
  SESSION_TTL_SECONDS: string;
  REASON_MAX_LENGTH: string;
}

const DEFAULT_TTL = 86400;
const HTML = { headers: { "content-type": "text/html; charset=utf-8" } };

export class GatewayMiddleware extends WorkerEntrypoint<Env> {
  async handle(
    request: Request,
    context: GatewayMiddlewareContext,
    next: GatewayMiddlewareNext,
  ): Promise<Response> {
    // 1) Identitas dari Gateway (bukan header client)
    let email: string | null = null;
    try {
      email = (await context.identity())?.email ?? null;
    } catch {
      return new Response(null, { status: 503 });
    }
    if (!email) {
      return new Response(null, { status: 403 });
    }

    const ttl = Number(this.env.SESSION_TTL_SECONDS) || DEFAULT_TTL;
    const maxLen = Number(this.env.REASON_MAX_LENGTH) || 500;
    const key = `justifikasi:ok:${email}`;

    // 2) Sesi aktif -> lanjutkan (next() panggilan pertama & terakhir)
    if ((await this.env.SESSIONS.get(key)) === "1") {
      return next(request);
    }

    // 3) Submit form justifikasi
    if (request.method === "POST") {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return new Response(formHtml(context.host, email, "Form tidak valid."), HTML);
      }
      if (!isJustificationSubmission(form)) {
        // POST milik aplikasi tujuan, bukan form kita: teruskan apa adanya.
        return next(request);
      }
      const verdict = validateReason(form.get("reason"), maxLen);
      if (!verdict.ok) {
        return new Response(formHtml(context.host, email, verdict.error), HTML);
      }

      // Audit wajib: kalau D1 gagal -> akses gagalkan (fail-closed audit).
      try {
        await this.env.AUDIT.prepare(
          "INSERT INTO audit (user, host, reason, ts) VALUES (?, ?, ?, ?)",
        ).bind(email, context.host, verdict.reason, Date.now()).run();
      } catch (err) {
        console.error("D1 audit write failed", err);
        return new Response(
          formHtml(context.host, email, "Gagal menyimpan audit, coba lagi."),
          HTML,
        );
      }

      await this.env.SESSIONS.put(key, "1", { expirationTtl: ttl });

      // Body request sudah dikonsumsi oleh formData(), sehingga TIDAK boleh diteruskan
      // ke upstream (next() akan gagal -> Gateway fail-closed 500).
      // Balas 303: browser melakukan GET bersih ke URL yang sama; sesi KV aktif,
      // sehingga GET tersebut diteruskan normal oleh next().
      return new Response(null, {
        status: 303,
        headers: { location: request.url },
      });
    }

    // 4) Belum justifikasi, non-POST -> interstitial (synthetic, tanpa next())
    return new Response(formHtml(context.host, email), HTML);
  }
}
