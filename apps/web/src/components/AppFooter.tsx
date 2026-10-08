import { NavLink } from "react-router";

const NEW_ISSUE_URL =
  "https://github.com/crimsonDaMi/fantasy-draft-helper/issues/new";

// GitHub issue forms prefill a field from the query parameter named after
// its id, so the bug form's Version field arrives already filled in.
const BUG_REPORT_URL = `${NEW_ISSUE_URL}?template=bug_report.yml&version=${encodeURIComponent(`v${__APP_VERSION__}`)}`;
const FEATURE_REQUEST_URL = `${NEW_ISSUE_URL}?template=feature_request.yml`;

export function AppFooter() {
  return (
    <footer className="app-footer">
      <NavLink to="/privacy">Privacy</NavLink>
      <a href={BUG_REPORT_URL} target="_blank" rel="noopener noreferrer">
        Report a bug
      </a>
      <a href={FEATURE_REQUEST_URL} target="_blank" rel="noopener noreferrer">
        Request a feature
      </a>
      <a
        href="https://ko-fi.com/crimsonDaMi"
        target="_blank"
        rel="noopener noreferrer"
      >
        Support me
      </a>
    </footer>
  );
}
