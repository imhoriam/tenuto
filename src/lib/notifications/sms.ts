/**
 * SMS provider boundary, shaped like the payments one (src/lib/payments).
 *
 *   console — the default. Writes the message to the server log; the
 *             Notification row records exactly what would have been sent.
 *   twilio  — real delivery, chosen when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *             and either TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID are set.
 *
 * A Romanian provider (SMSO, SMSLink…) slots in behind the same interface if
 * local pricing or an alphanumeric sender ID matters more.
 */

export type SmsResult = { ok: true; providerRef: string } | { ok: false; error: string };

export interface SmsProvider {
  readonly name: string;
  send(params: { to: string; body: string }): Promise<SmsResult>;
}

export const consoleSms: SmsProvider = {
  name: "console",
  async send({ to, body }) {
    console.log(`[sms → ${to}]\n${body}\n`);
    return { ok: true, providerRef: `console_${Date.now().toString(36)}` };
  },
};

function twilio(env: {
  sid: string;
  token: string;
  from?: string;
  messagingServiceSid?: string;
}): SmsProvider {
  return {
    name: "twilio",
    async send({ to, body }) {
      const form = new URLSearchParams({ To: to, Body: body });
      if (env.messagingServiceSid) form.set("MessagingServiceSid", env.messagingServiceSid);
      else form.set("From", env.from!);

      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.sid}:${env.token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(10_000),
        });
        const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
        if (!res.ok || !json.sid) {
          return { ok: false, error: `twilio ${res.status}${json.code ? ` (${json.code})` : ""}: ${json.message ?? "unknown error"}` };
        }
        return { ok: true, providerRef: json.sid };
      } catch (err) {
        return { ok: false, error: `twilio: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  };
}

export function smsProvider(): SmsProvider {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, TWILIO_MESSAGING_SERVICE_SID: mss } =
    process.env;
  if (sid && token && (from || mss)) return twilio({ sid, token, from, messagingServiceSid: mss });
  return consoleSms;
}
