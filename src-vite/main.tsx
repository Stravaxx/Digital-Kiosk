
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { installAdminAuthClient } from "./services/adminAuthService";
  import { I18nProvider } from "./app/i18n";

  installAdminAuthClient();

  createRoot(document.getElementById("root")!).render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
  