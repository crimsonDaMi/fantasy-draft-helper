import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "./PasswordInput";

function ControlledPasswordInput({
  onSubmit = () => {},
}: {
  onSubmit?: () => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <PasswordInput
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-label="Your password"
        autoComplete="current-password"
      />
      <button type="submit">Submit</button>
    </form>
  );
}

const passwordField = () =>
  screen.getByLabelText<HTMLInputElement>("Your password");

describe("PasswordInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts masked, with a show button that isn't pressed", () => {
    render(<ControlledPasswordInput />);

    expect(passwordField()).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-controls", passwordField().id);
  });

  it("shows and hides the password", () => {
    render(<ControlledPasswordInput />);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(passwordField()).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);

    expect(passwordField()).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toBeInTheDocument();
  });

  it("doesn't submit the form when toggled", () => {
    const onSubmit = vi.fn();
    render(<ControlledPasswordInput onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("masks the password again when the form is submitted", () => {
    const onSubmit = vi.fn();
    render(<ControlledPasswordInput onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(passwordField()).toHaveAttribute("type", "password");
  });

  it("passes props through to the input", () => {
    render(<ControlledPasswordInput />);

    fireEvent.change(passwordField(), { target: { value: "secret123" } });

    expect(passwordField()).toHaveValue("secret123");
    expect(passwordField()).toHaveAttribute("autocomplete", "current-password");
  });

  it("uses a given id for the input", () => {
    render(<PasswordInput id="new-password" aria-label="New password" />);

    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "id",
      "new-password",
    );
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-controls", "new-password");
  });
});
