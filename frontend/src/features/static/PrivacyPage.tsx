import { Link } from "react-router-dom";
import { Page, Section } from "./shell";

export default function PrivacyPage() {
  return (
    <Page title="Privacy Policy" intro="Last updated July 3, 2026">
      <Section title="What we collect">
        <p>Studily stores the information you give it so the app can work:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><span className="font-medium text-fg">Account info</span> — name, email, username, and password (stored only as a secure hash).</li>
          <li><span className="font-medium text-fg">Profile info</span> — school, year, major, bio, and profile picture, if you choose to add them.</li>
          <li><span className="font-medium text-fg">Academic data</span> — your semesters, courses, class schedule, assignments, exams, and notes.</li>
          <li><span className="font-medium text-fg">Social data</span> — friend requests and friendships within the app.</li>
        </ul>
      </Section>

      <Section title="How it's used">
        <p>
          Your data is used <span className="font-medium text-fg">only to make Studily function</span> —
          showing your schedule, generating deadline reminders, and letting schoolmates find you if
          you list your school. It is <span className="font-medium text-fg">never sold or distributed
          to other services</span> for advertising or any other purpose.
        </p>
        <p>
          Parts of your profile (name, username, school, year, major, bio, and profile picture) are
          visible to other Studily users — for example on the schoolmates page. Your email, courses,
          notes, and assignments are private to you.
        </p>
      </Section>

      <Section title="Where it lives">
        <p>
          Data is stored in Studily's own database on our hosting provider. We use an error-tracking
          service (Sentry) to catch crashes and bugs; it is configured not to receive personal
          information. No analytics or advertising trackers are used.
        </p>
      </Section>

      <Section title="Future AI features">
        <p>
          In the future, Studily plans to add AI-powered study assistance. If you upload documents
          for it (assignments, lecture notes, and similar), those documents will be processed with
          an AI model to offer you help — for example answering questions about your own material.
          This will only apply to documents you explicitly provide to that feature, and this policy
          will be updated before it launches.
        </p>
      </Section>

      <Section title="Your agreement">
        <p>
          By signing up for Studily, you agree to this Privacy Policy and the{" "}
          <Link to="/terms" className="text-accent transition-colors hover:text-accent-2">
            Terms of Service
          </Link>
          . You can permanently delete your account and all of its data anytime from the Settings
          page. For any privacy questions, email{" "}
          <a href="mailto:ryannave97@gmail.com" className="text-accent transition-colors hover:text-accent-2">
            ryannave97@gmail.com
          </a>
          .
        </p>
      </Section>
    </Page>
  );
}
