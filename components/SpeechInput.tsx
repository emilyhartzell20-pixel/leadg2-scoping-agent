"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { useSpeech } from "./useSpeech";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  autoFocus?: boolean;
}

export function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" strokeLinecap="round" />
    </svg>
  );
}

/** Text input with a mic button (Web Speech API) and optional submit. */
export function SpeechInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  multiline = true,
  disabled,
  submitLabel = "Send",
  autoFocus,
}: Props) {
  const baseRef = useRef("");
  const [interim, setInterim] = useState("");
  const speech = useSpeech((finalText, interimText) => {
    const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
    onChange((baseRef.current + sep + finalText).trimStart());
    setInterim(interimText);
  });

  const toggleMic = () => {
    if (!speech.listening) baseRef.current = value;
    else setInterim("");
    speech.toggle();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      if (speech.listening) speech.stop();
      if (value.trim()) onSubmit();
    }
  };

  const shared = {
    value,
    disabled,
    autoFocus,
    placeholder: speech.listening ? "Listening…" : placeholder,
    onKeyDown: onKey,
    className:
      "w-full resize-none bg-transparent px-4 py-3 text-[15px] text-smoke placeholder:text-steel focus:outline-none disabled:opacity-50",
  };

  return (
    <div>
      <div
        className={`flex items-end gap-2 rounded-md border bg-navy p-1.5 transition ${
          speech.listening ? "border-orange shadow-[0_0_0_3px_rgba(225,114,38,0.18)]" : "border-line focus-within:border-steel"
        }`}
      >
        {multiline ? (
          <textarea rows={2} {...shared} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...shared} onChange={(e) => onChange(e.target.value)} />
        )}
        {speech.supported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop dictation" : "Start dictation"}
            title={speech.listening ? "Stop dictation" : "Dictate"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded transition ${
              speech.listening ? "bg-orange text-midnight" : "bg-navy-2 text-steel hover:text-smoke"
            }`}
          >
            <MicIcon />
          </button>
        )}
        {onSubmit && (
          <button
            type="button"
            onClick={() => {
              if (speech.listening) speech.stop();
              onSubmit();
            }}
            disabled={disabled || !value.trim()}
            className="h-10 shrink-0 rounded bg-orange px-4 font-heading text-sm font-extrabold text-midnight transition hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitLabel}
          </button>
        )}
      </div>
      {(interim || speech.error) && (
        <p className={`mt-1.5 px-1 text-xs ${speech.error ? "text-red-400" : "italic text-steel"}`}>
          {speech.error ?? interim}
        </p>
      )}
    </div>
  );
}
