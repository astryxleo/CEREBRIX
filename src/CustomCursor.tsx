import { useEffect, useState } from "react";

/** A custom cursor whose arrow tip is anchored to the browser's exact pointer coordinates. */
export default function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!finePointer.matches) return;
    document.body.classList.add("cerebrix-custom-cursor");
    const move = (event: PointerEvent) => {
      const cursor = document.getElementById("cerebrix-cursor");
      if (cursor) {
        cursor.style.left = (event.clientX - 2) + "px";
        cursor.style.top = (event.clientY - 1.5) + "px";
      }
      setVisible(true);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) setVisible(false);
    };
    const enter = () => setVisible(true);
    const blur = () => { setVisible(false); setPressed(false); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointerout", leave);
    document.addEventListener("pointerover", enter);
    window.addEventListener("blur", blur);
    return () => {
      document.body.classList.remove("cerebrix-custom-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("pointerover", enter);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return <div id="cerebrix-cursor" className={`cerebrix-cursor ${visible ? "is-visible" : ""} ${pressed ? "is-pressed" : ""}`} aria-hidden="true">
    <svg className="cerebrix-cursor-arrow" width="32" height="39" viewBox="0 0 32 39" fill="none">
      <path d="M2 1.5L2.3 27.1L9.2 20.8L14.3 32.4L19.3 30.2L14.1 18.9L24.2 18.6L2 1.5Z" fill="#F5FAFF" stroke="#0066FF" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M4.6 5.4L19 16.8L12.3 16.9L8.8 20.2L4.6 5.4Z" fill="#00CFFF"/>
      <path d="M2 1.5L2.3 27.1L9.2 20.8L14.3 32.4L19.3 30.2L14.1 18.9L24.2 18.6L2 1.5Z" stroke="white" strokeOpacity=".7" strokeWidth=".65" strokeLinejoin="round"/>
    </svg>
    <span className="cerebrix-cursor-pulse"/>
  </div>;
}
