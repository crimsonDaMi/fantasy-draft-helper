import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountPage } from "./AccountPage";

function renderAccountPage(
  onDeleteAccount: (password: string) => Promise<void>,
) {
  render(
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route path="/" element={<p>Start page</p>} />
        <Route
          path="/account"
          element={
            <AccountPage
              username="testuser"
              onChangePassword={vi.fn()}
              onDeleteAccount={onDeleteAccount}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function submitPassword(password: string) {
  fireEvent.change(screen.getByLabelText("Your password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
}

describe("AccountPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the delete button disabled until a password is entered", () => {
    renderAccountPage(vi.fn());

    expect(
      screen.getByRole("button", { name: "Delete my account" }),
    ).toBeDisabled();
  });

  it("deletes with the entered password and returns to the start page", async () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    renderAccountPage(onDeleteAccount);

    submitPassword("correct horse battery");

    await waitFor(() =>
      expect(screen.getByText("Start page")).toBeInTheDocument(),
    );
    expect(onDeleteAccount).toHaveBeenCalledWith("correct horse battery");
  });

  it("shows the error and stays on the page when deleting fails", async () => {
    renderAccountPage(
      vi.fn().mockRejectedValue(new Error("Incorrect password.")),
    );

    submitPassword("wrong password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect password.",
    );
    expect(
      screen.getByRole("button", { name: "Delete my account" }),
    ).toBeEnabled();
  });
});
