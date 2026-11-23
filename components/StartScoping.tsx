"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SpeechInput } from "./SpeechInput";
import type { CompanyMatch, ExtraSource } from "@/lib/types";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel request body limit is 4.5 MB
const TEXT_EXT = /\.(txt|md|vtt|srt|csv|json|html?|eml)$/i;

type Target = { companyId?: string; companyName: string; meta?: string };

export function StartScoping() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ list: CompanyMatch[]; configured: boolean } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<(ExtraSource & { size: number })[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function search() {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/hubspot/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults({ list: data.results, configured: data.configured });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const added: (ExtraSource & { size: number })[] = [];
    for (const f of Array.from(list)) {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        added.push({ name: f.name, kind: "pdf", data: btoa(bin), size: f.size });
      } else if (f.type.startsWith("text/") || TEXT_EXT.test(f.name)) {
        added.push({ name: f.name, kind: "text", data: await f.text(), size: f.size });
      } else {
        setError(`${f.name}: use PDF or text files (.txt, .md, .vtt, .srt, .csv). Export Word docs as PDF first.`);
      }
    }
    setFiles((cur) => [...cur, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const totalBytes = files.reduce((a, f) => a + (f.kind === "pdf" ? f.data.length : f.size), 0) + notes.length;

  async function analyze() {
    if (!target) return;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      setError("Attachments are over 4 MB. Remove a file or paste the key parts as text.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: target.companyId,
          companyName: target.companyName,
          notes,
          sources: files.map(({ name, kind, data }) => ({ name, kind, data })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      router.push(`/scope/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  }

  /* ---------------- analyzing ---------------- */
  if (running && target) {
    return (
      <div className="animate-rise">
        <h3 className="text-2xl">
          Reading everything on <span className="accent">{target.companyName}</span>
        </h3>
        <ul className="mt-6 space-y-3 text-[15px] text-slate">
          {target.companyId && <Step text="Pulling every call, transcript, email, meeting, note and task from HubSpot" />}
          {files.length > 0 && <Step text={`Reading ${files.length} added document${files.length === 1 ? "" : "s"}`} />}
          <Step text="Finding pains, goals, stakeholders, budget and timing signals" />
          <Step text="Matching needs to LeadG2 services and building a service-points plan" />
        </ul>
        <p className="mt-6 text-sm text-slate">This usually takes 1–3 minutes for an active account.</p>
      </div>
    );
  }

  /* ---------------- step 2: sources ---------------- */
  if (target) {
    return (
      <div className="animate-rise space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-md border border-navy bg-white px-5 py-4">
          <span>
            <span className="block text-lg font-extrabold">{target.companyName}</span>
            <span className="block text-sm text-slate">{target.meta ?? "No HubSpot record"}</span>
          </span>
          <button onClick={() => setTarget(null)} className="link text-sm">
            Change
          </button>
        </div>

        <div>
          <p className="mb-2 font-sans text-[15px] font-bold text-navy">
            Anything not in HubSpot? <span className="font-normal text-slate">Optional</span>
          </p>
          <SpeechInput
            value={notes}
            onChange={setNotes}
            placeholder="Paste a call transcript, discovery notes, or dictate what you heard…"
          />
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.vtt,.srt,.csv,.json,.html,.eml,application/pdf,text/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="w-full rounded-md border border-dashed border-line bg-white px-5 py-5 text-left text-[15px] text-slate transition hover:border-navy"
          >
            <span className="font-bold text-navy">Add files</span> — transcripts (.vtt, .txt), RFPs, briefs, PDFs. Drag and drop works too.
          </button>
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-sm border border-line bg-white px-4 py-2 font-sans text-sm">
                  <span className="truncate">
                    <span className="label mr-2 rounded-sm bg-smoke px-1.5 py-0.5 text-[10px] text-slate">{f.kind}</span>
                    {f.name}
                  </span>
                  <button onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="ml-3 text-slate hover:text-navy" aria-label={`Remove ${f.name}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <ErrorBox text={error} />}

        <button onClick={analyze} className="btn btn-primary w-full">
          Read everything and recommend a scope →
        </button>
      </div>
    );
  }

  /* ---------------- step 1: find the company ---------------- */
  return (
    <div className="space-y-5">
      <SpeechInput
        value={q}
        onChange={setQ}
        onSubmit={search}
        multiline={false}
        autoFocus
        placeholder="Company name or HubSpot company ID…"
        submitLabel={searching ? "Searching…" : "Search HubSpot"}
        disabled={searching}
      />
      {error && <ErrorBox text={error} />}
      {results && (
        <div className="animate-rise space-y-3">
          {!results.configured && (
            <p className="rounded-md bg-smoke px-4 py-3 text-[15px] text-slate">
              HubSpot isn&apos;t connected (set <code className="font-sans text-navy">HUBSPOT_ACCESS_TOKEN</code>). You can still scope from transcripts and notes you add.
            </p>
          )}
          {results.configured && results.list.length === 0 && <p className="text-[15px] text-slate">No HubSpot companies matched “{q}”.</p>}
          {results.list.map((c) => {
            const meta =
              [c.domain, c.industry?.replace(/_/g, " ").toLowerCase(), [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ") ||
              `HubSpot ID ${c.id}`;
            return (
              <button
                key={c.id}
                onClick={() => setTarget({ companyId: c.id, companyName: c.name, meta })}
                className="group flex w-full items-center justify-between rounded-md border border-line bg-white px-5 py-4 text-left transition hover:border-navy"
              >
                <span>
                  <span className="block text-lg font-extrabold">{c.name}</span>
                  <span className="block text-sm text-slate">
                    {meta}
                    <span className="ml-2 text-steel">ID {c.id}</span>
                  </span>
                </span>
                <span className="text-[15px] font-bold text-orange-dark transition group-hover:translate-x-1">
                  Select →
                </span>
              </button>
            );
          })}
          <ManualButton q={q} onPick={setTarget} />
        </div>
      )}
      {error && q.trim() && !results && <ManualButton q={q} onPick={setTarget} />}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">{text}</div>;
}

function ManualButton({ q, onPick }: { q: string; onPick: (t: Target) => void }) {
  return (
    <button
      onClick={() => onPick({ companyName: q.trim() })}
      className="w-full rounded-md border border-dashed border-line bg-white px-5 py-3 text-left text-[15px] font-bold text-slate transition hover:border-navy hover:text-navy"
    >
      Scope “{q.trim()}” from transcripts and notes only →
    </button>
  );
}

function Step({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="thinking-bar flex gap-1">
        <span className="h-3 w-1 rounded-sm bg-orange" />
        <span className="h-3 w-1 rounded-sm bg-orange" />
        <span className="h-3 w-1 rounded-sm bg-orange" />
      </span>
      {text}
    </li>
  );
}
