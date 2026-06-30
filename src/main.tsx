import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ui/error-boundary";
import "./index.css";

// Catch unhandled errors and display them
window.addEventListener("error", (event) => {
  console.error("Global Error Caught:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Global Promise Rejection Caught:", event.reason);
});

// Força o reload da página quando o Vite falha em carregar um chunk JS antigo
(window as EventTarget).addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
