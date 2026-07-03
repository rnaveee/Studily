import { Link } from "react-router-dom";
import { Page, Section } from "./shell";

export default function TermsPage() {
  return (
    <Page title="Terms of Service" intro="Last updated July 3, 2026">
      <Section title="1. Accepting these terms">
        <p>
          By creating an account or using Studily, you agree to these Terms of Service and to the{" "}
          <Link to="/privacy" className="text-accent transition-colors hover:text-accent-2">
            Privacy Policy
          </Link>
          . If you don't agree with them, please don't use the app.
        </p>
      </Section>

      <Section title="2. Who can use Studily">
        <p>
          You must be at least <span className="font-medium text-fg">13 years old</span> to use
          Studily. By signing up, you confirm that you meet this requirement.
        </p>
        <p>
          You're responsible for your account: keep your password private, and use accurate
          information on your profile. Don't impersonate other people or create accounts for
          anyone but yourself.
        </p>
      </Section>

      <Section title="3. Acceptable use">
        <p>Studily is for academic planning. When using it — especially in profiles, notes, and anything visible to schoolmates and friends — you agree not to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>post content that is hateful, harassing, threatening, sexually explicit, or otherwise abusive;</li>
          <li>bully, intimidate, or target other users;</li>
          <li>share content that is illegal or encourages illegal activity;</li>
          <li>spam, mislead, or impersonate others;</li>
          <li>attempt to break, probe, or gain unauthorized access to the service or other users' data.</li>
        </ul>
      </Section>

      <Section title="4. Warnings and bans">
        <p>
          Breaking these rules can result in a <span className="font-medium text-fg">warning</span>,
          removal of the offending content, temporary suspension, or a{" "}
          <span className="font-medium text-fg">permanent ban</span>, depending on severity. Serious
          violations may be acted on immediately and without prior warning.
        </p>
      </Section>

      <Section title="5. The service">
        <p>
          Studily is provided <span className="font-medium text-fg">"as is"</span>, free of charge,
          and is currently in beta. Things may break, change, or be unavailable at times, and
          features may be added or removed as the app evolves. Always verify important academic
          dates against your official school sources.
        </p>
      </Section>

      <Section title="6. Changes and contact">
        <p>
          These terms may be updated as Studily grows; meaningful changes will be reflected on this
          page. Questions? Email{" "}
          <a href="mailto:ryannave97@gmail.com" className="text-accent transition-colors hover:text-accent-2">
            ryannave97@gmail.com
          </a>
          .
        </p>
      </Section>
    </Page>
  );
}
