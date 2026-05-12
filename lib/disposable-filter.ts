import type { FilterVariant } from "./supabase/types";

const MAX_EDGE = 1600;

export function pickFilterVariant(): FilterVariant {
  return Math.random() < 0.5 ? "warm" : "cool";
}

export async function applyDisposableFilter(
  video: HTMLVideoElement,
  variant: FilterVariant,
): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Video not ready");

  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.filter =
    variant === "warm"
      ? "sepia(0.25) saturate(1.35) contrast(1.15) brightness(1.05) hue-rotate(-8deg)"
      : "saturate(0.85) contrast(1.2) brightness(0.95) hue-rotate(8deg) sepia(0.1)";
  ctx.drawImage(video, 0, 0, w, h);
  ctx.filter = "none";

  if (variant === "cool") {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(180, 210, 220, 0.18)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.35,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  // Procedural grain: sparse white/black noise pixels with low alpha for film texture.
  const grain = ctx.createImageData(w, h);
  const data = grain.data;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() > 0.04) continue;
    const v = Math.random() < 0.5 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = Math.floor(Math.random() * 60) + 20;
  }
  const grainCanvas = document.createElement("canvas");
  grainCanvas.width = w;
  grainCanvas.height = h;
  const gctx = grainCanvas.getContext("2d");
  if (gctx) {
    gctx.putImageData(grain, 0, 0);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.6;
    ctx.drawImage(grainCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  if (variant === "warm" && Math.random() < 0.5) {
    const corners: Array<[number, number, number, number]> = [
      [0, 0, w * 0.6, h * 0.6],
      [w, 0, w * 0.4, h * 0.6],
      [0, h, w * 0.6, h * 0.4],
      [w, h, w * 0.4, h * 0.4],
    ];
    const [cx, cy] = corners[Math.floor(Math.random() * corners.length)];
    const leak = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.5);
    leak.addColorStop(0, "rgba(255, 150, 60, 0.55)");
    leak.addColorStop(0.5, "rgba(255, 90, 40, 0.15)");
    leak.addColorStop(1, "rgba(255, 90, 40, 0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  const now = new Date();
  const stamp = `'${String(now.getFullYear()).slice(-2)} ${now.getMonth() + 1} ${now.getDate()}`;
  const fontSize = Math.round(Math.min(w, h) * 0.045);
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = fontSize * 0.3;
  ctx.fillStyle = "rgba(255, 140, 40, 0.95)";
  ctx.fillText(stamp, w - fontSize * 0.6, h - fontSize * 0.5);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82,
    );
  });
}

export function playShutterSound(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const now = ac.currentTime;

    const clack = ac.createOscillator();
    const clackGain = ac.createGain();
    clack.type = "square";
    clack.frequency.setValueAtTime(80, now);
    clackGain.gain.setValueAtTime(0.25, now);
    clackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    clack.connect(clackGain).connect(ac.destination);
    clack.start(now);
    clack.stop(now + 0.05);

    const click = ac.createOscillator();
    const clickGain = ac.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(2000, now + 0.02);
    clickGain.gain.setValueAtTime(0.15, now + 0.02);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    click.connect(clickGain).connect(ac.destination);
    click.start(now + 0.02);
    click.stop(now + 0.09);

    setTimeout(() => ac.close().catch(() => {}), 200);
  } catch {
    // audio failing shouldn't break capture
  }
}
