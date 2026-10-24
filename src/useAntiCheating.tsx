import { useCallback, useEffect, useRef, useState } from "react";

type FortressOptions = {
  enabled?: boolean;
  blackoutOnBlur?: boolean;
  restrictClipboard?: boolean;
  onWarning?: (reason: "tab-hidden" | "print-screen" | "devtools-shortcut" | "context-menu" | "clipboard") => void;
};

export function useAntiCheating({
  enabled = true,
  blackoutOnBlur = true,
  restrictClipboard = false,
  onWarning,
}: FortressOptions = {}) {
  const [isBlackout, setIsBlackout] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const timeoutRef = useRef<number | null>(null);
  const callbackRef = useRef(onWarning);
  callbackRef.current = onWarning;

  const warn = useCallback((reason: Parameters<NonNullable<typeof onWarning>>[0]) => {
    setWarnings(value => value + 1);
    callbackRef.current?.(reason);
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch { /* Browser/user settings may deny fullscreen. */ }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsBlackout(false);
      return;
    }

    const handleVisibility = () => {
      if (document.hidden) {
        warn("tab-hidden");
        if (blackoutOnBlur) setIsBlackout(true);
      } else {
        setIsBlackout(false);
      }
    };
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      warn("context-menu");
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const printScreen = event.key === "PrintScreen";
      const devtools = (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key))
        || event.key === "F12";
      const screenshotShortcut = (event.metaKey && event.shiftKey && ["3", "4", "5", "6"].includes(key))
        || (event.metaKey && event.shiftKey && key === "s")
        || (event.shiftKey && key === "s" && (event.getModifierState("OS") || event.getModifierState("Meta")));
      if (printScreen || screenshotShortcut) {
        warn("print-screen");
        // Best effort only: browsers cannot reliably detect or prevent OS-level capture.
        setIsBlackout(true);
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setIsBlackout(false), 2500);
      } else if (devtools) {
        warn("devtools-shortcut");
      }
    };
    const blockClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      warn("clipboard");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreen);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    if (restrictClipboard) {
      window.addEventListener("copy", blockClipboard as EventListener);
      window.addEventListener("cut", blockClipboard as EventListener);
      window.addEventListener("paste", blockClipboard as EventListener);
    }
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("copy", blockClipboard as EventListener);
      window.removeEventListener("cut", blockClipboard as EventListener);
      window.removeEventListener("paste", blockClipboard as EventListener);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, blackoutOnBlur, restrictClipboard, warn]);

  return { isBlackout, warnings, isFullscreen, enterFullscreen };
}
