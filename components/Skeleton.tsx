import clsx from "./clsx";

function pulse() {
  return "animate-pulse bg-line/60 rounded";
}

export function SkeletonLine({ width, height = "h-4" }: { width?: string; height?: string }) {
  return <div className={clsx(pulse(), height, width)} />;
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className={clsx(pulse(), "rounded-full shrink-0")}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonCard({ rows = 1, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx("bg-surface border border-line rounded-card p-4 flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonAvatar size={i === 0 ? 44 : 32} />
          <div className="flex-1 flex flex-col gap-1.5">
            <SkeletonLine width="w-2/3" />
            <SkeletonLine width="w-1/3" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTile() {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-5 flex flex-col gap-2 animate-pulse">
      <div className={clsx(pulse(), "w-8 h-8")} />
      <div className="flex flex-col gap-1.5">
        <SkeletonLine width="w-3/4" />
        <SkeletonLine width="w-1/2" height="h-3" />
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx(pulse(), className)} />;
}
