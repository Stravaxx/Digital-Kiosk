
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { installAdminAuthClient } from "./services/adminAuthService";

  installAdminAuthClient();

  createRoot(document.getElementById("root")!).render(<App />);
  