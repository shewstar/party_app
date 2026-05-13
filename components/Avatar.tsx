import clsx from "./clsx";

export default function Avatar({
  name,
  url,
  size = 40,
  isBuck,
}: {
  name: string;
  url?: string | null;
  size?: number;
  isBuck?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const content = url ? (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover border border-line"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={clsx(
        "rounded-full bg-accentSoft text-accent font-semibold flex items-center justify-center border border-line",
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </div>
  );

  if (!isBuck) return content;

  return (
    <span className="relative inline-flex shrink-0">
      {content}
      <span
        className="absolute flex items-center justify-center"
        style={{
          top: -(size * 0.15),
          right: -(size * 0.15),
          fontSize: size * 0.35,
          lineHeight: 1,
        }}
        aria-label="Buck"
      >
        👑
      </span>
    </span>
  );
}
