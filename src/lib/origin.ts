import { headers } from "next/headers";

/**
 * Base URL for links that leave the browser — SMS, QR codes. TENUTO_PUBLIC_URL
 * wins when set: a link texted from a dev machine must not point at localhost.
 */
export async function publicBaseUrl(): Promise<string> {
  return process.env.TENUTO_PUBLIC_URL?.replace(/\/$/, "") ?? (await requestOrigin());
}

/** Absolute origin of the current request, for links and QR codes. */
export async function requestOrigin(): Promise<string> {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
