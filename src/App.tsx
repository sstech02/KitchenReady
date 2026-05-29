import "./App.css";
import PrepItem from "./components/PrepItem";
import type { PrepItem as PrepItemModel } from "./models/PrepItem";

function App() {
  const samplePrepItems: PrepItemModel[] = [
    {
      id: "prep-1",
      name: "Diced onions",
      parLevel: 10,
      onHand: 2,
      targetQty: 8,
      unit: "cup",
      priority: 1,
      status: "in_progress",
      assignedTo: "Sam",
    },
    {
      id: "prep-2",
      name: "Shredded cheddar",
      parLevel: 6,
      onHand: 1,
      targetQty: 5,
      unit: "lb",
      priority: 2,
      status: "done",
      assignedTo: "Ari",
    },
    {
      id: "prep-3",
      name: "Ranch dressing",
      parLevel: 4,
      onHand: 0,
      targetQty: 4,
      unit: "l",
      priority: 1,
      status: "done",
      assignedTo: "Lee",
    },
    {
      id: "prep-4",
      name: "Tomato basil soup",
      parLevel: 2,
      onHand: 1,
      targetQty: 1,
      unit: "l",
      priority: 3,
      status: "done",
      assignedTo: "Jordan",
    },
    {
      id: "prep-5",
      name: "House croutons",
      parLevel: 3,
      onHand: 0,
      targetQty: 3,
      unit: "pan",
      priority: 2,
      status: "todo",
      assignedTo: "Unassigned",
    },
  ];

  const completedCount = samplePrepItems.filter(
    (item) => item.status === "done",
  ).length;
  const totalCount = samplePrepItems.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <main className="app-shell">
      <section className="dashboard" aria-label="Prep list dashboard">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Prep List Dashboard</h1>
          <p className="dashboard-subtitle">
            Shift progress for today&apos;s prep workload.
          </p>

          <div className="progress-wrap" aria-label="Prep progress">
            <div className="progress-meta">
              <span className="progress-label">Completed</span>
              <span className="progress-value">
                {completedCount}/{totalCount} ({progressPercent}%)
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Completed prep items"
            >
              <span
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </header>

        <section className="prep-grid-layout" aria-label="Prep item cards">
          {samplePrepItems.map((item) => (
            <PrepItem key={item.id} item={item} />
          ))}
        </section>
      </section>
    </main>
  );
}

export default App;