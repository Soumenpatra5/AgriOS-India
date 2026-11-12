import { describe, it, expect } from "vitest";
import { computeKanbanBuckets } from "../farmTasksKanban.js";

describe("Farm Space Kanban Bucketing helper", () => {
  it("returns empty buckets for empty or null task list", () => {
    const res = computeKanbanBuckets([]);
    expect(res.todo).toEqual([]);
    expect(res.progress).toEqual([]);
    expect(res.review).toEqual([]);
    expect(res.done).toEqual([]);
  });

  it("correctly groups tasks into the 4 workflow buckets", () => {
    const tasks = [
      { id: "t1", title: "Feed cows", status: "pending" },
      { id: "t2", title: "Milk AM", status: "accepted" },
      { id: "t3", title: "Clean coop", status: "in_progress" },
      { id: "t4", title: "Fix fence", status: "rejected" },
      { id: "t5", title: "Harvest corn", status: "completed" },
      { id: "t6", title: "Verify eggs", status: "verified" },
    ];

    const res = computeKanbanBuckets(tasks);
    expect(res.todo).toHaveLength(2);
    expect(res.todo.map((t) => t.id)).toEqual(["t1", "t2"]);

    expect(res.progress).toHaveLength(1);
    expect(res.progress[0].id).toBe("t3");

    expect(res.review).toHaveLength(1);
    expect(res.review[0].id).toBe("t4");

    expect(res.done).toHaveLength(2);
    expect(res.done.map((t) => t.id)).toEqual(["t5", "t6"]);
  });

  it("handles cancelled or unexpected statuses cleanly in todo fallback", () => {
    const tasks = [{ id: "t-cancel", title: "Old task", status: "cancelled" }];
    const res = computeKanbanBuckets(tasks);
    expect(res.todo).toHaveLength(1);
  });
});
