import { useCallback, useEffect, useRef, useState } from "react";

export type FortressStrikeReason =
  | "tab-hidden" | "window-blur" | "pointer-left" | "print-screen"
  | "devtools-shortcut" | "clipboard" | "context-menu";

type Options = {
  enabled?: boolean;
  maxStrikes?: number;
  restrictClipboard?: boolean;
  onStrike?: (reason: FortressStrikeReason, strike: number) => void;
  autoSubmitTest: (reason: FortressStrikeReason) => void | boolean | Promise<void | boolean>;
  onTerminated?: () => void;
};

/** Client-side deterrents only; browsers cannot reliably detect OS screenshots or disable DevTools. */
export function useFortressSecurity({
  enabled = true, maxStrikes = 3, restrictClipboard = true,
  onStrike, autoSubmitTest, onTerminated,
}: Options) {
  const [strikes, setStrikes] = useState(0);
  const [isBlackout, setIsBlackout] = useState(false);
  const [lastReason, setLastReason] = useState<FortressStrikeReason | null>(null);
  const [terminated, setTerminated] = useState(false);
  const strikeRef = useRef(0);
  const lastAt = useRef(0);
  const terminal = useRef(false);
  const timer = useRef<number | null>(null);
  const callbacks = useRef({ onStrike, autoSubmitTest, onTerminated });
  callbacks.current = { onStrike, autoSubmitTest, onTerminated };

  const strike = useCallback((reason: FortressStrikeReason) => {
    const now = Date.now();
    if (terminal.current || now - lastAt.current < 900) return;
    lastAt.current = now;
    const count = ++strikeRef.current;
    setStrikes(count);
    setLastReason(reason);
    setIsBlackout(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (count < maxStrikes) timer.current = window.setTimeout(() => setIsBlackout(false), 2200);
    callbacks.current.onStrike?.(reason, count);
    if (count >= maxStrikes) {
      terminal.current = true;
      setTerminated(true);
      void Promise.resolve(callbacks.current.autoSubmitTest(reason)).then(result => {
        if (result === false) {
          terminal.current = false;
          setTerminated(false);
          setIsBlackout(true);
          return;
        }
        callbacks.current.onTerminated?.();
      }).catch(() => {
        terminal.current = false;
        setTerminated(false);
        setIsBlackout(true);
      });
    }
  }, [maxStrikes]);

  useEffect(() => {
    if (!enabled || terminated) return;
    const visibility = () => { if (document.hidden) strike("tab-hidden"); };
    const blur = () => strike("window-blur");
    const leave = (e: MouseEvent) => {
      if (e.relatedTarget === null && (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight)) strike("pointer-left");
    };
    const keydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(key))) {
        e.preventDefault(); strike("print-screen"); return;
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) || (e.ctrlKey && key === "u")) {
        e.preventDefault(); strike("devtools-shortcut"); return;
      }
      if (restrictClipboard && (e.ctrlKey || e.metaKey) && ["c", "x", "v"].includes(key)) {
        e.preventDefault(); strike("clipboard");
      }
    };
    const clipboard = (e: ClipboardEvent) => {
      if (restrictClipboard) { e.preventDefault(); strike("clipboard"); }
    };
    const context = (e: MouseEvent) => { e.preventDefault(); strike("context-menu"); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    document.body.addEventListener("mouseleave", leave);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("copy", clipboard, true);
    window.addEventListener("cut", clipboard, true);
    window.addEventListener("paste", clipboard, true);
    window.addEventListener("contextmenu", context, true);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      document.body.removeEventListener("mouseleave", leave);
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("copy", clipboard, true);
      window.removeEventListener("cut", clipboard, true);
      window.removeEventListener("paste", clipboard, true);
      window.removeEventListener("contextmenu", context, true);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [enabled, terminated, restrictClipboard, strike]);

  return { strikes, isBlackout, lastReason, terminated, resetBlackout: () => setIsBlackout(false) };
}
