import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Circle, Coins, Sparkles } from "lucide-react";
import Modal, { useModalClose } from "../../../components/Modal";
import { Skeleton } from "../../../components/Skeleton";
import { api } from "../../../lib/api";
import { offerChests, releaseProgressMoments } from "../../../lib/progressDelta";
import { toast } from "../../../lib/toast";
import ChestIcon from "../../progress/ChestIcon";
import { CHEST_TIER_LABEL } from "../../progress/badges";
import StreakFlame from "../../progress/StreakFlame";
import { useStreakWeek } from "../../progress/useProgress";
import cheers from "./sessionCheers.json";
import { formatMinutes } from "./sessionFormat";
import type { StudySessionRecap } from "../../../types";

type Slide = "cheer" | "rewards" | "tasks";

export default function SessionSummaryModal({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const recap = useQuery({
    queryKey: ["study-session", "recap", sessionId],
    queryFn: () => api.get<StudySessionRecap>(`/study-sessions/${sessionId}/recap`),
    staleTime: Infinity,
  });

  function finish() {
    releaseProgressMoments();
    if (recap.data) offerChests(recap.data.chests);
    onClose();
  }

  return (
    <Modal onClose={finish} size="sm" showClose={false}>
      {recap.data ? (
        <SummaryFlow recap={recap.data} />
      ) : recap.isError ? (
        <ErrorState />
      ) : (
        <LoadingState />
      )}
    </Modal>
  );
}

function SummaryFlow({ recap }: { recap: StudySessionRecap }) {
  const close = useModalClose();
  const session = recap.session;
  const unfinished = session.tasks
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((t) => !t.done)
    .map((t) => t.text);
  const slides: Slide[] = unfinished.length > 0 ? ["cheer", "rewards", "tasks"] : ["cheer", "rewards"];
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const last = index === slides.length - 1;
  const hasChests = recap.chests.length > 0;

  return (
    <div className="flex flex-col pt-2">
      <div key={slide} className="min-h-[260px] animate-in">
        {slide === "cheer" && <CheerSlide recap={recap} />}
        {slide === "rewards" && <RewardsSlide recap={recap} />}
        {slide === "tasks" && <TasksSlide tasks={unfinished} />}
      </div>

      <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
        {slides.map((s, i) => (
          <span
            key={s}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === index ? 18 : 6, background: i === index ? "var(--accent)" : "var(--surface-hi)" }}
          />
        ))}
      </div>

      {slide === "tasks" ? (
        <TaskButtons tasks={unfinished} />
      ) : (
        <div className="mt-5 flex gap-2">
          {index > 0 ? (
            <button onClick={() => setIndex((i) => i - 1)} className="btn btn-ghost btn-lg" style={{ minHeight: 44 }}>
              <ArrowLeft size={15} />
              Back
            </button>
          ) : null}
          <button
            onClick={() => (last ? close() : setIndex((i) => i + 1))}
            className="btn btn-primary btn-lg flex-1"
            style={{ minHeight: 44 }}
            autoFocus
          >
            {last ? (hasChests ? (recap.chests.length === 1 ? "Open chest" : "Open chests") : "Done") : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

function CheerSlide({ recap }: { recap: StudySessionRecap }) {
  const session = recap.session;
  const streak = useStreakWeek();
  const short = session.creditedMinutes === 0;
  const [line] = useState(() => {
    const bank = short ? cheers.short : cheers.done;
    return bank[Math.floor(Math.random() * bank.length)];
  });
  const confirmed = session.blocks.filter((b) => b.status === "CONFIRMED").length;
  const todayCounts = streak.data?.week.some((d) => d.isToday && d.qualified) ?? false;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {session.status === "COMPLETED" ? "Session complete" : "Session over"}
      </p>
      <h2 className="display mt-2 text-[22px] font-bold leading-snug text-fg">{line}</h2>

      <div
        className="mt-6 w-full rounded-2xl px-4 py-5"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}
      >
        <p className="text-[12px] font-medium text-fg-3">You studied</p>
        <p className="mt-1 text-[40px] font-bold leading-none tabular-nums text-fg">
          {formatMinutes(session.creditedMinutes)}
        </p>
        <p className="mt-2 text-[12.5px] text-fg-2">
          {confirmed} of {session.plannedBlocks} {session.plannedBlocks === 1 ? "block" : "blocks"} checked in
        </p>
      </div>

      {todayCounts && streak.data && (
        <div className="mt-4 flex items-center gap-2 text-[13px] font-medium text-fg-2">
          <StreakFlame streak={streak.data.current} size={28} />
          Today counts toward your {streak.data.current}-day streak
        </div>
      )}
    </div>
  );
}

function RewardsSlide({ recap }: { recap: StudySessionRecap }) {
  const session = recap.session;
  const confirmed = session.blocks.filter((b) => b.status === "CONFIRMED").length;
  const nothing = session.xpAwarded === 0 && recap.coinsAwarded === 0 && recap.chests.length === 0;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Rewards</p>
      <h2 className="display mt-2 text-[22px] font-bold text-fg">{nothing ? "No rewards this time" : "Here's what you earned"}</h2>

      <ul className="mt-5 w-full space-y-2">
        {session.xpAwarded > 0 && (
          <RewardRow icon={<Sparkles size={16} />} color="var(--accent)" label={`+${session.xpAwarded} XP`} />
        )}
        {recap.coinsAwarded > 0 && (
          <RewardRow icon={<Coins size={16} />} color="var(--yellow)" tint="var(--amber-vivid)" label={`+${recap.coinsAwarded} coins`} />
        )}
      </ul>

      {recap.chests.length > 0 ? (
        <div className="mt-4 w-full">
          <p className="text-[12px] font-medium text-fg-3">
            {recap.chests.length === 1 ? "1 chest" : `${recap.chests.length} chests`}
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-3">
            {recap.chests.map((c) => (
              <li key={c.id} className="flex w-[76px] flex-col items-center gap-1.5">
                <ChestIcon tier={c.tier} size={60} opened={!!c.openedAt} />
                <span className="text-[11px] font-medium leading-tight text-fg-2">{CHEST_TIER_LABEL[c.tier]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] leading-snug text-fg-3">
          {confirmed === 0
            ? "Check in when a block ends to earn chests."
            : "You've earned chests from 3 sessions today. More tomorrow!"}
        </p>
      )}
    </div>
  );
}

function RewardRow({ icon, color, tint = color, label }: { icon: ReactNode; color: string; tint?: string; label: string }) {
  return (
    <li
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color }}
      >
        {icon}
      </span>
      <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
        {label}
      </span>
    </li>
  );
}

function TasksSlide({ tasks }: { tasks: string[] }) {
  return (
    <div className="flex flex-col">
      <h2 className="text-center text-[18px] font-semibold text-fg">You have unfinished work</h2>
      <p className="mt-1 text-center text-[13px] text-fg-2">Add {tasks.length === 1 ? "it" : "them"} to your todo list?</p>
      <ul className="mt-4 space-y-1.5">
        {tasks.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-fg">
            <Circle size={14} className="mt-[3px] shrink-0 text-fg-3" />
            <span className="min-w-0 break-words">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskButtons({ tasks }: { tasks: string[] }) {
  const qc = useQueryClient();
  const close = useModalClose();
  const [saving, setSaving] = useState(false);

  async function addAll() {
    setSaving(true);
    const results = await Promise.allSettled(
      tasks.map((title) => api.post("/todos", { title, priority: "MEDIUM", checklist: [] })),
    );
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    const added = results.filter((r) => r.status === "fulfilled").length;
    if (added === tasks.length) {
      toast.success(added === 1 ? "Added 1 task to your todo list" : `Added ${added} tasks to your todo list`);
    } else if (added > 0) {
      toast.error(`Added ${added} of ${tasks.length} tasks. Some couldn't be saved.`);
    } else {
      toast.error("Couldn't add your tasks to the todo list");
    }
    close();
  }

  return (
    <div className="mt-5 flex gap-2">
      <button onClick={close} disabled={saving} className="btn btn-ghost btn-lg flex-1" style={{ minHeight: 44 }}>
        I'm okay
      </button>
      <button onClick={addAll} disabled={saving} className="btn btn-primary btn-lg flex-1" style={{ minHeight: 44 }} autoFocus>
        {saving ? "Adding…" : "Do it"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center gap-3 pt-4" aria-hidden="true">
      <Skeleton width={120} height={10} />
      <Skeleton width={220} height={22} />
      <Skeleton height={110} className="mt-4 w-full rounded-2xl" />
    </div>
  );
}

function ErrorState() {
  const close = useModalClose();
  return (
    <div className="flex flex-col items-center pt-3 text-center">
      <h2 className="text-[18px] font-semibold text-fg">Session over</h2>
      <p className="mt-1 text-[13px] text-fg-3">Couldn't load your summary. Your XP and chests are saved.</p>
      <button onClick={close} className="btn btn-primary btn-lg mt-5 w-full" style={{ minHeight: 44 }}>
        Done
      </button>
    </div>
  );
}
