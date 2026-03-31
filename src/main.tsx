import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { perfMonitor } from "./lib/performanceMonitor";

perfMonitor.init();

createRoot(document.getElementById("root")!).render(<App />);
