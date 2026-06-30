import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";

export default function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "", school: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup({ ...form, school: form.school || undefined });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[360px] animate-in">
        <div className="mb-8 text-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-fg">studily</span>
          <p className="mt-1 text-xs text-fg-3">your academic planner</p>
        </div>

        <div className="card p-6">
          <h1 className="mb-5 text-[15px] font-semibold text-fg">Create account</h1>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Full name</label>
                <input className="input" placeholder="Alex Kim" value={form.name} onChange={set("name")} required />
              </div>
              <div>
                <label className="field-label">Username</label>
                <input className="input" placeholder="alexkim" value={form.username} onChange={set("username")} required minLength={3} />
              </div>
            </div>
            <div>
              <label className="field-label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input className="input" type="password" placeholder="min 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
            </div>
            <div>
              <label className="field-label">School <span className="normal-case text-fg-3">(optional)</span></label>
              <input className="input" placeholder="e.g. Simon Fraser University" value={form.school} onChange={set("school")} />
            </div>

            {error && (
              <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red animate-fade">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary w-full mt-1">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-fg-3">
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:text-accent-2 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
