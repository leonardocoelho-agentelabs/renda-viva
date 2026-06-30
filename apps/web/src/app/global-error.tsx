"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const isServerActionError =
      error.message?.includes("Failed to find Server Action") ||
      error.message?.includes("older or newer deployment");

    if (isServerActionError) {
      const alreadyReloaded = sessionStorage.getItem("rv_auto_reload_global");
      if (!alreadyReloaded) {
        sessionStorage.setItem("rv_auto_reload_global", "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "Inter, sans-serif",
            background: "#F5F8F6",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "3px solid #D8F3DC",
              borderTop: "3px solid #2D6A4F",
              borderRadius: "50%",
              animation: "rv-spin 1s linear infinite",
            }}
          />
          <p style={{ color: "#5A6B62", fontSize: "14px" }}>
            Atualizando o Renda Viva...
          </p>
          <style>{`
            @keyframes rv-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </body>
    </html>
  );
}
