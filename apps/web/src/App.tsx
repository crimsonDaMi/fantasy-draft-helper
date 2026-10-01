import { NavLink, Route, Routes } from "react-router";

import { AccountPage } from "./components/AccountPage";
import { DraftDashboard } from "./components/DraftDashboard";
import { RankingEditorPage } from "./components/RankingEditorPage";
import { ThemeSelect } from "./components/ThemeSelect";
import { LoginForm } from "./components/LoginForm";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./hooks/useAuth";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "app-nav__link app-nav__link--active" : "app-nav__link";
}

function App() {
  const [theme, setTheme] = useTheme();
  const auth = useAuth();

  if (auth.isLoading) {
    return null;
  }

  if (!auth.user) {
    return (
      <LoginForm
        error={auth.error}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    );
  }

  return (
    <main>
      <header className="app-header">
        <div className="app-header__top">
          <h1>Fantasy Draft Helper</h1>
          <div className="app-header__controls">
            <a
              className="app-header__support"
              href="https://ko-fi.com/crimsonDaMi"
              target="_blank"
              rel="noopener noreferrer"
            >
              Support me
            </a>
            <span className="app-header__version">v{__APP_VERSION__}</span>
            <ThemeSelect themeId={theme} onChange={setTheme} />
            <NavLink
              to="/account"
              className="app-header__user"
              title="Account settings"
            >
              {auth.user.username}
            </NavLink>
            <button
              type="button"
              className="header-button"
              onClick={() => void auth.logout()}
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={navLinkClass}>
            Draft
          </NavLink>
          <NavLink to="/rankings/edit" className={navLinkClass}>
            Edit rankings
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<DraftDashboard />} />
        <Route path="/rankings/edit" element={<RankingEditorPage />} />
        <Route
          path="/account"
          element={
            <AccountPage
              username={auth.user.username}
              onDeleteAccount={auth.deleteAccount}
            />
          }
        />
      </Routes>
    </main>
  );
}

export default App;
