import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PhotoboothProvider } from "./store/photoboothStore";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PhotoboothProvider>
        <App />
      </PhotoboothProvider>
    </BrowserRouter>
  </React.StrictMode>
);
