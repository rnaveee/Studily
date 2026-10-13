import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import SegmentedToggle from "../../components/SegmentedToggle";
import {
  detectFormat,
  parseQuizlet,
  type ParseResult,
  type QuizletFormat,
  type RowSep,
  type TermSep,
} from "./quizletImport";

const TERM_OPTIONS: { value: TermSep; label: string }[] = [
  { value: "tab", label: "Tab" },
  { value: "comma", label: "Comma" },
];

const ROW_OPTIONS: { value: RowSep; label: string }[] = [
  { value: "newline", label: "New line" },
  { value: "semicolon", label: "Semicolon" },
];

const STEPS = [
  "In Quizlet, open your set, tap the three-dot menu and choose Export.",
  "Pick Tab or Comma, and New line or Semicolon, then tap Copy text.",
  "Paste it below. Only the text comes across, not images.",
];

const PREVIEW_LIMIT = 200;

export default function QuizletPastePanel({
  onParsed,
  notices = [],
  autoFocus = false,
}: {
  onParsed: (result: ParseResult) => void;
  notices?: string[];
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<QuizletFormat | null>(null);
  const detected = useMemo(() => detectFormat(text), [text]);
  const format = override ?? detected;
  const result = useMemo(() => parseQuizlet(text, format), [text, format]);

  useEffect(() => {
    onParsed(result);
  }, [result, onParsed]);

  function changeText(value: string) {
    setText(value);
    if (!value.trim()) setOverride(null);
  }

  const hasText = text.trim().length > 0;
  const count = result.cards.length;

  return (
    <div className="space-y-4">
      <ol className="space-y-1.5 rounded-lg border border-line p-3" style={{ background: "var(--surface-hi)" }}>
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-fg-2">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-accent"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div>
        <label className="field-label" htmlFor="quizlet-paste">
          Quizlet export
        </label>
        <textarea
          id="quizlet-paste"
          className="input min-h-[140px]"
          value={text}
          onChange={(e) => changeText(e.target.value)}
          placeholder="Paste the text you copied from Quizlet"
          autoFocus={autoFocus}
          spellCheck={false}
        />
      </div>

      {hasText && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Between term and definition</label>
              <SegmentedToggle
                className="w-full"
                options={TERM_OPTIONS}
                value={format.term}
                onChange={(term) => setOverride({ ...format, term })}
              />
            </div>
            <div>
              <label className="field-label">Between cards</label>
              <SegmentedToggle
                className="w-full"
                options={ROW_OPTIONS}
                value={format.row}
                onChange={(row) => setOverride({ ...format, row })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] text-fg-2">
              <span className="font-semibold text-fg">
                {count} {count === 1 ? "card" : "cards"}
              </span>{" "}
              found
              {result.skipped > 0 &&
                ` · ${result.skipped} skipped because a side was empty or too long`}
            </p>

            {notices.length > 0 && (
              <ul className="space-y-1.5 rounded-lg border border-line p-3" style={{ background: "var(--surface-hi)" }}>
                {notices.map((notice, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-fg-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow" />
                    <span>{notice}</span>
                  </li>
                ))}
              </ul>
            )}

            {count > 0 ? (
              <ol className="max-h-72 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                {result.cards.slice(0, PREVIEW_LIMIT).map((card, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 rounded-lg p-2.5 text-[13px]"
                    style={{ background: "var(--surface-hi)" }}
                  >
                    <span className="w-6 shrink-0 pt-px text-right text-[11px] tabular-nums text-fg-3">{i + 1}</span>
                    <div className="min-w-0 flex-1 break-words">
                      <div className="whitespace-pre-line font-medium text-fg">{card.front}</div>
                      <div className="mt-0.5 whitespace-pre-line text-fg-2">{card.back}</div>
                    </div>
                  </li>
                ))}
                {count > PREVIEW_LIMIT && (
                  <li className="px-2.5 py-1 text-[12px] text-fg-3">and {count - PREVIEW_LIMIT} more</li>
                )}
              </ol>
            ) : (
              <p className="text-[12px] text-fg-3">
                No cards found. Check that the two settings above match what you picked in Quizlet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
