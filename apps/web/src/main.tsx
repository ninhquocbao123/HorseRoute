import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import AntDesignProvider from "./app/providers/AntDesignProvider";
import { AuthProvider } from "./app/providers/AuthProvider";
import { queryClient } from "./lib/queryClient";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AntDesignProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AntDesignProvider>
  </React.StrictMode>,
);
