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

const getCurrentEntryBundle = () => {
  const currentScript = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).find(
    (script) => script.src.includes("/assets/index-") && script.src.endsWith(".js"),
  );
  return currentScript ? new URL(currentScript.src, window.location.origin).pathname : null;
};

const getLatestEntryBundle = async () => {
  const response = await fetch(`/?llasa-update-check=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  const latestScript = Array.from(parsedDocument.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).find(
    (script) => {
      const src = script.getAttribute("src") ?? "";
      return src.includes("/assets/index-") && src.endsWith(".js");
    },
  );
  const latestSrc = latestScript?.getAttribute("src");
  return latestSrc ? new URL(latestSrc, window.location.origin).pathname : null;
};

let updateReloadRequested = false;

const reloadForAppUpdate = () => {
  if (updateReloadRequested) return;
  updateReloadRequested = true;
  window.location.reload();
};

const checkForAppUpdate = async () => {
  const currentEntryBundle = getCurrentEntryBundle();
  if (!currentEntryBundle) return;

  try {
    const latestEntryBundle = await getLatestEntryBundle();
    if (latestEntryBundle && latestEntryBundle !== currentEntryBundle) {
      reloadForAppUpdate();
    }
  } catch (error) {
    console.error("App update check failed", error);
  }
};

// Register a minimal service worker so browsers can offer installation (desktop icon).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    let serviceWorkerReloadRequested = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (serviceWorkerReloadRequested) return;
      serviceWorkerReloadRequested = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          installingWorker?.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              installingWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        void registration.update();
      })
      .catch((err) => {
        console.error("Service worker registration failed", err);
      });

    void checkForAppUpdate();
    window.setInterval(() => {
      void checkForAppUpdate();
    }, 5 * 60 * 1000);

    window.addEventListener("focus", () => {
      void checkForAppUpdate();
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        void checkForAppUpdate();
      }
    });
  });
}
