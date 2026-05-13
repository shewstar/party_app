"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type BatteryManager = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
};

type BatteryCtx = {
  level: number;
  charging: boolean;
  supported: boolean;
  lowPowerMode: boolean;
  throttleMs: number;
};

const Ctx = createContext<BatteryCtx>({
  level: 1,
  charging: true,
  supported: false,
  lowPowerMode: false,
  throttleMs: 0,
});

export function BatteryProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState(1);
  const [charging, setCharging] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    let cancelled = false;

    (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> })
      .getBattery?.()
      .then((battery) => {
        if (cancelled) return;
        setSupported(true);
        setLevel(battery.level);
        setCharging(battery.charging);

        battery.addEventListener("levelchange", () => {
          if (!cancelled) setLevel(battery.level);
        });
        battery.addEventListener("chargingchange", () => {
          if (!cancelled) setCharging(battery.charging);
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const lowPowerMode = supported && level < 0.2 && !charging;
  const throttleMs = lowPowerMode ? 30_000 : 0;

  const value = useMemo<BatteryCtx>(
    () => ({ level, charging, supported, lowPowerMode, throttleMs }),
    [level, charging, supported, lowPowerMode, throttleMs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBattery() {
  return useContext(Ctx);
}
