import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
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
          <p className="mt-1 text-xs text-fg-3">Your Academic Planner</p>
        </div>

        <div className="card p-6">
          <h1 className="mb-5 text-[15px] font-semibold text-fg">Sign in</h1>

          <form onSubmit={onSubmit} className="space-y-3">
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
            <div>
              <label className="field-label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red animate-fade">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary w-full mt-1">
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-[12px]">
              <Link to="/forgot-password" className="text-fg-3 hover:text-accent transition-colors">
                Forgot your password?
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-fg-3">
          No account?{" "}
          <Link to="/signup" className="text-accent hover:text-accent-2 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
