import React, { useEffect, useRef, useState, ReactNode } from 'react';

interface Props {
  className?: string;
  children?: ReactNode;
}

export function CyberTunnelBanner({ className = '', children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);

  // Canvas Neon Cyber Tunnel / Pink Void Particle Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 180);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Tunnel Rings & Stars State
    const numRings = 14;
    const rings = Array.from({ length: numRings }, (_, i) => ({
      z: (i / numRings) * 1000,
      radius: 40 + i * 25,
      rotation: (i * Math.PI) / 8,
      speed: 1.8 + (i % 3) * 0.4,
    }));

    const numStars = 60;
    const stars = Array.from({ length: numStars }, () => ({
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 400,
      z: Math.random() * 800,
      sz: Math.random() * 2 + 1,
      color: Math.random() > 0.4 ? '#ec4899' : Math.random() > 0.5 ? '#a855f7' : '#38bdf8',
    }));

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.fillStyle = '#0a0714';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Draw Nebular Ambient Glow
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.7);
      grad.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
      grad.addColorStop(0.35, 'rgba(168, 85, 247, 0.2)');
      grad.addColorStop(0.7, 'rgba(24, 14, 41, 0.85)');
      grad.addColorStop(1, '#0a0714');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw 3D Flying Cyber Particles
      for (const s of stars) {
        s.z -= 4.5;
        if (s.z <= 10) {
          s.z = 800;
          s.x = (Math.random() - 0.5) * 600;
          s.y = (Math.random() - 0.5) * 400;
        }

        const k = 220 / s.z;
        const px = cx + s.x * k;
        const py = cy + s.y * k;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const alpha = Math.min(1, (800 - s.z) / 400);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(px, py, s.sz * k * 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Tail streak for speed illusion
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.sz * k;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx + s.x * (220 / (s.z + 25)), cy + s.y * (220 / (s.z + 25)));
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 3. Draw Perspective Tunnel Lines radiating from center
      const numLines = 16;
      ctx.lineWidth = 1;
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2 + time * 0.15;
        const x2 = cx + Math.cos(angle) * width * 1.2;
        const y2 = cy + Math.sin(angle) * height * 1.2;

        const lineGrad = ctx.createLinearGradient(cx, cy, x2, y2);
        lineGrad.addColorStop(0, 'rgba(236, 72, 153, 0.8)');
        lineGrad.addColorStop(0.4, 'rgba(168, 85, 247, 0.4)');
        lineGrad.addColorStop(1, 'rgba(236, 72, 153, 0.05)');

        ctx.strokeStyle = lineGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 4. Draw Concentric Neon Tunnel Hexagons / Rings
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        r.z -= 3.2;
        if (r.z <= 20) {
          r.z = 1000;
        }

        const scale = 260 / r.z;
        const ringRadius = (r.radius + Math.sin(time + i) * 8) * scale;
        const ringAlpha = Math.min(0.9, Math.max(0.05, (1000 - r.z) / 600));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(time * 0.2 + (i * Math.PI) / 6);

        // Neon Glow Ring
        ctx.shadowColor = i % 2 === 0 ? '#ec4899' : '#a855f7';
        ctx.shadowBlur = 12 * scale;
        ctx.strokeStyle = i % 2 === 0 ? `rgba(236, 72, 153, ${ringAlpha})` : `rgba(192, 132, 252, ${ringAlpha})`;
        ctx.lineWidth = Math.max(1, 2.2 * scale);

        // Hexagonal cyber loop
        ctx.beginPath();
        const sides = 6;
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * Math.PI * 2;
          const hx = Math.cos(a) * ringRadius;
          const hy = Math.sin(a) * ringRadius * 0.75;
          if (s === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 5. Center Core Pulse
      const coreRadius = 14 + Math.sin(time * 3) * 4;
      const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreRadius * 2);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#f472b6');
      coreGrad.addColorStop(0.7, 'rgba(236, 72, 153, 0.4)');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className={`relative w-full h-44 sm:h-52 bg-[#0a0714] p-6 flex flex-col justify-end overflow-hidden border-b border-pink-500/20 ${className}`}>
      {/* 1. Real-time Animated 60FPS Cyber Neon Tunnel Canvas (Always Active & Resilient) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* 2. Optional Video Layer with graceful fallback */}
      {!videoFailed && (
        <video
          ref={videoRef}
          src="https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-41485-large.mp4"
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          onError={() => setVideoFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover mix-blend-screen pointer-events-none transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-40' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. Dark Neon Vignette & Cyber Grid Overlay for high text contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#11131f] via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:16px_16px] opacity-25 pointer-events-none" />

      {/* Children content (Title, badges, slogans) */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
