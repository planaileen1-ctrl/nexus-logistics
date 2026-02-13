/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new fields
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */
"use client";

import { useRef } from "react";

export default function SignaturePad({
  onSave,
}: {
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  function getPosition(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
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

  function startDraw(e: any) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    drawingRef.current = true;
  }

  function draw(e: any) {
    if (!drawingRef.current) return;
    e.preventDefault();

    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPosition(e);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function saveSignature() {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");

    if (dataUrl.length < 1000) {
      alert("Please sign before saving");
      return;
    }

    onSave(dataUrl);
  }

  return (
    <div className="mt-6">
      <p className="text-sm mb-2 text-slate-300">
        Signature (use finger or mouse)
      </p>

      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="border border-slate-600 bg-slate-800 rounded touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="px-3 py-1 text-xs bg-slate-700 rounded"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={saveSignature}
          className="px-3 py-1 text-xs bg-indigo-600 rounded"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}
