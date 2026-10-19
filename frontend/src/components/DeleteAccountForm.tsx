import { useState } from "react";
import { ApiError } from "../lib/api";

export default function DeleteAccountForm({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 animate-slide">
      <div>
        <label className="field-label">Confirm with your password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-red animate-fade">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-danger">
        {busy ? "Deleting…" : "Permanently delete my account"}
      </button>
    </form>
  );
}
