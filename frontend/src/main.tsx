import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { PhotoboothProvider } from "./store/photoboothStore";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <PhotoboothProvider>
        <App />
      </PhotoboothProvider>
    </HashRouter>
  </React.StrictMode>
);
