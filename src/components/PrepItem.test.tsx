/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import PrepItem from "./PrepItem";
import type { PrepItem as PrepItemModel } from "../models/PrepItem";
import { usePrepStore } from "../store/usePrepStore";

jest.mock("../store/usePrepStore", () => ({
  usePrepStore: jest.fn(),
}));

const mockedUsePrepStore = usePrepStore as unknown as jest.Mock;

const baseItem: PrepItemModel = {
  id: "prep-1",
  name: "Tomato Sauce",
  parLevel: 20,
  onHand: 12,
  targetQty: 18,
  unit: "cup",
  priority: 2,
  status: "todo",
  assignedTo: "Alex",
};

describe("PrepItem", () => {
  let mockSetStatus: jest.Mock;
  let mockSetOnHand: jest.Mock;
  let mockSetParLevel: jest.Mock;
  let mockSetTargetQty: jest.Mock;
  let mockSetPriority: jest.Mock;

  beforeEach(() => {
    mockSetStatus = jest.fn().mockResolvedValue(undefined);
    mockSetOnHand = jest.fn().mockResolvedValue(undefined);
    mockSetParLevel = jest.fn().mockResolvedValue(undefined);
    mockSetTargetQty = jest.fn().mockResolvedValue(undefined);
    mockSetPriority = jest.fn().mockResolvedValue(undefined);

    const storeState = {
      setStatus: mockSetStatus,
      setOnHand: mockSetOnHand,
      setParLevel: mockSetParLevel,
      setTargetQty: mockSetTargetQty,
      setPriority: mockSetPriority,
    };

    mockedUsePrepStore.mockImplementation((selector: (state: typeof storeState) => unknown) =>
      selector(storeState),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders prep item content", () => {
    render(<PrepItem item={baseItem} />);

    expect(
      screen.getByLabelText("Prep item Tomato Sauce. Status To do. Priority Medium."),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tomato Sauce" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Status: To do. Activate to advance status." })).toBeTruthy();
    expect(screen.getByText("20 cup")).toBeTruthy();
    expect(screen.getByText("12 cup")).toBeTruthy();
    expect(screen.getByText("18 cup")).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.getByText("Alex")).toBeTruthy();
  });

  test("advances status when status pill is clicked", () => {
    render(<PrepItem item={baseItem} />);

    fireEvent.click(screen.getByRole("button", { name: "Status: To do. Activate to advance status." }));

    expect(mockSetStatus).toHaveBeenCalledWith("prep-1", "in_progress");
  });

  test("supports keyboard status advance from card focus", () => {
    render(<PrepItem item={baseItem} />);

    const card = screen.getByLabelText("Prep item Tomato Sauce. Status To do. Priority Medium.");
    (card as HTMLElement).focus();
    fireEvent.keyDown(card, { key: "Enter" });

    expect(mockSetStatus).toHaveBeenCalledWith("prep-1", "in_progress");
  });

  test("moves focus between cards with arrow keys", () => {
    render(
      <>
        <PrepItem item={baseItem} />
        <PrepItem item={{ ...baseItem, id: "prep-2", name: "Chili Base" }} />
      </>,
    );

    const firstCard = screen.getByLabelText("Prep item Tomato Sauce. Status To do. Priority Medium.");
    const secondCard = screen.getByLabelText("Prep item Chili Base. Status To do. Priority Medium.");

    (firstCard as HTMLElement).focus();
    fireEvent.keyDown(firstCard, { key: "ArrowRight" });

    expect(document.activeElement).toBe(secondCard);

    fireEvent.keyDown(secondCard, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(firstCard);
  });

  test("adjusts prep quantities and priority", () => {
    render(<PrepItem item={baseItem} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Tomato Sauce on hand" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Tomato Sauce par level" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Tomato Sauce target quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Raise Tomato Sauce priority" }));
    fireEvent.click(screen.getByRole("button", { name: "Lower Tomato Sauce priority" }));

    expect(mockSetOnHand).toHaveBeenCalledWith("prep-1", 13);
    expect(mockSetParLevel).toHaveBeenCalledWith("prep-1", 19);
    expect(mockSetTargetQty).toHaveBeenCalledWith("prep-1", 19);
    expect(mockSetPriority).toHaveBeenCalledWith("prep-1", 1);
    expect(mockSetPriority).toHaveBeenCalledWith("prep-1", 3);
  });

  test("disables all actions when canEdit is false", () => {
    render(<PrepItem item={baseItem} canEdit={false} />);

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }

    fireEvent.click(screen.getByRole("button", { name: "Status: To do. Activate to advance status." }));

    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(mockSetOnHand).not.toHaveBeenCalled();
    expect(mockSetParLevel).not.toHaveBeenCalled();
    expect(mockSetTargetQty).not.toHaveBeenCalled();
    expect(mockSetPriority).not.toHaveBeenCalled();
  });

  test("disables priority controls at the boundaries", () => {
    const { rerender } = render(<PrepItem item={{ ...baseItem, priority: 1 }} />);

    expect(
      (screen.getByRole("button", { name: "Raise Tomato Sauce priority" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(<PrepItem item={{ ...baseItem, priority: 3 }} />);

    expect(
      (screen.getByRole("button", { name: "Lower Tomato Sauce priority" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("shows fallback assignee text when not assigned", () => {
    render(<PrepItem item={{ ...baseItem, assignedTo: undefined }} />);

    expect(screen.getByText("Unassigned")).toBeTruthy();
  });
});