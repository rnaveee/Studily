import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Modal, { useModalClose } from "../../components/Modal";
import ChestIcon from "../progress/ChestIcon";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useWelcomeTourStep } from "../../lib/welcomeTour";
import type { SurveyDto } from "../../types";

const WHATS_NEW_KEY = "studily.whatsnew.progress.v2";
const OPEN_EVENT = "studily:survey-prompt";
const BADGE_ART = "https://badges.studily.ca/badges/v4";
const QUIET_PATHS = ["/survey", "/onboarding", "/profile/setup", "/welcome"];

export function openSurveyPrompt() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function seenKey(key: string) {
  return `studily.survey.prompt.${key}`;
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(seenKey(key), "1");
  } catch {
  }
}

export default function SurveyPrompt() {
  const { user, guest } = useAuth();
  const { pathname } = useLocation();
  const tourStep = useWelcomeTourStep();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [whatsNewSeen, setWhatsNewSeen] = useState(() => read(WHATS_NEW_KEY));

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    if (whatsNewSeen) return;
    const id = window.setInterval(() => {
      if (read(WHATS_NEW_KEY)) setWhatsNewSeen(true);
    }, 1500);
    return () => window.clearInterval(id);
  }, [whatsNewSeen]);

  const surveyQ = useQuery({
    queryKey: ["survey"],
    queryFn: () => api.get<SurveyDto>("/survey"),
    enabled: !!user && !guest && !!user.emailVerified,
  });
  const survey = surveyQ.data;
  const available = !!survey && survey.open && survey.eligible && !survey.completed;

  useEffect(() => {
    if (open || !user || guest || !survey || !available) return;
    if (survey.promptSeen || read(seenKey(survey.key))) return;
    if (tourStep !== null || user.welcomed === false || !whatsNewSeen) return;
    if (QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    setOpen(true);
  }, [open, user, guest, survey, available, tourStep, whatsNewSeen, pathname]);

  useEffect(() => {
    if (!open || !survey || survey.promptSeen) return;
    markSeen(survey.key);
    qc.setQueryData<SurveyDto>(["survey"], (old) => (old ? { ...old, promptSeen: true } : old));
    api.post<void>("/survey/prompt-seen").catch(() => {});
  }, [open, survey, qc]);

  if (!open || !survey || !available) return null;

  return (
    <Modal onClose={() => setOpen(false)} size="md" dismissOnBackdrop>
      <Body />
    </Modal>
  );
}

function Body() {
  const close = useModalClose();
  const navigate = useNavigate();
  const [badgeOk, setBadgeOk] = useState(true);

  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold text-fg">Want to help me out?</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-2">
        Complete a survey for Studily and earn a reward!
      </p>
      <div
        className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-4 rounded-2xl px-4 py-4"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 75%)",
        }}
      >
        <ChestIcon tier="DIAMOND" size={72} />
        {badgeOk && (
          <img
            src={`${BADGE_ART}/feedback.webp`}
            alt="Feedback badge"
            width={64}
            height={64}
            className="shrink-0"
            onError={() => setBadgeOk(false)}
          />
        )}
      </div>
      <p className="mt-2 text-[11px] text-fg-3">A diamond chest and the Feedback badge</p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            close();
            navigate("/survey");
          }}
        >
          Let's go!
        </button>
        <button type="button" className="btn btn-ghost w-full text-xs" onClick={close}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
