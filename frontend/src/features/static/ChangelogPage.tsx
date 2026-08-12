import { Page } from "./shell";

type Entry = {
  version: number;
  date: string;
  title: string;
  description: string;
};

const ENTRIES: Entry[] = [
  {
    version: 27,
    date: "2026-08-11",
    title: "Canvas import",
    description:
      "Import your Canvas calendar feed to pull assignments and due dates straight into your courses, without creating duplicates when you import again.",
  },
  {
    version: 26,
    date: "2026-08-11",
    title: "Message likes",
    description: "Double tap any message in a chat to like it.",
  },
  {
    version: 25,
    date: "2026-08-11",
    title: "Repeating items",
    description:
      "Calendar events, assignments and exams can repeat on a schedule instead of being added one date at a time.",
  },
  {
    version: 24,
    date: "2026-08-11",
    title: "Landing page and demo mode",
    description:
      "Added a public home page, and filled guest mode with a demo semester so you can try the app before signing up.",
  },
  {
    version: 23,
    date: "2026-08-07",
    title: "Lectures, labs and tutorials",
    description:
      "Split class times into lectures, labs and tutorials, each with its own meeting times and location.",
  },
  {
    version: 22,
    date: "2026-08-07",
    title: "Course locations",
    description: "Added a location to courses and showed it everywhere a course appears.",
  },
  {
    version: 21,
    date: "2026-08-07",
    title: "Google Calendar support",
    description:
      "Added Google Calendar support for .ics links, plus importing and exporting your Studily calendar as an .ics file.",
  },
  {
    version: 20,
    date: "2026-08-07",
    title: "Grade tracking",
    description:
      "Record scores on assignments and exams, and see your running grade per course and per semester.",
  },
  {
    version: 19,
    date: "2026-08-06",
    title: "Calendar categories",
    description:
      "Added your own colored categories for calendar events, and tapping a day now shows everything due on it.",
  },
  {
    version: 18,
    date: "2026-08-05",
    title: "Periodic table",
    description: "Added an interactive periodic table to the Learn tab.",
  },
  {
    version: 17,
    date: "2026-07-18",
    title: "Shared course catalog",
    description:
      "Courses added by students are shared with their school, with fuzzy search over schools and course codes.",
  },
  {
    version: 16,
    date: "2026-07-18",
    title: "Pomodoro timer",
    description:
      "Added a pomodoro timer that keeps running across the app, counts down in a banner, and notifies you when a phase ends.",
  },
  {
    version: 15,
    date: "2026-07-18",
    title: "Guest mode",
    description: "Browse the whole app read-only before making an account.",
  },
  {
    version: 14,
    date: "2026-07-17",
    title: "Chat attachments",
    description:
      "Send images and documents in direct messages and group chats, and open images in a full-screen viewer.",
  },
  {
    version: 13,
    date: "2026-07-13",
    title: "Account security",
    description:
      "Added email verification, password reset, password change, and account deletion.",
  },
  {
    version: 12,
    date: "2026-07-13",
    title: "Push notifications",
    description:
      "Added push notifications for messages, classes, events and due dates, with a settings page to control them.",
  },
  {
    version: 11,
    date: "2026-07-11",
    title: "Calendar events",
    description:
      "Added standalone calendar events, a detail and edit view, and adding one item across multiple dates.",
  },
  {
    version: 10,
    date: "2026-07-09",
    title: "Schedules on profiles",
    description: "Friends can see your current semester and weekly schedule on your profile.",
  },
  {
    version: 9,
    date: "2026-07-09",
    title: "Real-time messaging",
    description: "Messages now arrive instantly over a live connection instead of on a refresh.",
  },
  {
    version: 8,
    date: "2026-07-08",
    title: "Spaced repetition",
    description:
      "Flashcards now use the SM-2 algorithm to schedule reviews for the cards you keep getting wrong.",
  },
  {
    version: 7,
    date: "2026-07-07",
    title: "Profiles and user search",
    description: "Added profile pages and search so you can find other students by name or username.",
  },
  {
    version: 6,
    date: "2026-07-05",
    title: "Messaging",
    description: "Added direct messages and group chats with your friends.",
  },
  {
    version: 5,
    date: "2026-07-05",
    title: "Learn tab",
    description: "Added the Learn tab with flashcard sets and an AI study chat.",
  },
  {
    version: 4,
    date: "2026-07-03",
    title: "Friends and schoolmates",
    description:
      "Send friend requests, and see who else from your school is on Studily.",
  },
  {
    version: 3,
    date: "2026-07-03",
    title: "Install as an app",
    description:
      "Studily can be installed to your home screen and opened like a native app.",
  },
  {
    version: 2,
    date: "2026-06-30",
    title: "Weekly schedule",
    description:
      "Rebuilt the dashboard around a weekly grid with time-proportional class blocks and what is due this week.",
  },
  {
    version: 1,
    date: "2026-06-30",
    title: "Studily launch",
    description:
      "The first version: courses with meeting times, assignments and exams with due dates, semesters, and a monthly calendar.",
  },
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
      <ol className="space-y-3">
        {ENTRIES.map((entry) => (
          <li key={entry.version} className="card p-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[13px] font-semibold text-accent">v{entry.version}</span>
              <span className="text-fg-3">-</span>
              <h2 className="text-[15px] font-semibold text-fg">{entry.title}</h2>
              <span className="ml-auto text-[12px] text-fg-3">{formatDate(entry.date)}</span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{entry.description}</p>
          </li>
        ))}
      </ol>
    </Page>
  );
}
