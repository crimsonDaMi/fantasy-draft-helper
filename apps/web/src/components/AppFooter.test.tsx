import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppFooter } from "./AppFooter";

function renderFooter() {
  render(
    <MemoryRouter>
      <AppFooter />
    </MemoryRouter>,
  );
}

function hrefOf(name: string): URL {
  return new URL(
    screen.getByRole("link", { name }).getAttribute("href") ?? "",
    "http://localhost",
  );
}

describe("AppFooter", () => {
  afterEach(cleanup);

  it("links the bug report form with the app version filled in", () => {
    renderFooter();
    const url = hrefOf("Report a bug");
    expect(url.origin + url.pathname).toBe(
      "https://github.com/crimsonDaMi/fantasy-draft-helper/issues/new",
    );
    expect(url.searchParams.get("template")).toBe("bug_report.yml");
    expect(url.searchParams.get("version")).toBe(`v${__APP_VERSION__}`);
  });

  it("links the feature request form", () => {
    renderFooter();
    expect(hrefOf("Request a feature").searchParams.get("template")).toBe(
      "feature_request.yml",
    );
  });

  it("links the privacy notice and Ko-fi", () => {
    renderFooter();
    expect(hrefOf("Privacy").pathname).toBe("/privacy");
    expect(hrefOf("Support me").href).toBe("https://ko-fi.com/crimsonDaMi");
  });
});
