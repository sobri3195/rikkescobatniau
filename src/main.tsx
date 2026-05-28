import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();


if (import.meta.env.VITE_STORAGE_MODE === "local" && typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("supabase.co") || url.includes("/rest/v1/") || url.includes("/auth/v1/") || url.includes("/storage/v1/")) {
      console.error("BLOCKED SUPABASE REQUEST IN LOCAL MODE:", url);
      throw new Error("Supabase request blocked in localStorage mode.");
    }
    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
