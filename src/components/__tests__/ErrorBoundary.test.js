import { describe, it, expect, vi } from "vitest";

// ErrorBoundary imports theme + icon modules; give them a benign localStorage.
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const { default: ErrorBoundary } = await import("../ErrorBoundary.jsx");

describe("ErrorBoundary", () => {
  it("getDerivedStateFromError captures the error into state", () => {
    const err = new Error("boom");
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it("componentDidUpdate clears the error when resetKey changes", () => {
    const inst = new ErrorBoundary({ resetKey: "a" });
    inst.state = { error: new Error("x") };
    const patches = [];
    inst.setState = (p) => patches.push(p);

    inst.componentDidUpdate({ resetKey: "b" }); // key changed → should reset
    expect(patches).toContainEqual({ error: null });
  });

  it("componentDidUpdate keeps the error when resetKey is unchanged", () => {
    const inst = new ErrorBoundary({ resetKey: "a" });
    inst.state = { error: new Error("x") };
    const patches = [];
    inst.setState = (p) => patches.push(p);

    inst.componentDidUpdate({ resetKey: "a" }); // same key → no reset
    expect(patches).toHaveLength(0);
  });

  it("handleReset clears the error and calls onReset", () => {
    const onReset = vi.fn();
    const inst = new ErrorBoundary({ onReset });
    const patches = [];
    inst.setState = (p) => patches.push(p);

    inst.handleReset();
    expect(patches).toContainEqual({ error: null });
    expect(onReset).toHaveBeenCalled();
  });
});
