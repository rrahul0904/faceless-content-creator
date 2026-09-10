"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (!response.ok) { setError("That login did not work."); setBusy(false); return; }
    router.push("/dashboard"); router.refresh();
  }
  return <main className="loginPage"><Link href="/" className="brand"><span className="brandMark">F</span> FACELESS CREATOR</Link><form className="loginCard" onSubmit={submit}><span className="mutedLabel">PRIVATE STUDIO</span><h1>Welcome back.</h1><p>Use your workspace credentials to enter the content operating system.</p><label>Email<input name="email" type="email" defaultValue="demo@facelesscreator.local" required /></label><label>Password<input name="password" type="password" defaultValue="demo" required /></label>{error && <div className="errorBox">{error}</div>}<button className="button" disabled={busy}>{busy ? "Opening…" : "Open Studio →"}</button><small>Demo mode: demo@facelesscreator.local / demo</small></form></main>;
}
