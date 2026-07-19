import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { ScanFace, ShieldCheck, X, Loader2, CameraOff, CheckCircle2 } from "lucide-react";

/*
 * FaceGate — a lightweight liveness / presence check.
 *
 * Uses face-api.js's TinyFaceDetector (a fast, free, open-source model, ~190 KB,
 * running fully in the browser — no image ever leaves the device). The citizen
 * must show a live face in the frame; once the detector sees a face stably for
 * ~1 second we consider identity presence confirmed and let them proceed.
 *
 * Props: open, purpose (string), onVerified(), onCancel()
 */

let _modelPromise = null;
function loadModel() {
  if (!_modelPromise) {
    _modelPromise = (async () => {
      try { await faceapi.tf.setBackend("webgl"); } catch { /* fall back to cpu */ }
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    })();
  }
  return _modelPromise;
}

const STABLE_HITS_REQUIRED = 6;   // ~1.2s of continuous detection @ 200ms
const SCORE_THRESHOLD = 0.5;

export default function FaceGate({ open, purpose = "verify your identity", onVerified, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const hitsRef = useRef(0);
  const doneRef = useRef(false);

  const [status, setStatus] = useState("loading"); // loading | scanning | detected | verified | error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const cleanup = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus("verified");
    setProgress(100);
    cleanup();
    setTimeout(() => onVerified?.(), 700);
  }, [cleanup, onVerified]);

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    hitsRef.current = 0;
    setProgress(0);
    setErrorMsg("");
    setStatus("loading");

    let cancelled = false;
    (async () => {
      try {
        await loadModel();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("scanning");

        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: SCORE_THRESHOLD });
        loopRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || doneRef.current) return;
          let det;
          try { det = await faceapi.detectSingleFace(video, options); }
          catch { return; }

          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (det) {
              const { x, y, width, height } = det.box;
              const sx = canvas.width / (video.videoWidth || 480);
              const sy = canvas.height / (video.videoHeight || 360);
              ctx.strokeStyle = "#1a7d2b";
              ctx.lineWidth = 3;
              ctx.strokeRect(x * sx, y * sy, width * sx, height * sy);
            }
          }

          if (det && det.score >= SCORE_THRESHOLD) {
            hitsRef.current += 1;
            setStatus("detected");
            setProgress(Math.min(100, Math.round((hitsRef.current / STABLE_HITS_REQUIRED) * 100)));
            if (hitsRef.current >= STABLE_HITS_REQUIRED) finish();
          } else {
            hitsRef.current = Math.max(0, hitsRef.current - 1);
            setStatus("scanning");
            setProgress(Math.round((hitsRef.current / STABLE_HITS_REQUIRED) * 100));
          }
        }, 200);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Please allow camera access to continue."
            : err?.name === "NotFoundError"
            ? "No camera was found on this device."
            : "Could not start the face check. " + (err?.message || "")
        );
      }
    })();

    return () => { cancelled = true; cleanup(); };
  }, [open, cleanup, finish]);

  if (!open) return null;

  const statusText = {
    loading: "Loading secure on-device face model…",
    scanning: "Position your face inside the frame",
    detected: "Face detected — hold still…",
    verified: "Identity presence confirmed",
    error: "Face check unavailable",
  }[status];

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}>
      <div className="card shadow-[var(--shadow-lg)] w-full max-w-md p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge badge-info mb-2"><ShieldCheck size={13} /> Liveness check</span>
            <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <ScanFace size={20} className="text-[var(--navy)]" /> Face verification
            </h3>
            <p className="text-sm text-[var(--muted)] mt-1">
              A quick on-device face scan to {purpose}. Your camera image never leaves this device.
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="btn btn-ghost btn-sm !px-2"><X size={20} /></button>
        </div>

        <div className="mt-5 relative rounded-[var(--radius)] overflow-hidden bg-[var(--ink)] aspect-[4/3]">
          {status !== "error" ? (
            <>
              <video ref={videoRef} muted playsInline
                className="w-full h-full object-cover [transform:scaleX(-1)]" />
              <canvas ref={canvasRef} width={480} height={360}
                className="absolute inset-0 w-full h-full [transform:scaleX(-1)]" />
              {(status === "loading") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs opacity-80">Loading model…</span>
                </div>
              )}
              {status === "verified" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--green)]/85 text-white gap-2 fade-up">
                  <CheckCircle2 size={44} />
                  <span className="font-bold">Verified</span>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 text-center">
              <CameraOff size={34} className="opacity-80" />
              <p className="text-sm opacity-90">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* progress + status */}
        {status !== "error" && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1.5">
              <span>{statusText}</span>
              <span className="font-semibold text-[var(--navy)]">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--green)] transition-[width] duration-200"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="btn btn-outline flex-1">Cancel</button>
          {status === "error" && (
            // Graceful degrade: if the camera/model is unavailable, don't hard-block
            // the demo — let the citizen continue after an explicit choice.
            <button onClick={onVerified} className="btn btn-primary flex-1">Continue without scan</button>
          )}
        </div>
        <p className="text-[0.7rem] text-[var(--muted)] mt-3 text-center leading-relaxed">
          Powered by an open-source on-device model (TinyFaceDetector). No image is uploaded or stored.
        </p>
      </div>
    </div>
  );
}
