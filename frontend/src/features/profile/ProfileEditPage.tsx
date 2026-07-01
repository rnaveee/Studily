import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import type { User } from "../../types";

export default function ProfileEditPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    school: user?.school ?? "",
    schoolId: user?.schoolId ?? "",
    year: user?.year?.toString() ?? "",
    major: user?.major ?? "",
    bio: user?.bio ?? "",
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
      }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["classmates"] });
      setSaved(true);
      setTimeout(() => navigate("/profile"), 800);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api.post<User>("/me/avatar", body);
    },
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["classmates"] });
    },
  });

  const removeAvatar = useMutation({
    mutationFn: () => api.del<User>("/me/avatar"),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["classmates"] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAvatar.mutate(file);
    e.target.value = "";
  }

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/profile")} className="btn btn-ghost">
          <ArrowLeft size={13} />
          Back
        </button>
        <h1 className="text-xl font-semibold text-fg">Edit profile</h1>
      </div>

      <div className="card p-5 flex items-center gap-4">
        <Avatar name={user?.name} username={user?.username} avatarUrl={user?.avatarUrl} size={64} className="text-xl" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
              className="btn btn-ghost"
            >
              {uploadAvatar.isPending ? "Uploading…" : "Change photo"}
            </button>
            {user?.avatarUrl && (
              <button
                type="button"
                onClick={() => removeAvatar.mutate()}
                disabled={removeAvatar.isPending}
                className="btn btn-ghost text-red"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {(uploadAvatar.error || removeAvatar.error) && (
            <span className="text-[12px] text-red">
              {((uploadAvatar.error ?? removeAvatar.error) as Error).message}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="card p-5 space-y-3"
      >
        <div>
          <label className="field-label">Name</label>
          <input className="input" value={form.name} onChange={set("name")} required autoFocus />
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
          <label className="field-label">Bio</label>
          <textarea className="input resize-none" rows={3} placeholder="A few words about you…" value={form.bio} onChange={set("bio")} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={save.isPending} className="btn btn-primary">
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => navigate("/profile")} className="btn btn-ghost">
            Cancel
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
