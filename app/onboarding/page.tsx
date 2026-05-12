"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BigButton from "@/components/BigButton";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase/browser";
import { ensureUserId, useUser } from "@/lib/user-context";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const id = ensureUserId();
    const { error: err } = await supabase()
      .from("users")
      .upsert({ id, name: name.trim() }, { onConflict: "id" });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex-1 px-5 py-8 flex flex-col gap-6 justify-center">
      <div className="text-center">
        <div className="text-5xl mb-2">🍻</div>
        <h1 className="text-3xl font-bold">Welcome to the party</h1>
        <p className="text-muted mt-2">What should we call you tonight?</p>
      </div>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Your name</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dave"
              className="border border-line rounded-card px-4 py-3 text-lg bg-surface focus:outline-none focus:border-accent"
              maxLength={40}
            />
          </label>
          <BigButton type="submit" disabled={!name.trim() || submitting}>
            {submitting ? "Joining…" : "Join the party"}
          </BigButton>
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>
      </Card>
      <p className="text-xs text-muted text-center">
        You can add weight and an avatar later in Settings — weight is used for
        the BAC estimate.
      </p>
    </main>
  );
}
