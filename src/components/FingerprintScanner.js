"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, Loader2, Usb } from "lucide-react";
import { SampleFormat } from "@digitalpersona/devices";
import { useFingerprintReader } from "@/hooks/useFingerprintReader";

const statusText = {
  initializing: "Initializing reader...",
  disconnected: "No reader detected — plug in the U.are.U 4500",
  connected: "Reader connected. Ready to scan.",
  scanning: "Place your finger on the reader...",
  error: "Reader error",
};

/**
 * @param {object} props
 * @param {(sample: import("@/hooks/useFingerprintReader").CapturedSample) => void} props.onSample
 * @param {boolean} [props.autoStart]
 * @param {any} [props.format]
 * @param {boolean} [props.disabled]
 * @param {string} [props.hint]
 */
export default function FingerprintScanner({
  onSample,
  autoStart = true,
  format = SampleFormat.Intermediate,
  disabled = false,
  hint,
}) {
  const { status, devices, error, quality, start, stop } = useFingerprintReader({
    format,
    onSample,
  });

  const autoStartedRef = useRef(false);
  const [uiHint, setUiHint] = useState("");

  useEffect(() => {
    if (!autoStart || disabled) return;
    if (status === "connected" && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void start();
    }
    if (status === "disconnected" || status === "error") {
      autoStartedRef.current = false;
    }
  }, [autoStart, disabled, status, start]);

  useEffect(() => {
    if (disabled && status === "scanning") void stop();
  }, [disabled, status, stop]);

  const ring = useMemo(() => {
    if (status === "scanning") return "0 0 0 3px rgba(29, 78, 216, 0.35)";
    return "0 0 0 1px #e2e8f0";
  }, [status]);

  const badgeColor =
    status === "connected" || status === "scanning"
      ? { bg: "rgba(22, 163, 74, 0.12)", fg: "#16a34a" }
      : status === "error"
        ? { bg: "rgba(244, 63, 94, 0.12)", fg: "#e11d48" }
        : { bg: "rgba(100, 116, 139, 0.12)", fg: "#64748b" };

  useEffect(() => {
    setUiHint(hint || "");
  }, [hint]);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "white",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(29, 78, 216, 0.08), rgba(15, 23, 42, 0.02))",
          boxShadow: ring,
        }}
      >
        <Fingerprint
          size={46}
          color={status === "scanning" ? "#1d4ed8" : status === "error" ? "#e11d48" : "#94a3b8"}
        />
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 800,
          background: badgeColor.bg,
          color: badgeColor.fg,
        }}
      >
        {status === "initializing" && <Loader2 size={14} className="animate-spin" />}
        {status === "disconnected" && <Usb size={14} />}
        {(status === "connected" || status === "scanning") && <CheckCircle2 size={14} />}
        {status === "error" && <AlertTriangle size={14} />}
        <span>{statusText[status]}</span>
      </div>

      {uiHint && status !== "error" && (
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{uiHint}</div>
      )}

      {error && (
        <div style={{ maxWidth: 360, textAlign: "center", color: "#e11d48", fontSize: 12 }}>{error}</div>
      )}

      <div style={{ fontSize: 12, color: "#64748b" }}>
        {devices.length > 0
          ? `${devices.length} device${devices.length > 1 ? "s" : ""} detected`
          : "No devices detected"}
        {quality !== null && quality !== undefined && <span> · quality code {quality}</span>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {status === "scanning" ? (
          <button
            type="button"
            onClick={() => void stop()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={disabled || status !== "connected"}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #bfdbfe",
              background: disabled || status !== "connected" ? "#e2e8f0" : "#1d4ed8",
              color: disabled || status !== "connected" ? "#94a3b8" : "white",
              fontWeight: 900,
              cursor: disabled || status !== "connected" ? "not-allowed" : "pointer",
            }}
          >
            Start scan
          </button>
        )}
      </div>
    </div>
  );
}
