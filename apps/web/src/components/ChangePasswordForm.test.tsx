import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "./ChangePasswordForm";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillAndSubmit(current: string, next: string, confirm = next) {
  type("Current password", current);
  type("New password", next);
  type("Confirm new password", confirm);
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ChangePasswordForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("changes the password, clears the fields and confirms", async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    render(<ChangePasswordForm onChangePassword={onChangePassword} />);

    fillAndSubmit("correct horse battery", "new password1");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Password changed.",
    );
    expect(onChangePassword).toHaveBeenCalledExactlyOnceWith(
      "correct horse battery",
      "new password1",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("doesn't submit when the new passwords don't match", () => {
    const onChangePassword = vi.fn();
    render(<ChangePasswordForm onChangePassword={onChangePassword} />);

    fillAndSubmit("correct horse battery", "new password1", "new password2");

    expect(onChangePassword).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords don't match.",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    type("Confirm new password", "new password1");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error and keeps the input when the change fails", async () => {
    render(
      <ChangePasswordForm
        onChangePassword={vi
          .fn()
          .mockRejectedValue(new Error("Incorrect password."))}
      />,
    );

    fillAndSubmit("wrong password", "new password1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect password.",
    );
    expect(screen.getByLabelText("New password")).toHaveValue("new password1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeEnabled();
  });

  it("applies the registration length limits to the new password", () => {
    render(<ChangePasswordForm onChangePassword={vi.fn()} />);

    for (const label of ["New password", "Confirm new password"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("minlength", "8");
      expect(screen.getByLabelText(label)).toHaveAttribute("maxlength", "128");
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
    }
    expect(screen.getByLabelText("Current password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });
});
