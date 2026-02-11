"use client";

import { useRef, useState } from "react";

type Props = {
  title: string;
  onSave: (dataUrl: string) => void;
};

export default function DeliverySignature({ title, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPosition(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function start(e: any) {
    setDrawing(true);
    draw(e);
  }

  function end() {
    setDrawing(false);
    canvasRef.current?.getContext("2d")?.beginPath();
  }

  function draw(e: any) {
    if (!drawing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const pos = getPosition(e);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    setHasDrawn(true);
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, 400, 200);
    ctx?.beginPath();
    setHasDrawn(false);
  }

  function save() {
    if (!canvasRef.current) return;

    if (!hasDrawn) {
      alert("Signature is required.");
      return;
    }

    const dataUrl = canvasRef.current.toDataURL("image/png");

    // Validación mínima de tamaño
    if (dataUrl.length < 2000) {
      alert("Signature is too small or invalid.");
      return;
    }

    onSave(dataUrl);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>

      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="border border-white/20 rounded bg-black touch-none"
        onMouseDown={start}
        onMouseUp={end}
        onMouseMove={draw}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchEnd={end}
        onTouchMove={draw}
      />

      <div className="flex gap-2">
        <button
          onClick={clear}
          className="text-xs px-3 py-1 bg-gray-700 rounded"
        >
          Clear
        </button>

        <button
          onClick={save}
          className="text-xs px-3 py-1 bg-green-600 rounded"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}
