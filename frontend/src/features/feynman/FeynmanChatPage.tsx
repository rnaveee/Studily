import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { parseReport, type FeynmanMessage, type FeynmanSession, type FeynmanTurn } from "./feynmanApi";

export default function FeynmanChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const key = ["feynman", "session", id];

  const session = useQuery({
    queryKey: key,
    queryFn: () => api.get<FeynmanSession>(`/feynman/sessions/${id}`),
  });

  function append(turn: FeynmanTurn, sent?: FeynmanMessage) {
    qc.setQueryData<FeynmanSession>(key, (old) =>
      old
        ? {
            ...old,
            status: turn.status,
            score: turn.score,
            messages: [...old.messages, ...(sent ? [sent] : []), ...turn.messages],
          }
        : old,
    );
    qc.invalidateQueries({ queryKey: ["feynman", "sessions"] });
  }

  const send = useMutation({
    mutationFn: (body: string) => api.post<FeynmanTurn>(`/feynman/sessions/${id}/messages`, { body }),
    onSuccess: (turn, body) => {
      append(turn, { id: -Date.now(), role: "USER", kind: "CHAT", body, createdAt: new Date().toISOString() });
      setDraft("");
    },
  });

  const finish = useMutation({
    mutationFn: () => api.post<FeynmanTurn>(`/feynman/sessions/${id}/finish`),
    onSuccess: (turn) => append(turn),
  });

  const addDocs = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return api.post<FeynmanSession>(`/feynman/sessions/${id}/documents`, form);
    },
    onSuccess: (s) => qc.setQueryData(key, s),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/feynman/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feynman", "sessions"] });
      navigate("/learn/feynman");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [session.data?.messages.length, send.isPending]);

  if (session.isLoading) return <p>Loading…</p>;
  if (!session.data) return <p>Session not found.</p>;
  const s = session.data;
  const active = s.status === "ACTIVE";
  const busy = send.isPending || finish.isPending;

  return (
    <div>
      <h1>{s.title}</h1>
      {s.focus && <p>Practising: {s.focus}</p>}

      <details>
        <summary>Documents ({s.documents.length})</summary>
        <ul>
          {s.documents.map((d) => (
            <li key={d.id}>
              {d.fileName} · {Math.round(d.sizeBytes / 1024)} KB
            </li>
          ))}
        </ul>
        {active && (
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.docx,.txt,.md"
            disabled={addDocs.isPending}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) addDocs.mutate(files.slice(0, 3));
              e.target.value = "";
            }}
          />
        )}
        {addDocs.isError && <p>{(addDocs.error as Error).message}</p>}
      </details>

      <div>
        {s.messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {send.isPending && (
          <>
            <Row mine>{send.variables}</Row>
            <Row>StudilyBot is thinking…</Row>
          </>
        )}
        {finish.isPending && <Row>StudilyBot is writing your report…</Row>}
        <div ref={bottomRef} />
      </div>

      {(send.isError || finish.isError) && <p>{((send.error ?? finish.error) as Error).message}</p>}

      {active ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() && !busy) send.mutate(draft.trim());
            }}
          >
            <textarea
              value={draft}
              maxLength={4000}
              placeholder="Explain it in your own words…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={!draft.trim() || busy}>
              Send
            </button>
          </form>
          <button type="button" disabled={busy} onClick={() => finish.mutate()}>
            Finish and see my report
          </button>
        </>
      ) : (
        <p>Session complete · {s.score ?? 0}%</p>
      )}

      <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending}>
        Delete session
      </button>
    </div>
  );
}

function Row({ mine, children }: { mine?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "6px 0" }}>
      <div
        style={{
          maxWidth: "80%",
          padding: "6px 12px",
          borderRadius: 16,
          whiteSpace: "pre-wrap",
          background: mine ? "var(--accent)" : "var(--surface-hi)",
          color: mine ? "var(--accent-fg)" : "var(--fg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: FeynmanMessage }) {
  if (message.kind === "REPORT") {
    const report = parseReport(message.body);
    if (!report) return null;
    return (
      <Row>
        <strong>Your understanding: {report.score}%</strong>
        <p>{report.summary}</p>
        {report.strengths.length > 0 && (
          <>
            <p>What you explained well:</p>
            <ul>
              {report.strengths.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
        {report.gaps.length > 0 && (
          <>
            <p>Gaps to work on:</p>
            <ul>
              {report.gaps.map((g, i) => (
                <li key={i}>
                  <b>{g.concept}:</b> {g.detail}
                </li>
              ))}
            </ul>
          </>
        )}
        {report.concepts.length > 0 && (
          <>
            <p>By concept:</p>
            <ul>
              {report.concepts.map((c, i) => (
                <li key={i}>
                  {c.concept}: {c.score}%{c.didNotKnow ? " (didn't know at first)" : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </Row>
    );
  }
  return <Row mine={message.role === "USER"}>{message.body}</Row>;
}
