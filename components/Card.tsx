import { ReactNode } from "react";
import clsx from "./clsx";

export default function Card({
  children,
  className,
  padding = "p-5",
  style,
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={clsx(
        "bg-surface border border-line rounded-card shadow-card",
        padding,
        className,
      )}
      style={style}
    >
      {children}
    </section>
  );
}
