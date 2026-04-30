import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");
// Generated client URLs already start with "/api", so the base is just the artifact prefix.
setBaseUrl(PREFIX || "/");

createRoot(document.getElementById("root")!).render(<App />);
