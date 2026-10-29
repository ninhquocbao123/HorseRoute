import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import AntDesignProvider from "./app/providers/AntDesignProvider";
import { AuthProvider } from "./app/providers/AuthProvider";
import { queryClient } from "./lib/queryClient";
import { applyThemeCssVariables } from "./styles/theme-tokens";
import "./styles/index.css";

applyThemeCssVariables();

const router = createBrowserRouter([{ path: "*", element: <AuthProvider><App /></AuthProvider> }]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AntDesignProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AntDesignProvider>
  </React.StrictMode>,
);
