import "./App.css";
import PrepItem from "./components/PrepItem";
import type { PrepItem as PrepItemModel } from "./models/PrepItem";

function App() {
  const sample: PrepItemModel = {
    id: "prep-1",
    name: "Diced onions",
    parLevel: 10,
    onHand: 2,
    targetQty: 8,
    unit: "cup",
    priority: 2,
    status: "in_progress",
    assignedTo: "Sam",
  };

  return (
    <main className="app-shell">
      <PrepItem item={sample} />
    </main>
  );
}

export default App;