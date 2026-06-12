import { usePrepStore } from "../store/usePrepStore";
import type { PrepItem as PrepItemModel } from "../models/PrepItem";
import type { PrepStatus } from "../models/PrepStatus";

type PrepItemCardProps = {
  item: PrepItemModel;
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

function PrepItem({ item }: PrepItemCardProps) {
  const setStatus = usePrepStore((state) => state.setStatus);
  const setOnHand = usePrepStore((state) => state.setOnHand);
  const setParLevel = usePrepStore((state) => state.setParLevel);
  const setTargetQty = usePrepStore((state) => state.setTargetQty);
  const setPriority = usePrepStore((state) => state.setPriority);

  const handleStatusClick = () => {
    void setStatus(item.id, statusCycle[item.status]).catch((error) => {
      console.error("Failed to update prep item status:", error);
    });
  };

  const handleOnHandAdjust = (delta: number) => {
    void setOnHand(item.id, item.onHand + delta).catch((error) => {
      console.error("Failed to update on hand quantity:", error);
    });
  };

  const handleParLevelAdjust = (delta: number) => {
    void setParLevel(item.id, item.parLevel + delta).catch((error) => {
      console.error("Failed to update par level:", error);
    });
  };

  const handleTargetAdjust = (delta: number) => {
    void setTargetQty(item.id, item.targetQty + delta).catch((error) => {
      console.error("Failed to update target quantity:", error);
    });
  };

  const handlePriorityAdjust = (delta: number) => {
    void setPriority(item.id, (item.priority + delta) as PrepItemModel["priority"]).catch((error) => {
      console.error("Failed to update priority:", error);
    });
  };

  return (
    <article className="prep-card" aria-label={`Prep item ${item.name}`}>
      <header className="prep-header">
        <h3 className="prep-name">{item.name}</h3>
        <button
          type="button"
          className={`status-pill status-${item.status}`}
          onClick={handleStatusClick}
          aria-label={`Status: ${statusLabel[item.status]}. Click to advance.`}
          style={{ cursor: "pointer" }}
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
            >
              -
            </button>
            <span>{item.parLevel} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleParLevelAdjust(1)}
              aria-label={`Increase ${item.name} par level`}
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
            >
              -
            </button>
            <span>{item.onHand} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleOnHandAdjust(1)}
              aria-label={`Increase ${item.name} on hand`}
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
            >
              -
            </button>
            <span>{item.targetQty} {item.unit}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handleTargetAdjust(1)}
              aria-label={`Increase ${item.name} target quantity`}
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
              onClick={() => handlePriorityAdjust(-1)}
              aria-label={`Raise ${item.name} priority`}
              disabled={item.priority <= 1}
            >
              -
            </button>
            <span>{priorityLabel[item.priority]}</span>
            <button
              type="button"
              className="prep-adjust-button"
              onClick={() => handlePriorityAdjust(1)}
              aria-label={`Lower ${item.name} priority`}
              disabled={item.priority >= 3}
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