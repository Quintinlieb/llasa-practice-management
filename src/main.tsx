import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __llasaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

window.__llasaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__llasaInstallPrompt = event as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent("llasa-install-available"));
});

createRoot(document.getElementById("root")!).render(<App />);

// Register a minimal service worker so browsers can offer installation (desktop icon).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  });
}
