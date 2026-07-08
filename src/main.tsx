import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { PostHogProvider } from '@posthog/react'

const options = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: '2026-05-30',
} as const



ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PostHogProvider apiKey={import.meta.env.VITE_POSTHOG_PROJECT_TOKEN} options={options}>
      <App />
    </PostHogProvider>
    </BrowserRouter>
  </React.StrictMode>
);