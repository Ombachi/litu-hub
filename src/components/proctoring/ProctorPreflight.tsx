import { useEffect, useRef, useState } from "react";
import { Camera, ShieldCheck, Maximize, IdCard, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProctorPreflightProps {
  examTitle: string;
  onReady: (idPhoto: string | null) => void;
  onCancel: () => void;
  onEnterLockdown: () => Promise<void> | void;
}

type Step = "camera" | "id" | "lockdown";

const ProctorPreflight = ({ examTitle, onReady, onCancel, onEnterLockdown }: ProctorPreflightProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>("camera");
  const [cameraOk, setCameraOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOk(true);
      } catch {
        setError("We could not access your camera. Allow camera access to sit this exam.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setIdPhoto(canvas.toDataURL("image/jpeg", 0.7));
  };

  const start = async () => {
    setStarting(true);
    await onEnterLockdown();
    onReady(idPhoto);
    setStarting(false);
  };

  const steps: { key: Step; label: string; icon: typeof Camera }[] = [
    { key: "camera", label: "Camera check", icon: Camera },
    { key: "id", label: "Photo ID", icon: IdCard },
    { key: "lockdown", label: "Secure mode", icon: ShieldCheck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-elevated max-h-[92vh] overflow-y-auto">
        <h2 className="font-display text-lg font-bold">Exam integrity check</h2>
        <p className="text-sm text-muted-foreground">{examTitle}</p>

        <div className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs",
                  step === s.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <span className="hidden text-xs sm:block">{s.label}</span>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <div className="overflow-hidden rounded-lg border bg-secondary/30">
            <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full object-cover" />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {step === "camera" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sit in a well-lit room with your face fully visible. Your camera stays on for the whole exam.
              </p>
              <button
                type="button"
                disabled={!cameraOk}
                onClick={() => setStep("id")}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {cameraOk ? "Camera looks good — continue" : "Waiting for camera…"}
              </button>
            </div>
          )}

          {step === "id" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Hold your student ID up to the camera and take a photo.
              </p>
              {idPhoto && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> ID captured
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={capture} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
                  {idPhoto ? "Retake photo" : "Capture ID"}
                </button>
                <button
                  type="button"
                  disabled={!idPhoto}
                  onClick={() => setStep("lockdown")}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "lockdown" && (
            <div className="space-y-3">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Maximize className="h-4 w-4" /> The exam opens in full screen</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Copy, paste and right-click are disabled</li>
                <li className="flex items-center gap-2"><Camera className="h-4 w-4" /> Leaving the window is recorded for your tutor</li>
              </ul>
              <button
                type="button"
                onClick={start}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {starting && <Loader2 className="h-4 w-4 animate-spin" />} Start secure exam
              </button>
            </div>
          )}

          <button type="button" onClick={onCancel} className="w-full rounded-lg border px-4 py-2 text-sm hover:bg-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProctorPreflight;
