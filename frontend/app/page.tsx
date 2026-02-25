"use client";

import { useEffect, useState } from "react";

type HealthStatus = "idle" | "loading" | "ok" | "error";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export default function Home() {
  const [status, setStatus] = useState<HealthStatus>("idle");
  const [message, setMessage] = useState("Waiting to run health check...");

  useEffect(() => {
    if (!apiBaseUrl) {
      setStatus("error");
      setMessage("Set NEXT_PUBLIC_API_BASE_URL to run health check.");
      return;
    }

    const runHealthCheck = async () => {
      setStatus("loading");
      setMessage("Checking backend health...");

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as { status?: string };

        if (data.status === "ok") {
          setStatus("ok");
          setMessage("Backend is healthy.");
          return;
        }

        setStatus("error");
        setMessage("Backend responded, but payload was unexpected.");
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "Health check failed.",
        );
      }
    };

    void runHealthCheck();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Keith Content App</h1>
        <p className="mt-2 text-sm text-slate-600">
          API Base URL: {apiBaseUrl || "Not configured"}
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Backend health check</p>
          <p className="mt-2 text-lg font-semibold">
            Status:{" "}
            <span
              className={
                status === "ok"
                  ? "text-emerald-600"
                  : status === "loading"
                    ? "text-amber-600"
                    : status === "error"
                      ? "text-rose-600"
                      : "text-slate-700"
              }
            >
              {status.toUpperCase()}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
        </div>
      </section>
    </main>
  );
}
