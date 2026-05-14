"use client";

import confetti from "canvas-confetti";

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burstVote() {
  if (reducedMotion()) return;
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 35,
    origin: { y: 0.6 },
    colors: ["#0f6c73", "#e6a700", "#5b8def", "#1f9d55"],
    disableForReducedMotion: true,
  });
}

export function burstPB() {
  if (reducedMotion()) return;
  const end = Date.now() + 600;
  const tick = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#e6a700", "#b3261e", "#d96b27"],
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#e6a700", "#b3261e", "#d96b27"],
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
}
