import { usePrepStore } from "../store/usePrepStore";
import type { KeyboardEvent } from "react";
import type { PrepItem as PrepItemModel } from "../models/PrepItem";
import type { PrepStatus } from "../models/PrepStatus";

type PrepItemCardProps = {
  item: PrepItemModel;
  canEdit?: boolean;
};

const statusLabel: Record<PrepItemModel["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  discarded: "Discarded",
};

const statusCycle: Record<PrepStatus, PrepStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
  discarded: "discarded",
};

const priorityLabel: Record<PrepItemModel["priority"], string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};

function PrepItem({ item, canEdit = true }: PrepItemCardProps) {
  const setStatus = usePrepStore((state) => state.setStatus);
  const setOnHand = usePrepStore((state) => state.setOnHand);
  const setParLevel = usePrepStore((state) => state.setParLevel);
  const setTargetQty = usePrepStore((state) => state.setTargetQty);
  const setPriority = usePrepStore((state) => state.setPriority);

  const handleStatusClick = () => {
    if (!canEdit) {
      return;
    }

    void setStatus(item.id, statusCycle[item.status]).catch((error) => {
      console.error("Failed to update prep item status:", error);
    });
  };

  const handleOnHandAdjust = (delta: number) => {
    if (!canEdit) {
      return;
    }

    void setOnHand(item.id, item.onHand + delta).catch((error) => {
      console.error("Failed to update on hand quantity:", error);
    });
  };

  const handleParLevelAdjust = (delta: number) => {
    if (!canEdit) {
      return;
    }

    void setParLevel(item.id, item.parLevel + delta).catch((error) => {
      console.error("Failed to update par level:", error);
    });
  };

  const handleTargetAdjust = (delta: number) => {
    if (!canEdit) {
      return;
    }

    void setTargetQty(item.id, item.targetQty + delta).catch((error) => {
      console.error("Failed to update target quantity:", error);
    });
  };

  const handlePriorityAdjust = (delta: number) => {
    if (!canEdit) {
      return;
    }

    void setPriority(item.id, (item.priority + delta) as PrepItemModel["priority"]).catch((error) => {
      console.error("Failed to update priority:", error);
    });
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleStatusClick();
      return;
    }

    const moveBackward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const moveForward = event.key === "ArrowRight" || event.key === "ArrowDown";

    if (!moveBackward && !moveForward) {
      return;
    }

    event.preventDefault();
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-prep-card='true']"));
    const currentIndex = cards.indexOf(event.currentTarget);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = moveBackward ? currentIndex - 1 : currentIndex + 1;
    const targetCard = cards[nextIndex];

    if (targetCard) {
      targetCard.focus();
    }
  };

  return (
    <article
      className="prep-card"
      aria-label={`Prep item ${item.name}. Status ${statusLabel[item.status]}. Priority ${priorityLabel[item.priority]}.`}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space"
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      data-prep-card="true"
    >
      <header className="prep-header">
        <h3 className="prep-name">{item.name}</h3>
        <button
          type="button"
          className={`status-pill status-${item.status}`}
          onClick={handleStatusClick}
          aria-label={`Status: ${statusLabel[item.status]}. Activate to advance status.`}
          style={{ cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.8 }}
          disabled={!canEdit}
        >
          {statusLabel[item.status]}
        </button>
      </header>

      <div className="prep-grid">
        <p className="prep-row">
          <span className="prep-key">Par Level</span>
          <span className="prep-value prep-value-controls">
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleParLevelAdjust(-1)}
              aria-label={`Decrease ${item.name} par level`}
              disabled={!canEdit}
            >
              -
            </button>
            <span>{item.parLevel} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleParLevelAdjust(1)}
              aria-label={`Increase ${item.name} par level`}
              disabled={!canEdit}
            >
              +
            </button>
          </span>
        </p>
        <p className="prep-row">
          <span className="prep-key">On Hand</span>
          <span className="prep-value prep-value-controls">
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleOnHandAdjust(-1)}
              aria-label={`Decrease ${item.name} on hand`}
              disabled={!canEdit}
            >
              -
            </button>
            <span>{item.onHand} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleOnHandAdjust(1)}
              aria-label={`Increase ${item.name} on hand`}
              disabled={!canEdit}
            >
              +
            </button>
          </span>
        </p>
        <p className="prep-row">
          <span className="prep-key">Target</span>
          <span className="prep-value prep-value-controls prep-value-strong">
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleTargetAdjust(-1)}
              aria-label={`Decrease ${item.name} target quantity`}
              disabled={!canEdit}
            >
              -
            </button>
            <span>{item.targetQty} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleTargetAdjust(1)}
              aria-label={`Increase ${item.name} target quantity`}
              disabled={!canEdit}
            >
              +
            </button>
          </span>
        </p>
        <p className="prep-row">
          <span className="prep-key">Priority</span>
          <span className="prep-value prep-value-controls">
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handlePriorityAdjust(1)}
              aria-label={`Lower ${item.name} priority`}
              disabled={!canEdit || item.priority >= 3}
            >
              -
            </button>
            <span>{priorityLabel[item.priority]}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handlePriorityAdjust(-1)}
              aria-label={`Raise ${item.name} priority`}
              disabled={!canEdit || item.priority <= 1}
            >
              +
            </button>
          </span>
        </p>
      </div>

      <footer className="prep-footer">
        <span className="prep-key">Assignee</span>
        <span className="prep-value">{item.assignedTo || "Unassigned"}</span>
      </footer>
    </article>
  );
}

export default PrepItem;