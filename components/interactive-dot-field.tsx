"use client";

import { useEffect, useRef } from "react";

type Ripple = {
  startedAt: number;
  x: number;
  y: number;
};

const DOT_GAP = 9;
const DOT_RADIUS = 1;
const RIPPLE_DURATION = 560;

export function InteractiveDotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ripples: Ripple[] = [];
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;

    const draw = (now = performance.now()) => {
      context.clearRect(0, 0, width, height);

      for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) {
        for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) {
          let radius = DOT_RADIUS;
          let opacity = 0.3;

          for (const ripple of ripples) {
            const elapsed = now - ripple.startedAt;
            const progress = elapsed / RIPPLE_DURATION;
            if (progress > 1) continue;
            const distance = Math.hypot(x - ripple.x, y - ripple.y);
            const wave = Math.max(0, 1 - Math.abs(distance - progress * 92) / 24);
            radius = Math.max(radius, DOT_RADIUS + wave * 1.85);
            opacity = Math.max(opacity, 0.3 + wave * 0.7);
          }

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgb(28 28 30 / ${opacity})`;
          context.fill();
        }
      }

      while (ripples.length && now - ripples[0].startedAt > RIPPLE_DURATION) {
        ripples.shift();
      }

      if (ripples.length) animationFrame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      draw();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion) return;
      const box = canvas.getBoundingClientRect();
      ripples.push({ startedAt: performance.now(), x: event.clientX - box.left, y: event.clientY - box.top });
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", onPointerDown);

    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas aria-label="可点击的点阵互动区域" className="interactive-dot-field" ref={canvasRef} role="img" />;
}
