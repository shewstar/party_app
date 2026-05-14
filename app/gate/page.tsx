import Card from "@/components/Card";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function GatePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;
  const hasError = error === "1";
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex-1 px-5 py-8 flex flex-col gap-6 justify-center">
      <div className="text-center">
        <div className="text-5xl mb-2">🔒</div>
        <h1 className="text-3xl font-bold">Party pass</h1>
        <p className="text-muted mt-2">Invite only. Enter the passphrase.</p>
      </div>
      <Card>
        <form method="POST" action="/api/gate" className="flex flex-col gap-4">
          <input type="hidden" name="next" value={safeNext} />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Passphrase</span>
            <input
              autoFocus
              type="password"
              name="password"
              autoComplete="current-password"
              className="border border-line rounded-card px-4 py-3 text-lg bg-surface focus:outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-card px-6 py-5 text-lg font-semibold transition flex items-center justify-center gap-3 bg-accent text-white shadow-card hover:opacity-95 active:opacity-90"
          >
            Let me in
          </button>
          {hasError && (
            <p className="text-danger text-sm text-center">Wrong passphrase. Try again.</p>
          )}
        </form>
      </Card>
    </main>
  );
}
