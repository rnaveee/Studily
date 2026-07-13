import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [error, setError] = useState("This verification link is missing its token.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api
      .post<void>("/auth/verify-email", { token })
      .then(async () => {
        setStatus("ok");
        await refresh().catch(() => {});
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
        setStatus("error");
      });
  }, [token, refresh]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[340px] animate-in">
        <div className="mb-8 text-center">
          <img src="/studily-3a.svg" alt="" className="mx-auto mb-2 h-14 w-14" />
          <span className="font-mono text-2xl font-bold tracking-tight text-fg">Studily</span>
        </div>

        <div className="card p-6 text-center">
          {status === "working" && (
            <div className="flex items-center justify-center gap-2 text-sm text-fg-3">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Verifying your email…
            </div>
          )}

          {status === "ok" && (
            <div className="space-y-4">
              <h1 className="text-[15px] font-semibold text-fg">Email verified 🎉</h1>
              <p className="text-[13px] leading-relaxed text-fg-2">
                Messaging and friends are now unlocked.
              </p>
              <Link to={user ? "/" : "/login"} className="btn btn-primary w-full">
                {user ? "Go to Studily" : "Sign in"}
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <h1 className="text-[15px] font-semibold text-fg">Couldn't verify</h1>
              <p className="text-[13px] leading-relaxed text-fg-2">{error}</p>
              <p className="text-[13px] leading-relaxed text-fg-3">
                You can request a new link from{" "}
                {user ? (
                  <Link to="/settings" className="text-accent hover:text-accent-2 transition-colors">
                    Settings
                  </Link>
                ) : (
                  <>Settings after signing in</>
                )}
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
