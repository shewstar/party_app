import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UserProvider } from "@/lib/user-context";
import { AchievementsProvider } from "@/lib/achievements-tracker";
import AchievementToast from "@/components/AchievementToast";
import PushPermissionBanner from "@/components/PushPermissionBanner";
import OfflineBanner from "@/components/OfflineBanner";
import StorageBoot from "@/components/StorageBoot";
import { BatteryProvider } from "@/lib/battery";
import { RealtimeProvider } from "@/lib/realtime-provider";

export const metadata: Metadata = {
  title: "Bucks Party",
  description: "Shared party room — drinks, votes, games, leaderboards.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bucks Party",
  },
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
        <StorageBoot />
        <BatteryProvider>
        <RealtimeProvider>
        <UserProvider>
          <AchievementsProvider>
            <div className="mx-auto max-w-md min-h-dvh flex flex-col">{children}</div>
            <AchievementToast />
            <PushPermissionBanner />
            <OfflineBanner />
          </AchievementsProvider>
        </UserProvider>
        </RealtimeProvider>
        </BatteryProvider>
      </body>
    </html>
  );
}
