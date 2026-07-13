import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await api.post<void>("/auth/reset-password", { token, password });
      setDone(true);
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
          <h1 className="mb-5 text-[15px] font-semibold text-fg">Choose a new password</h1>

          {!token ? (
            <p className="text-[13px] leading-relaxed text-fg-2">
              This reset link is missing its token. Open the link from your email again, or{" "}
              <Link to="/forgot-password" className="text-accent hover:text-accent-2 transition-colors">
                request a new one
              </Link>
              .
            </p>
          ) : done ? (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-fg-2">
                Your password has been updated. You can now sign in with it.
              </p>
              <Link to="/login" className="btn btn-primary w-full">
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="field-label">New password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div>
                <label className="field-label">Confirm password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="repeat it"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red animate-fade">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn btn-primary w-full mt-1">
                {busy ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
