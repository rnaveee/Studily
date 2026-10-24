import { Link } from "react-router-dom";
import { Page, Section } from "./shell";

export default function NotFoundPage() {
  return (
    <Page title="Page not found" intro="That page doesn't exist, or it has moved.">
      <Section>
        <p>Check the address for typos, or head back to somewhere that does exist.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to="/" className="btn btn-primary">
            Go home
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            Open dashboard
          </Link>
        </div>
      </Section>
    </Page>
  );
}
