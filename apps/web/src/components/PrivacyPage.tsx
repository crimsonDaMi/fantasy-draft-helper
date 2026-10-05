import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { getInstanceInfo, type InstanceInfo } from "../api/fantasy-api";
import { ErrorMessage } from "./ErrorMessage";

function ContactLink({ contact }: { contact: string }) {
  if (/^\S+@\S+\.\S+$/.test(contact)) {
    return <a href={`mailto:${contact}`}>{contact}</a>;
  }

  if (/^https?:\/\//.test(contact)) {
    return (
      <a href={contact} target="_blank" rel="noopener noreferrer">
        {contact}
      </a>
    );
  }

  return <>{contact}</>;
}

function OperatorDetails({ info }: { info: InstanceInfo }) {
  if (!info.operator) {
    return (
      <p>
        The operator of this instance hasn&apos;t provided their details. Please
        ask the person who shared this site with you who runs it.
      </p>
    );
  }

  const { name, contact, address } = info.operator;

  return (
    <p>
      This instance is run by <strong>{name}</strong>
      {address && <>, {address}</>}. Contact: <ContactLink contact={contact} />
    </p>
  );
}

function retentionText(days: number): string {
  if (days === 0) {
    return "until you delete your account yourself";
  }

  const years = days / 365;
  const approximately =
    years >= 1 && Number.isInteger(years)
      ? ` (${years} ${years === 1 ? "year" : "years"})`
      : "";

  return `until you delete your account, or automatically once it hasn't been used for ${days} days${approximately}`;
}

export function PrivacyPage() {
  const query = useQuery({
    queryKey: ["instance"],
    queryFn: getInstanceInfo,
  });

  const info = query.data;

  return (
    <article className="privacy-page">
      <Link to="/" className="privacy-page__back">
        ← Back to the app
      </Link>

      <h2>Privacy notice</h2>

      <section>
        <h3>Who is responsible</h3>
        {query.isPending && <p>Loading…</p>}
        {query.isError && (
          <ErrorMessage onRetry={() => void query.refetch()}>
            Couldn&apos;t load this instance&apos;s operator details.
          </ErrorMessage>
        )}
        {info && <OperatorDetails info={info} />}
        <p>
          Fantasy Draft Helper is open-source software that anyone can run
          themselves. Each instance is run by its own operator, who decides how
          it is hosted.
        </p>
      </section>

      <section>
        <h3>What is stored about you</h3>
        <ul>
          <li>
            <strong>Your account:</strong> your username, your password as a
            salted hash (the password itself can&apos;t be read back), when you
            registered and when you last used the app.
          </li>
          <li>
            <strong>Your rankings:</strong> the rankings you import or edit,
            with their tiers and watch/avoid flags.
          </li>
          <li>
            <strong>Your login:</strong> a session cookie that keeps you logged
            in. It is the only cookie, it is strictly necessary for logging in,
            and the server only stores a hash of it.
          </li>
        </ul>
        <p>
          This data is used only to provide your account and the app to you
          (Art. 6(1)(b) GDPR). It is never sold or shared.
        </p>
      </section>

      <section>
        <h3>Server logs</h3>
        <p>
          For each request, the server logs your IP address, the time, the
          address requested, and the result. These logs are used only to run the
          service and protect it from abuse (Art. 6(1)(f) GDPR), and are deleted
          automatically as newer entries replace them.
        </p>
      </section>

      <section>
        <h3>Stored only in your browser</h3>
        <p>
          To save you re-entering them, your browser&apos;s local storage keeps
          your color theme, the ranking you last selected, and the Sleeper
          username and draft you last looked up, and the last announcement you
          dismissed. You can remove them by clearing this site&apos;s data in
          your browser.
        </p>
      </section>

      <section>
        <h3>Sleeper</h3>
        <p>
          Draft data comes from Sleeper&apos;s public API. When you look up
          drafts by Sleeper username or follow a draft, this server asks Sleeper
          for it. Sleeper receives that username or draft ID, but not your IP
          address or account details. Player data and ADP are fetched by the
          server without any information about you.
        </p>
      </section>

      <section>
        <h3>No tracking</h3>
        <p>
          There are no analytics, ads, or tracking cookies, and your browser
          loads nothing from other sites: fonts and all other files come from
          this server. Links to other sites, such as &ldquo;Support me&rdquo;,
          only take you there when you click them.
        </p>
      </section>

      <section>
        <h3>How long data is kept</h3>
        <p>
          Your account and rankings are kept{" "}
          {info
            ? retentionText(info.accountRetentionDays)
            : "until you delete your account"}
          . Deleting an account removes all of its data. A login expires after
          30 days without use, and at most 90 days after you logged in.
        </p>
      </section>

      <section>
        <h3>Your rights</h3>
        <p>
          You can ask for access to your data, have it corrected or erased,
          restrict or object to its processing, and take it with you. You can
          delete your account yourself on the Account page (click your username
          after logging in), and download each ranking with &ldquo;Export
          CSV&rdquo; in the ranking editor. For anything else, contact the
          operator above. You also have the right to lodge a complaint with a
          data protection supervisory authority.
        </p>
      </section>
    </article>
  );
}
