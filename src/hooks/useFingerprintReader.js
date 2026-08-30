"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FingerprintReader,
  SampleFormat,
} from "@digitalpersona/devices";

/**
 * @typedef {"initializing"|"disconnected"|"connected"|"scanning"|"error"} ReaderStatus
 * @typedef {{ template: string, format: "Intermediate"|"PngImage", png?: string, quality?: number, at: number }} CapturedSample
 * @typedef {{ format?: any, onSample?: (sample: CapturedSample) => void }} UseFingerprintReaderOptions
 */

export function useFingerprintReader(options = {}) {
  const { format = SampleFormat.Intermediate, onSample } = options;

  const readerRef = useRef(null);
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const qualityRef = useRef(null);

  const [status, setStatus] = useState(/** @type {ReaderStatus} */ ("initializing"));
  const [devices, setDevices] = useState(/** @type {string[]} */ ([]));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [quality, setQuality] = useState(/** @type {number | null} */ (null));
  const [lastPng, setLastPng] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (typeof window === "undefined") return;
      if (!window.WebSdk) {
        setStatus("error");
        setError(
          "WebSdk is not loaded. Make sure /websdk.client.js is served and the DigitalPersona Lite Client / Agent is running."
        );
        return;
      }

      try {
        const reader = new FingerprintReader();
        readerRef.current = reader;

        const refreshDevices = async () => {
          try {
            const found = await reader.enumerateDevices();
            if (cancelled) return;
            const unique = Array.from(new Set(found));
            setDevices((prev) => {
              if (prev.length === unique.length && prev.every((id, i) => id === unique[i])) {
                return prev;
              }
              return unique;
            });
            setStatus((prev) => {
              if (prev === "scanning") return prev;
              return unique.length > 0 ? "connected" : "disconnected";
            });
          } catch {
            // ignore
          }
        };

        reader.on("DeviceConnected", () => {
          void refreshDevices();
        });

        reader.on("DeviceDisconnected", () => {
          void refreshDevices();
        });

        reader.on("AcquisitionStarted", () => {
          setStatus("scanning");
        });

        reader.on("AcquisitionStopped", () => {
          setStatus((s) => (s === "scanning" ? "connected" : s));
        });

        reader.on("QualityReported", (e) => {
          qualityRef.current = e.quality;
          setQuality(e.quality);
        });

        reader.on("ErrorOccurred", (e) => {
          setStatus("error");
          setError(`Reader error code: ${e.error}`);
        });

        reader.on("CommunicationFailed", () => {
          setStatus("error");
          setError(
            "Cannot reach the DigitalPersona Lite Client / Agent. Is it installed and running?"
          );
        });

        reader.on("SamplesAcquired", (e) => {
          const raw = e.samples?.[0];
          if (raw == null) {
            console.warn("[fp] SamplesAcquired with empty samples", e);
            return;
          }

          let data = "";
          if (typeof raw === "string") {
            data = raw;
          } else if (typeof raw === "object" && raw !== null) {
            const obj = raw;
            if (typeof obj.Data === "string") data = obj.Data;
          }

          if (data.startsWith('"') && data.endsWith('"')) {
            try {
              const unquoted = JSON.parse(data);
              if (typeof unquoted === "string") data = unquoted;
            } catch {
              // ignore
            }
          }

          if (!data) {
            console.warn("[fp] Could not extract sample data. Raw sample:", raw);
            return;
          }

          const isPng = format === SampleFormat.PngImage;
          const sample = /** @type {CapturedSample} */ ({
            template: data,
            format: isPng ? "PngImage" : "Intermediate",
            at: Date.now(),
            quality: qualityRef.current ?? undefined,
          });

          if (isPng) {
            const b64Std = data.replace(/-/g, "+").replace(/_/g, "/");
            sample.png = `data:image/png;base64,${b64Std}`;
            setLastPng(sample.png);
          }
          onSampleRef.current?.(sample);
        });

        await refreshDevices();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void setup();

    return () => {
      cancelled = true;
      const reader = readerRef.current;
      if (reader) {
        reader.stopAcquisition().catch(() => undefined);
        reader.off();
        readerRef.current = null;
      }
    };
  }, [format]);

  const start = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader) return;
    setError(null);
    try {
      await reader.startAcquisition(format);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [format]);

  const stop = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader) return;
    try {
      await reader.stopAcquisition();
    } catch {
      // ignore
    }
  }, []);

  return { status, devices, error, quality, lastPng, start, stop, SampleFormat };
}
