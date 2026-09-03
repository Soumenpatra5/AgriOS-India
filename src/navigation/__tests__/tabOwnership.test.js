import { describe, it, expect } from "vitest";
import { ownerTabOf, activeTab } from "../tabOwnership.js";

/* The bottom nav's highlight rule, as a pure function.

   The thing worth guarding is not that Farm Space lights up — it is that
   nothing else changed. Before this, a pushed screen cleared the highlight
   from every tab, and that must still be true for every screen the map does
   not name. */

describe("ownerTabOf", () => {
  it("claims the Farm Space screens", () => {
    for (const kind of [
      "farmSpace", "farmSpaceTeam", "farmSpaceTasks", "farmSpaceAttendance",
      "farmSpaceAnnouncements", "farmSpaceActivity", "farmSpaceChat",
      "farmSpaceSettings", "farmSpacePicker", "farmSpaceCreate", "farmSpaceInvites",
    ]) {
      expect(ownerTabOf(kind), kind).toBe("farmSpace");
    }
  });

  it("claims nothing else", () => {
    /* A calculator opened from Services is not really "in" Services, and the
       app has always treated it that way. */
    for (const kind of ["calculator", "cropCalendar", "marketplace", "erpEmployees", "documents", "settings"]) {
      expect(ownerTabOf(kind), kind).toBeNull();
    }
  });

  it("is not fooled by inherited object properties", () => {
    /* A bare lookup would answer "function" for "constructor" and hand that
       string to the nav as a tab name. */
    expect(ownerTabOf("constructor")).toBeNull();
    expect(ownerTabOf("toString")).toBeNull();
    expect(ownerTabOf(undefined)).toBeNull();
  });
});

describe("activeTab", () => {
  it("is the tab itself when nothing is pushed", () => {
    expect(activeTab({ tab: "home", stack: [] })).toBe("home");
    expect(activeTab({ tab: "farmSpace", stack: [] })).toBe("farmSpace");
    expect(activeTab({ tab: "profile", stack: [] })).toBe("profile");
  });

  it("keeps Farm Space lit while inside its own screens", () => {
    for (const kind of ["farmSpaceTeam", "farmSpaceTasks", "farmSpaceChat", "farmSpaceSettings"]) {
      expect(activeTab({ tab: "farmSpace", stack: [{ kind }] }), kind).toBe("farmSpace");
    }
  });

  it("lights Farm Space even when it was opened from another tab", () => {
    /* Home's card and the Services tile both push the hub. You are in Farm
       Space, so the nav should say so. */
    expect(activeTab({ tab: "home", stack: [{ kind: "farmSpace" }] })).toBe("farmSpace");
    expect(activeTab({ tab: "services", stack: [{ kind: "farmSpaceTasks" }] })).toBe("farmSpace");
  });

  it("still clears the highlight for every other pushed screen", () => {
    expect(activeTab({ tab: "services", stack: [{ kind: "calculator" }] })).toBeNull();
    expect(activeTab({ tab: "home", stack: [{ kind: "cropCalendar" }] })).toBeNull();
    expect(activeTab({ tab: "profile", stack: [{ kind: "documents" }] })).toBeNull();
  });

  it("reads the top of the stack, not the bottom", () => {
    /* Farm Space → a task → some other screen: the highlight follows where you
       actually are. */
    expect(activeTab({ tab: "farmSpace", stack: [{ kind: "farmSpaceTasks" }, { kind: "documents" }] })).toBeNull();
    expect(activeTab({ tab: "home", stack: [{ kind: "documents" }, { kind: "farmSpaceChat" }] })).toBe("farmSpace");
  });

  it("survives a missing or empty stack", () => {
    expect(activeTab({ tab: "home" })).toBe("home");
    expect(activeTab({ tab: "home", stack: undefined })).toBe("home");
  });
});
