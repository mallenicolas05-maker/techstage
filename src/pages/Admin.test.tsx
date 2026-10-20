import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Admin from "@/pages/Admin";
import { ToastProvider } from "@/components/ui/toast";

describe("live admin access", () => {
  it("opens without the temporary email sign-in screen", async () => {
    render(<MemoryRouter><ToastProvider><Admin /></ToastProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "TechStage operations desk" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Admin email" })).not.toBeInTheDocument();
  });
});
