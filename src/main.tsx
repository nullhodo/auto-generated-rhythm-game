import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// 開発環境のみタブタイトルに [DEV] prefix を付与
const devPrefix = import.meta.env.DEV ? "[DEV] " : "";
document.title = `${devPrefix}Auto Generated Rhythm Game | nullhodo`;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

