import { Page } from "./shell";

type Entry = {
  version: number;
  date: string;
  title: string;
  description: string;
};

const ENTRIES: Entry[] = [
  {
    version: 39,
    date: "2026-09-14",
    title: "Weights that match your grading scheme",
    description:
      "Course outlines hand you a grading scheme \u2014 Quizzes, Assignments and Labs 15%, Exam 1 25%, Project 10% \u2014 where one row covers a whole pile of work. Until now you had to do that arithmetic yourself and type a weight onto every single assignment. Every course page now has a Weights section holding those rows exactly as your outline prints them, each with a percentage and a colour. Put ten assignments under a row worth 15% and each one quietly counts for 1.5% of your final grade; add an eleventh and they all resplit on their own. A running total tells you when the scheme adds up to 100% and when it does not. The Assignment/Exam dropdown on an item has become one \u201cCounts as\u201d list holding Assignment and Exam plus every category you make \u2014 colour-coded down the item list and across the calendar. A category does not need a percentage: leave it blank and it is just a label like \u201cLab Assignment\u201d or \u201cGroup work\u201d, and those items keep whatever weight you give them individually. and the reader fills the whole thing in for you: hand it an outline and it comes back with the grading rows and every item already filed under the right one, for you to check before anything saves. Items you have already weighted yourself keep working exactly as they did. The course reader also takes pasted text now, so a grading scheme you copied off the course page is enough on its own \u2014 no file needed.",
  },
  {
    version: 38,
    date: "2026-09-11",
    title: "Fix an exam or assignment you got wrong",
    description:
      "Until now an exam or assignment was fixed the moment you added it \u2014 a typo in the title or the wrong due date meant deleting it and starting again, and deleting happened the instant you tapped the cross, with nothing asked. Every item now has an edit button on the course page and in Due this week: change the title, swap an assignment to an exam, move the date, set a room, adjust the weight or mark where it has got to. Items that repeat ask whether you mean just that one or the whole series, and an edit made in one place shows up everywhere else straight away instead of the calendar staying out of date. Deleting now asks first. In chat, the three dots that used to sit on every message you sent are gone on phones \u2014 hold a message instead and the options come up from the bottom of the screen.",
  },
  {
    version: 37,
    date: "2026-09-10",
    title: "Feed a course more documents as the semester goes",
    description:
      "Course outlines are rarely the whole story \u2014 the lab schedule shows up in week two, the syllabus gets revised, a handout lands with the project dates on it. Every course page now has Add from a document: drop the new file in and Studily reads it against the course you already have. It shows you what it found with anything already on the course ticked off and labelled, so you are only ever choosing between things that are actually new. Class times it has not seen and changes to the room, code or instructor are offered separately, and nothing is touched unless you tick it. The reader has also been taught to stop losing lab work: deliverables listed in an outline's Due column \u2014 Lab 1, Lab 2, Project \u2014 now come through as items dated from their own row, and anything it found but could not put a date on is handed to you with a blank date to fill in rather than quietly dropped.",
  },
  {
    version: 36,
    date: "2026-09-09",
    title: "Tell us how the outline reader did",
    description:
      "After you save a course that was filled in automatically, Studily now asks one question: did it get everything right, was it close but needing a few fixes, or did it get it wrong? It is three taps and you can skip it. What comes back gets pooled and shown on the Automatic card when you add a course, so before you hand it your outline you can see how often it has actually worked for other students rather than taking our word for it. The number only appears once enough people have answered for it to mean anything.",
  },
  {
    version: 35,
    date: "2026-09-09",
    title: "Notifications that arrive when they should",
    description:
      "Class reminders used to be timed against one fixed time zone, so if you were not on Eastern time they landed hours early — a reminder saying your class was in an hour when it was really in three. Studily now keeps track of the time zone your device is in and times every reminder against that. Class reminders have also moved closer in: instead of an hour ahead, you get one fifteen minutes before the class starts, which is about when it is useful. Message notifications were being held back whenever your phone still had a chat connection open in the background, which on a locked phone could mean waiting an hour to hear about a message. Studily now tells the difference between the app being open in front of you and the app merely being connected, so a message you are not there to see pushes straight through.",
  },
  {
    version: 34,
    date: "2026-09-08",
    title: "A softer, deeper look",
    description:
      "Studily has been rebuilt on a new surface style. The dark theme moves to a deeper navy with a faint glow behind everything, cards pick up a soft edge of light along their top, and panels that float above the page \u2014 menus, dialogs, the bar along the bottom on your phone \u2014 are now frosted, so what's underneath shows through. Things you press feel like it: buttons sit slightly raised and sink when tapped, text fields are gently recessed, and switches press in when you turn them on. If you preferred how it looked before, Settings \u203a Preferences \u203a Classic look puts the old flat design back, and it still follows your light and dark setting.",
  },
  {
    version: 33,
    date: "2026-09-08",
    title: "Build a course from your outline",
    description:
      "Adding a course now asks how you want to do it. Manual is the form you already know. Automatic (beta) lets you drop in your course outline as a PDF, a screenshot of the course page, or just pasted text, and it fills the form in for you \u2014 course name, code, instructor, room, weekly class times, and the assignments and exams from the schedule with their due dates and weights. It works out class times from a table of dates when the outline never spells the pattern out. Nothing saves until you have read it over: every field stays editable, you tick which deadlines to keep, and anything the reader was unsure about is flagged at the top. It gets things wrong sometimes, so give it a look before you hit save.",
  },
  {
    version: 32,
    date: "2026-09-06",
    title: "Choose who sees your schedule, and share it as an image",
    description:
      "Settings now has a schedule visibility control: keep your semester schedule to friends the way it has always worked, open it up to everyone on Studily, or make it private so nobody but you can see it. Profiles also gained a List/Week switch, so you can read a schedule as a day-by-day list or as the same time-block grid your dashboard uses. And on your own profile you can now copy your schedule as an image or save it to your camera roll \u2014 a clean dark card with your name, school and semester on it.",
  },
  {
    version: 31,
    date: "2026-08-30",
    title: "A guided setup checklist",
    description:
      "Setting up your first semester is now a checklist that keeps track of itself. It ticks off each step as you finish it, starts your semester in one tap with the usual dates filled in, and puts Canvas import right up front so one link can bring in your courses, assignments and exams together. Your dashboard shows how far along you are until it's done.",
  },
  {
    version: 30,
    date: "2026-08-19",
    title: "Edit, delete, and clear messages",
    description:
      "Hover a message you sent and tap the three dots to edit or delete it — edits show up for everyone with an \"edited\" mark, and deletes remove the message from the chat for both sides. The menu in the chat header also lets you clear a whole conversation from your own view, leaving your friend's copy untouched.",
  },
  {
    version: 29,
    date: "2026-08-18",
    title: "To-do list on your dashboard",
    description:
      "Your dashboard now has a to-do panel under the calendar showing the five tasks at the top of your list, including ones with no due date. Check anything off right from there, or jump to the full list.",
  },
  {
    version: 28,
    date: "2026-08-17",
    title: "To-do list",
    description:
      "Track anything that isn't a graded item: tasks with their own categories, priority, due date, notes, and a checklist of steps. Tasks due this week show up on your dashboard alongside your coursework.",
  },
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
