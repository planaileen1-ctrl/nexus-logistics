"use client";

import { useEffect } from "react";

function shouldTransformInput(element: HTMLInputElement) {
  const type = (element.type || "text").toLowerCase();

  return ["text", "search", "url", "tel"].includes(type);
}

export default function GlobalUppercaseEnforcer() {
  useEffect(() => {
    const toUppercaseValue = (element: HTMLInputElement | HTMLTextAreaElement) => {
      const originalValue = element.value;
      const upperValue = originalValue.toUpperCase();

      if (originalValue === upperValue) return;

      const selectionStart = element.selectionStart;
      const selectionEnd = element.selectionEnd;

      element.value = upperValue;

      if (selectionStart !== null && selectionEnd !== null) {
        element.setSelectionRange(selectionStart, selectionEnd);
      }
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target instanceof HTMLInputElement && shouldTransformInput(target)) {
        toUppercaseValue(target);
      }

      if (target instanceof HTMLTextAreaElement) {
        toUppercaseValue(target);
      }
    };

    document.addEventListener("input", handleInput, true);

    return () => {
      document.removeEventListener("input", handleInput, true);
    };
  }, []);

  return null;
}
