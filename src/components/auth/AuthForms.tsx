"use client";

import { HeartPulse, Loader2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const DEMOS = [
  { role: "officer", title: "Public-health officer", text: "Monitoring, verification, AI response plans", icon: ShieldCheck },
  { role: "citizen", title: "Citizen volunteer", text: "Stream checks and your neighbourhood's risk", icon: Users },
  { role: "clinician", title: "Clinician", text: "CDS Hooks alerts in a demo EHR", icon: HeartPulse },
] as const;

const LANDING: Record<string, string> = { officer: "/app", citizen: "/app/check", clinician: "/app/clinic" };

function useAfterAuth() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  return (role: string) => {
    const safe = next && next.startsWith("/app") ? next : LANDING[role] ?? "/app";
    router.push(safe);
    router.refresh();
  };
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input {...rest} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
    </label>
  );
}

export function DemoAccess() {
  const after = useAfterAuth();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  async function go(role: string) {
    setBusy(role);
    setError(undefined);
    const r = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (r.ok) after(role);
    else {
      setBusy(undefined);
      setError((await r.json().catch(() => ({}))).error ?? "Could not start the demo.");
    }
  }
  return (
    <div>
      <div className="grid gap-2">
        {DEMOS.map(({ role, title, text, icon: Icon }) => (
          <button
            key={role}
            onClick={() => go(role)}
            disabled={!!busy}
            className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left hover:border-river hover:bg-river-soft disabled:opacity-60"
          >
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-river-soft text-river shrink-0">
              {busy === role ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
            </span>
            <span>
              <span className="block text-sm font-semibold">Continue as {title.toLowerCase()}</span>
              <span className="block text-xs text-ink-3">{text}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-accent mt-2">{error}</p>}
    </div>
  );
}

export function SignInForm() {
  const after = useAfterAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    const r = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) after(j.role);
    else {
      setBusy(false);
      setError(j.error ?? "Sign-in failed.");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn-accent w-full py-3 text-[15px] disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignUpForm() {
  const after = useAfterAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [role, setRole] = useState<"citizen" | "clinician">("citizen");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), password: f.get("password"), role }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) after(j.role);
    else {
      setBusy(false);
      setError(j.error ?? "Sign-up failed.");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-sm font-medium">I am a</legend>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {(["citizen", "clinician"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`rounded-xl border px-3 py-2.5 text-sm ${role === r ? "border-river bg-river text-white" : "border-line hover:border-ink-3"}`}
            >
              {r === "citizen" ? "Citizen volunteer" : "Clinician"}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3 mt-1.5">Public-health officer accounts are set up by your city. Try one with the demo on the sign-in page.</p>
      </fieldset>
      <Input label="Full name" name="name" autoComplete="name" required />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn-accent w-full py-3 text-[15px] disabled:opacity-60">
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="text-xs text-ink-3">
        Your observations are published under a pseudonymous volunteer code, never your name or email.{" "}
        <Link href="/signin" className="underline">
          Already have an account?
        </Link>
      </p>
    </form>
  );
}
