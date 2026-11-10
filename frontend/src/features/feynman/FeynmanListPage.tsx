import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { FeynmanSession, FeynmanSummary } from "./feynmanApi";

export default function FeynmanListPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const sessions = useQuery({
    queryKey: ["feynman", "sessions"],
    queryFn: () => api.get<FeynmanSummary[]>("/feynman/sessions"),
  });

  const start = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (title.trim()) form.append("title", title.trim());
      if (focus.trim()) form.append("focus", focus.trim());
      files.forEach((f) => form.append("files", f));
      return api.post<FeynmanSession>("/feynman/sessions", form);
    },
    onSuccess: (s) => navigate(`/study/feynman/${s.id}`),
  });

  return (
    <div>
      <h1>StudilyBot</h1>
      <p>Teach StudilyBot your lecture in your own words and find the gaps in what you know.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start.mutate();
        }}
      >
        <div>
          <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <textarea
            placeholder="What do you want to practise? (optional)"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
        </div>
        <div>
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.docx,.txt,.md"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
          />
        </div>
        <button type="submit" disabled={files.length === 0 || start.isPending}>
          {start.isPending ? "Reading your files…" : "Start session"}
        </button>
        {start.isError && <p>{(start.error as Error).message}</p>}
      </form>

      <h2>Past sessions</h2>
      {sessions.data?.length === 0 && <p>No sessions yet.</p>}
      <ul>
        {sessions.data?.map((s) => (
          <li key={s.id}>
            <Link to={`/study/feynman/${s.id}`}>{s.title}</Link>{" "}
            {s.status === "COMPLETE" ? `· ${s.score ?? 0}%` : "· in progress"}
          </li>
        ))}
      </ul>
    </div>
  );
}
