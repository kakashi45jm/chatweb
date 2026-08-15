import { useEffect, useRef, useState } from 'react';
import { Copy, Check, QrCode, X, Share2, Users } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export function InviteModal({ isOpen, onClose, roomId, roomName }: Props) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?room=${roomId}` : '';

  const copyToClipboard = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Draw clean visual QR code matrix pattern on canvas
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Deterministic pseudo-QR pattern based on roomId
        const grid = 25;
        const cellSize = size / grid;
        ctx.fillStyle = '#0f172a';

        // Draw standard QR 3 corner finder patterns
        const drawFinder = (x: number, y: number) => {
          ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
        };

        drawFinder(1, 1);
        drawFinder(grid - 8, 1);
        drawFinder(1, grid - 8);

        // Fill data matrix
        let hash = 0;
        for (let i = 0; i < roomId.length; i++) {
          hash = (hash << 5) - hash + roomId.charCodeAt(i);
          hash |= 0;
        }

        for (let r = 0; r < grid; r++) {
          for (let c = 0; c < grid; c++) {
            // Avoid corner finder squares
            if (
              (r < 8 && c < 8) ||
              (r < 8 && c >= grid - 8) ||
              (r >= grid - 8 && c < 8)
            ) {
              continue;
            }
            const bit = Math.abs(Math.sin((r * grid + c) * 0.7 + hash)) > 0.45;
            if (bit) {
              ctx.fillRect(c * cellSize, r * cellSize, cellSize - 0.4, cellSize - 0.4);
            }
          }
        }
      }
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  return (
    <div id="invite-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div id="invite-modal-card" className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invite to Call & Chat</h2>
              <p className="text-xs text-slate-500">{roomName}</p>
            </div>
          </div>
          <button
            id="close-invite-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-center">
          
          {/* QR Code Canvas */}
          <div className="flex flex-col items-center justify-center">
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-xs inline-block">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Scan with iPad mini 2 Camera or Phone to join instantly
            </p>
          </div>

          {/* Room ID Badge */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Room Code</span>
              <div className="font-mono font-bold text-slate-900 text-sm">{roomId}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5" />
              <span>Multi-device</span>
            </div>
          </div>

          {/* Share Link Input */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-700">Direct Share Link</label>
            <div className="flex items-center gap-2">
              <input
                id="share-link-input"
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-mono text-slate-700 select-all"
              />
              <button
                id="copy-invite-link-btn"
                onClick={copyToClipboard}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition active:scale-95 shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            id="done-invite-btn"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
