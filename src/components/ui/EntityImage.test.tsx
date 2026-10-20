import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityImage } from "@/components/ui/EntityImage";

describe("EntityImage", () => {
  it("renders an approved image with the entity treatment", () => {
    render(<EntityImage entityType="company" entitySlug="microsoft" name="Microsoft" src="https://example.com/microsoft.webp" />);
    const image = screen.getByRole("img", { name: "Microsoft logo" });
    expect(image).toHaveAttribute("src", "https://example.com/microsoft.webp");
    expect(image.closest("[data-entity-type]"))?.toHaveClass("rounded-full", "entity-image--company");
  });

  it("uses the existing generated fallback when no asset is approved", () => {
    render(<EntityImage entityType="speaker" entitySlug="sam-altman" name="Sam Altman" src={null} />);
    expect(screen.getByLabelText("Sam Altman image unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
