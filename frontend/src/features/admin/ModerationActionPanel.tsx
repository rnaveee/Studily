import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { REPORT_REASONS, formatReasons } from "../../lib/moderation";
import type { AdminModerationResult, ModerationActionType, ReportReason } from "../../types";

const TYPES: { value: ModerationActionType; label: string }[] = [
  { value: "WARNING", label: "Warning" },
  { value: "SUSPENSION", label: "Suspend" },
  { value: "BAN", label: "Ban" },
];

const DAY_CHIPS = [1, 3, 7, 30];

export default function ModerationActionPanel({
  userId,
  username,
  defaultReasons,
  reportIds,
  deletableMessageIds,
  hasAvatar,
  hasBio,
  onDone,
}: {
  userId: number;
  username: string;
  defaultReasons: ReportReason[];
  reportIds: number[];
  deletableMessageIds: number[];
  hasAvatar: boolean;
  hasBio: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [type, setType] = useState<ModerationActionType>("WARNING");
  const [days, setDays] = useState(7);
  const [reasons, setReasons] = useState<ReportReason[]>(defaultReasons);
  const [note, setNote] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clearBio, setClearBio] = useState(false);
  const [deleteMessages, setDeleteMessages] = useState(false);

  const defaultsKey = defaultReasons.join(",");
  useEffect(() => {
    setReasons(defaultReasons);
  }, [defaultsKey]);

  const daysValid = Number.isInteger(days) && days >= 1 && days <= 365;
  const valid = reasons.length > 0 && (type !== "SUSPENSION" || daysValid);
  const messageIds = deleteMessages ? deletableMessageIds : [];

  const apply = useMutation({
    mutationFn: () =>
      api.post<AdminModerationResult>(`/admin/users/${userId}/moderation`, {
        type,
        days: type === "SUSPENSION" ? days : undefined,
        reasons,
        note: note.trim() || undefined,
        removeAvatar: removeAvatar && hasAvatar,
        clearBio: clearBio && hasBio,
        deleteMessageIds: messageIds,
        reportIds,
      }),
    onSuccess: (res) => {
      toast.success(
        res.deletedMessages > 0 ? `Done. ${res.deletedMessages} message(s) deleted` : "Done",
      );
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "report-case", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      onDone();
    },
  });

  function toggleReason(r: ReportReason) {
    setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function submit() {
    const why = formatReasons(reasons);
    const extras = [
      removeAvatar && hasAvatar ? "remove their profile picture" : null,
      clearBio && hasBio ? "clear their bio" : null,
      messageIds.length > 0 ? `delete ${messageIds.length} message${messageIds.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const extraText = extras.length > 0 ? ` This will also ${extras.join(", ")}.` : "";
    let title: string;
    let message: string;
    if (type === "WARNING") {
      title = `Warn @${username}?`;
      message = `Send @${username} a warning for ${why}?${extraText}`;
    } else if (type === "SUSPENSION") {
      title = `Suspend @${username}?`;
      message = `Suspend @${username} for ${days} day${days === 1 ? "" : "s"} for ${why}? Their sessions and chats will close immediately.${extraText}`;
    } else {
      title = `Ban @${username}?`;
      message = `Ban @${username} indefinitely for ${why}? Their sessions and chats will close immediately and their email can't be used to sign up again.${extraText}`;
    }
    const ok = await confirm({
      title,
      message,
      confirmLabel: type === "WARNING" ? "Send warning" : type === "SUSPENSION" ? "Suspend" : "Ban",
      danger: type !== "WARNING",
    });
    if (ok) apply.mutate();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Action">
        {TYPES.map((t) => {
          const active = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(t.value)}
              className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "text-accent" : "border-line text-fg hover:bg-surface-hi"
              }`}
              style={
                active
                  ? {
                      borderColor: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                    }
                  : undefined
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {type === "SUSPENSION" && (
        <div>
          <span className="field-label">Duration (days)</span>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`btn ${days === d ? "btn-primary" : "btn-ghost"}`}
              >
                {d}
              </button>
            ))}
            <input
              className="input"
              style={{ width: 90 }}
              type="number"
              min={1}
              max={365}
              aria-label="Custom days"
              value={Number.isFinite(days) ? days : ""}
              onChange={(e) => setDays(e.target.value === "" ? NaN : Number(e.target.value))}
            />
          </div>
          {!daysValid && <p className="mt-1 text-[11px] text-red">Enter 1 to 365 days.</p>}
        </div>
      )}

      <fieldset>
        <legend className="field-label">Reasons</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-[12px] text-fg-2">
              <input
                type="checkbox"
                checked={reasons.includes(r.value)}
                onChange={() => toggleReason(r.value)}
                style={{ accentColor: "var(--accent)" }}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="field-label" htmlFor={`mod-note-${userId}`}>Note (shown to the user)</label>
        <textarea
          id={`mod-note-${userId}`}
          className="input min-h-[72px]"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className={`flex items-center gap-2 text-[12px] ${hasAvatar ? "text-fg-2" : "text-fg-3"}`}>
          <input
            type="checkbox"
            disabled={!hasAvatar}
            checked={removeAvatar && hasAvatar}
            onChange={(e) => setRemoveAvatar(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Remove profile picture
        </label>
        <label className={`flex items-center gap-2 text-[12px] ${hasBio ? "text-fg-2" : "text-fg-3"}`}>
          <input
            type="checkbox"
            disabled={!hasBio}
            checked={clearBio && hasBio}
            onChange={(e) => setClearBio(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Clear bio
        </label>
        <label
          className={`flex items-center gap-2 text-[12px] ${deletableMessageIds.length > 0 ? "text-fg-2" : "text-fg-3"}`}
        >
          <input
            type="checkbox"
            disabled={deletableMessageIds.length === 0}
            checked={deleteMessages && deletableMessageIds.length > 0}
            onChange={(e) => setDeleteMessages(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Delete reported messages ({deletableMessageIds.length})
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!valid || apply.isPending}
        className={`btn w-full ${type === "WARNING" ? "btn-primary" : "btn-danger"}`}
      >
        {apply.isPending
          ? "Applying…"
          : type === "WARNING"
            ? "Send warning"
            : type === "SUSPENSION"
              ? "Suspend user"
              : "Ban user"}
      </button>
    </div>
  );
}
