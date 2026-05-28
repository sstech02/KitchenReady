import type { PrepItem as PrepItemModel } from "../models/PrepItem";

type PrepItemCardProps = {
  item: PrepItemModel;
};

const statusLabel: Record<PrepItemModel["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  discarded: "Discarded",
};

function PrepItem({ item }: PrepItemCardProps) {
  return (
    <article className="prep-card" aria-label={`Prep item ${item.name}`}>
      <header className="prep-header">
        <h3 className="prep-name">{item.name}</h3>
        <span className={`status-pill status-${item.status}`}>
          {statusLabel[item.status]}
        </span>
      </header>

      <div className="prep-grid">
        <p className="prep-row">
          <span className="prep-key">Par Level</span>
          <span className="prep-value">
            {item.parLevel} {item.unit}
          </span>
        </p>

        <p className="prep-row">
          <span className="prep-key">On Hand</span>
          <span className="prep-value">
            {item.onHand} {item.unit}
          </span>
        </p>

        <p className="prep-row">
          <span className="prep-key">Target</span>
          <span className="prep-value prep-value-strong">
            {item.targetQty} {item.unit}
          </span>
        </p>

        <p className="prep-row">
          <span className="prep-key">Priority</span>
          <span className="prep-value">{item.priority}</span>
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
