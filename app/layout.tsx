import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UserProvider } from "@/lib/user-context";

export const metadata: Metadata = {
  title: "Bucks Party",
  description: "Shared party room — drinks, votes, games, leaderboards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f6f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <UserProvider>
          <div className="mx-auto max-w-md min-h-dvh flex flex-col">{children}</div>
        </UserProvider>
      </body>
    </html>
  );
}
