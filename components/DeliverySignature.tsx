"use client";

import { useRef, useState } from "react";

type Props = {
  title: string;
  onSave: (dataUrl: string) => void;
};

export default function DeliverySignature({ title, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

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
    const rect = canvas.getBoundingClientRect();

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";

    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, 400, 200);
    ctx?.beginPath();
  }

  function save() {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>

      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="border border-white/20 rounded bg-black"
        onMouseDown={start}
        onMouseUp={end}
        onMouseMove={draw}
        onMouseLeave={end}
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
