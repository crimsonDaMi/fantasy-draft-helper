import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

function renderLoginForm(error?: string) {
  const onLogin = vi.fn().mockResolvedValue(undefined);
  const onRegister = vi.fn().mockResolvedValue(undefined);
  render(<LoginForm error={error} onLogin={onLogin} onRegister={onRegister} />);
  return { onLogin, onRegister };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function openRegisterTab() {
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
}

function submit() {
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
}

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("logs in with a single password field", async () => {
    const { onLogin } = renderLoginForm();

    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "testuser" },
    });
    type("Password", "password123");
    submit();

    await waitFor(() =>
      expect(onLogin).toHaveBeenCalledWith("testuser", "password123"),
    );
  });

  it("asks for the password twice when registering", () => {
    renderLoginForm();

    openRegisterTab();

    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.getAllByRole("button", { name: "Show password" }),
    ).toHaveLength(2);
  });

  it("doesn't register when the passwords don't match", () => {
    const { onRegister } = renderLoginForm();
    openRegisterTab();
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "testuser" },
    });
    type("Password", "password123");
    type("Confirm password", "password124");

    submit();

    expect(onRegister).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords don't match.",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it.each(["Password", "Confirm password"])(
    "clears the mismatch message when %s changes",
    (label) => {
      renderLoginForm();
      openRegisterTab();
      type("Password", "password123");
      type("Confirm password", "password124");
      submit();

      type(label, "password1234");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
        "aria-invalid",
        "false",
      );
    },
  );

  it("shows the mismatch instead of an earlier server error", () => {
    renderLoginForm("An account with this username already exists.");
    openRegisterTab();
    type("Password", "password123");
    type("Confirm password", "password124");

    submit();

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords don't match.",
    );
  });

  it("registers when the passwords match", async () => {
    const { onRegister } = renderLoginForm();
    openRegisterTab();
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "testuser" },
    });
    type("Password", "password123");
    type("Confirm password", "password123");

    submit();

    await waitFor(() =>
      expect(onRegister).toHaveBeenCalledExactlyOnceWith(
        "testuser",
        "password123",
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the confirmation when switching tabs", () => {
    renderLoginForm();
    openRegisterTab();
    type("Confirm password", "password123");

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    openRegisterTab();

    expect(screen.getByLabelText("Confirm password")).toHaveValue("");
  });
});
