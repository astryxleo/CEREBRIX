import { useEffect } from "react";

/** Force the repository's chosen PNG as the browser-native cursor everywhere. */
export default function CustomCursor() {
  useEffect(() => {
    document.documentElement.classList.add("cerebrix-force-cursor");
    return () => document.documentElement.classList.remove("cerebrix-force-cursor");
  }, []);
  return null;
}
