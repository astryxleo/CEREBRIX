import React from "react";
import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import "./index.css";
import "./cerebrix-premium.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      {({ user, profile, signOut }) => <App user={user} profile={profile} signOut={signOut} />}
    </AuthGate>
  </React.StrictMode>
);
