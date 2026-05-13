import { NextRequest } from "next/server";

export type WebhookPayload<T> = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: T;
  old_record: T | null;
};

export function authorizeWebhook(req: NextRequest): boolean {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization");
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  return provided === expected;
}

export function pushEnabled(): boolean {
  const flag = process.env.PUSH_ENABLED?.toLowerCase();
  return flag !== "false" && flag !== "0";
}

export function authorizeCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  return provided === expected;
}
