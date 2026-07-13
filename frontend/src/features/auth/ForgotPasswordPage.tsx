import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post<void>("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[340px] animate-in">
        <div className="mb-8 text-center">
          <img src="/studily-3a.svg" alt="" className="mx-auto mb-2 h-14 w-14" />
          <span className="font-mono text-2xl font-bold tracking-tight text-fg">Studily</span>
        </div>

        <div className="card p-6">
          <h1 className="mb-5 text-[15px] font-semibold text-fg">Reset your password</h1>

          {sent ? (
            <p className="text-[13px] leading-relaxed text-fg-2">
              If an account exists for <span className="font-medium text-fg">{email}</span>, we've
              sent it a password reset link. Check your inbox — the link expires in 1 hour.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <p className="text-[13px] leading-relaxed text-fg-3">
                Enter your account email and we'll send you a link to set a new password.
              </p>
              <div>
                <label className="field-label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red animate-fade">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn btn-primary w-full mt-1">
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[13px] text-fg-3">
          <Link to="/login" className="text-accent hover:text-accent-2 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
