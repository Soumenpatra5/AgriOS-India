/**
 * Pure calculation helpers for Farm Space Desktop Kanban Board
 */

export const KANBAN_COLUMNS = [
  {
    id: "todo",
    title: { en: "To Do / Pending", hi: "करना है / लंबित", bn: "করণীয় / মুলতুবি" },
    statuses: ["pending", "accepted", "cancelled"],
    color: "#f59e0b",
  },
  {
    id: "progress",
    title: { en: "In Progress", hi: "प्रगति पर", bn: "চলমান" },
    statuses: ["in_progress"],
    color: "#3b82f6",
  },
  {
    id: "review",
    title: { en: "Under Review / Redo", hi: "समीक्षाधीन / पुनः कार्य", bn: "পর্যালোচনাধীন / পুনরায়" },
    statuses: ["rejected"],
    color: "#ef4444",
  },
  {
    id: "done",
    title: { en: "Completed & Verified", hi: "पूर्ण एवं सत्यापित", bn: "সম্পন্ন ও যাচাইকৃত" },
    statuses: ["completed", "verified"],
    color: "#16a34a",
  },
];

export function computeKanbanBuckets(tasks = []) {
  const buckets = {
    todo: [],
    progress: [],
    review: [],
    done: [],
  };

  if (!tasks || !tasks.length) return buckets;

  for (const t of tasks) {
    const s = t.status || "pending";
    if (s === "pending" || s === "accepted" || s === "cancelled") {
      buckets.todo.push(t);
    } else if (s === "in_progress") {
      buckets.progress.push(t);
    } else if (s === "rejected") {
      buckets.review.push(t);
    } else if (s === "completed" || s === "verified") {
      buckets.done.push(t);
    } else {
      buckets.todo.push(t);
    }
  }

  return buckets;
}
