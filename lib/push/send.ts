import webpush from "web-push";
import { supabaseServer } from "@/lib/supabase/server";
import type { PushSubscriptionRow } from "@/lib/supabase/types";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:party@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY in env.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (userIds.length === 0) return { sent: 0, pruned: 0 };
  configure();
  const supa = supabaseServer();
  const { data, error } = await supa
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds);
  if (error) throw error;
  const subs = (data ?? []) as PushSubscriptionRow[];
  const body = JSON.stringify(payload);
  const deadEndpoints: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          deadEndpoints.push(sub.endpoint);
        } else {
          console.error("[push] send failed", status, err);
        }
      }
    }),
  );

  if (deadEndpoints.length > 0) {
    await supa.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }
  return { sent, pruned: deadEndpoints.length };
}

export async function sendPushToAllExcept(
  excludeUserId: string | null,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  const supa = supabaseServer();
  let query = supa.from("users").select("id");
  if (excludeUserId) query = query.neq("id", excludeUserId);
  const { data, error } = await query;
  if (error) throw error;
  const ids = (data ?? []).map((u) => u.id as string);
  return sendPushToUsers(ids, payload);
}
