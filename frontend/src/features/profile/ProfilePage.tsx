import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import type { User } from "../../types";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    school: user?.school ?? "",
    schoolId: user?.schoolId ?? "",
    year: user?.year?.toString() ?? "",
    major: user?.major ?? "",
    bio: user?.bio ?? "",
    avatarUrl: user?.avatarUrl ?? "",
  });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.put<User>("/me", {
        name: form.name,
        school: form.school || null,
        schoolId: form.schoolId || null,
        year: form.year ? Number(form.year) : null,
        major: form.major || null,
        bio: form.bio || null,
        avatarUrl: form.avatarUrl || null,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["classmates"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  const initial = (user?.name ?? user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-in">
      <h1 className="text-xl font-semibold text-fg">Profile</h1>

      <div className="card flex items-center gap-4 px-5 py-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-accent-fg"
          style={{ background: "var(--accent)" }}
        >
          {initial}
        </div>
        <div>
          <div className="font-semibold text-fg">@{user?.username}</div>
          <div className="text-[13px] text-fg-3">{user?.email}</div>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="card p-5 space-y-3"
      >
        <div>
          <label className="field-label">Name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">School</label>
            <input className="input" placeholder="e.g. Simon Fraser" value={form.school} onChange={set("school")} />
          </div>
          <div>
            <label className="field-label">School ID</label>
            <input className="input" placeholder="Student ID" value={form.schoolId} onChange={set("schoolId")} />
          </div>
          <div>
            <label className="field-label">Year</label>
            <input className="input" type="number" placeholder="e.g. 2" value={form.year} onChange={set("year")} min={1} max={8} />
          </div>
          <div>
            <label className="field-label">Major</label>
            <input className="input" placeholder="e.g. Computer Science" value={form.major} onChange={set("major")} />
          </div>
        </div>

        <div>
          <label className="field-label">Avatar URL</label>
          <input className="input" placeholder="https://…" value={form.avatarUrl} onChange={set("avatarUrl")} />
        </div>

        <div>
          <label className="field-label">Bio</label>
          <textarea className="input resize-none" rows={3} placeholder="A few words about you…" value={form.bio} onChange={set("bio")} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={save.isPending} className="btn btn-primary">
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-[13px] text-green animate-fade">
              <Check size={13} />
              Saved
            </span>
          )}
          {save.error && (
            <span className="text-[13px] text-red animate-fade">
              {(save.error as Error).message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
