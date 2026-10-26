import { Page } from "./shell";

type Entry = {
  version: number;
  date: string;
  summary: string;
};

const ENTRIES: Entry[] = [
  { version: 72, date: "2026-10-25", summary: "UI updates." },
  { version: 71, date: "2026-10-25", summary: "Added exam countdowns and study plans that spread your flashcards over the days before each exam." },
  { version: 70, date: "2026-10-25", summary: "Imported Canvas, Brightspace and Moodle calendars now stay in sync on their own." },
  { version: 69, date: "2026-10-25", summary: "Added flashcard folders and studying a whole folder or course at once." },
  { version: 68, date: "2026-10-25", summary: "Added a grades and GPA tracker with saved target grades and UVic, SFU and UBC GPA scales." },
  { version: 67, date: "2026-10-25", summary: "Added Brightspace and Moodle import alongside Canvas." },
  { version: 66, date: "2026-10-25", summary: "Added a calendar link you can subscribe to in Google or Apple Calendar so your deadlines show up there." },
  { version: 65, date: "2026-10-25", summary: "Added pages for UVic, SFU and UBC students that show how to bring in your Brightspace or Canvas calendar." },
  { version: 64, date: "2026-10-25", summary: "Made the grade calculator easier to find from the dashboard, course pages and the Study page." },
  { version: 63, date: "2026-10-25", summary: "Redesigned the Study page so your level, study sessions, flashcards, to-dos and tools fit on one screen." },
  { version: 62, date: "2026-10-24", summary: "Added an install prompt that shows what you get from installing Studily as an app." },
  { version: 61, date: "2026-10-23", summary: "Added a feedback survey. Answer it for a diamond chest and the Feedback badge." },
  { version: 60, date: "2026-10-19", summary: "Added reporting for profiles and messages." },
  { version: 59, date: "2026-10-18", summary: "Added replies to messages, plus copy, like and reply on everyone's messages." },
  { version: 58, date: "2026-10-18", summary: "Added eight new alarm sounds and separate focus and break alarms for study sessions." },
  { version: 57, date: "2026-10-18", summary: "Added making flashcards from your slides and notes." },
  { version: 56, date: "2026-10-15", summary: "Fixed copying messages and link previews in chats." },
  { version: 55, date: "2026-10-15", summary: "Flashcards can now have more than one line, and tapping a card image enlarges it." },
  { version: 54, date: "2026-10-15", summary: "Added progress tracking to flashcards." },
  { version: 53, date: "2026-10-14", summary: "Added seven new cosmetic badges to the shop." },
  { version: 52, date: "2026-10-14", summary: "Added 12 new profile flairs and gave the streak flairs real flames." },
  { version: 51, date: "2026-10-14", summary: "Added new chest art." },
  { version: 50, date: "2026-10-14", summary: "Added a welcome tour and a free diamond chest." },
  { version: 49, date: "2026-10-14", summary: "Added schedule screenshot import." },
  { version: 48, date: "2026-10-14", summary: "Added chest tiers, session summaries and a 10-minute check-in." },
  { version: 47, date: "2026-10-14", summary: "Added flashcard images, session pausing and editable session tasks." },
  { version: 46, date: "2026-10-13", summary: "Added Quizlet support." },
  { version: 45, date: "2026-10-09", summary: "Updated the streak flame." },
  { version: 44, date: "2026-10-08", summary: "Added profile flairs." },
  { version: 43, date: "2026-10-08", summary: "Added XP, levels, badges, coins, chests and study sessions." },
  { version: 42, date: "2026-10-02", summary: "Added new flashcard study modes and set sharing." },
  { version: 41, date: "2026-09-23", summary: "Added ten automatic course imports a month and fixed chat bugs." },
  { version: 40, date: "2026-09-16", summary: "Added custom weight colours and longer sign-ins." },
  { version: 39, date: "2026-09-14", summary: "Added grade weights that match your grading scheme." },
  { version: 38, date: "2026-09-11", summary: "Added editing for exams and assignments." },
  { version: 37, date: "2026-09-10", summary: "Added more documents to automatic course creation." },
  { version: 36, date: "2026-09-09", summary: "Added feedback for the course outline reader." },
  { version: 35, date: "2026-09-09", summary: "Fixed notification timing across time zones." },
  { version: 34, date: "2026-09-08", summary: "Refreshed the look of the app." },
  { version: 33, date: "2026-09-08", summary: "Added automatic course creation from outlines." },
  { version: 32, date: "2026-09-06", summary: "Added schedule visibility settings and schedule image sharing." },
  { version: 31, date: "2026-08-30", summary: "Added a guided setup checklist." },
  { version: 30, date: "2026-08-19", summary: "Added editing, deleting and clearing messages." },
  { version: 29, date: "2026-08-18", summary: "Added the to-do list to the dashboard." },
  { version: 28, date: "2026-08-17", summary: "Added a to-do list." },
  { version: 27, date: "2026-08-11", summary: "Added Canvas import." },
  { version: 26, date: "2026-08-11", summary: "Added message likes." },
  { version: 25, date: "2026-08-11", summary: "Added repeating items." },
  { version: 24, date: "2026-08-11", summary: "Added a landing page and demo mode." },
  { version: 23, date: "2026-08-07", summary: "Added lectures, labs and tutorials." },
  { version: 22, date: "2026-08-07", summary: "Added course locations." },
  { version: 21, date: "2026-08-07", summary: "Added Google Calendar support." },
  { version: 20, date: "2026-08-07", summary: "Added grade tracking." },
  { version: 19, date: "2026-08-06", summary: "Added calendar categories." },
  { version: 18, date: "2026-08-05", summary: "Added a periodic table." },
  { version: 17, date: "2026-07-18", summary: "Added a shared course catalog." },
  { version: 16, date: "2026-07-18", summary: "Added a Pomodoro timer." },
  { version: 15, date: "2026-07-18", summary: "Added guest mode." },
  { version: 14, date: "2026-07-17", summary: "Added chat attachments." },
  { version: 13, date: "2026-07-13", summary: "Added account security settings." },
  { version: 12, date: "2026-07-13", summary: "Added push notifications." },
  { version: 11, date: "2026-07-11", summary: "Added calendar events." },
  { version: 10, date: "2026-07-09", summary: "Added schedules to profiles." },
  { version: 9, date: "2026-07-09", summary: "Added real-time messaging." },
  { version: 8, date: "2026-07-08", summary: "Added spaced repetition for flashcards." },
  { version: 7, date: "2026-07-07", summary: "Added profiles and user search." },
  { version: 6, date: "2026-07-05", summary: "Added messaging." },
  { version: 5, date: "2026-07-05", summary: "Added the Learn tab." },
  { version: 4, date: "2026-07-03", summary: "Added friends and schoolmates." },
  { version: 3, date: "2026-07-03", summary: "Added installing Studily as an app." },
  { version: 2, date: "2026-06-30", summary: "Added the weekly schedule." },
  { version: 1, date: "2026-06-30", summary: "Launched Studily." },
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <Page title="Changelog" intro="Everything that's been added to Studily, newest first.">
      <ol className="space-y-2">
        {ENTRIES.map((entry) => (
          <li key={entry.version} className="card flex items-baseline gap-3 px-5 py-3.5">
            <span className="w-9 shrink-0 text-[13px] font-semibold tabular-nums text-accent">v{entry.version}</span>
            <p className="min-w-0 flex-1 text-[14px] text-fg">{entry.summary}</p>
            <span className="shrink-0 text-[12px] text-fg-3">{formatDate(entry.date)}</span>
          </li>
        ))}
      </ol>
    </Page>
  );
}
