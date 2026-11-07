import { describe, it, expect } from "vitest";
import { parseShedVoiceCommand } from "../shedVoiceParser.js";

describe("shedVoiceParser", () => {
  const herd = [
    { id: "a1", name: "Ganga", tag_id: "TAG-101" },
    { id: "a2", name: "Yamuna", tag_id: "TAG-102" },
    { id: "a3", name: "গঙ্গা", tag_id: "TAG-103" },
    { id: "a4", name: "गौरी", tag_id: "TAG-104" },
  ];

  it("parses English spoken commands with litres and AM session", () => {
    const cmd = parseShedVoiceCommand("Ganga morning 12.5 litres", herd);
    expect(cmd).not.toBeNull();
    expect(cmd.animal.name).toBe("Ganga");
    expect(cmd.session).toBe("am");
    expect(cmd.yieldAmount).toBe(12.5);
    expect(cmd.unit).toBe("L");
    expect(cmd.confidence).toBe("high");
  });

  it("parses English spoken commands with kg and PM session", () => {
    const cmd = parseShedVoiceCommand("Yamuna evening 8.0 kg", herd);
    expect(cmd.animal.name).toBe("Yamuna");
    expect(cmd.session).toBe("pm");
    expect(cmd.yieldAmount).toBe(8.0);
    expect(cmd.unit).toBe("kg");
  });

  it("parses Bengali voice commands with Bengali numerals and morning litres", () => {
    // ১২.৫ লিটার
    const cmd = parseShedVoiceCommand("গঙ্গা সকাল ১২.৫ লিটার", herd);
    expect(cmd.animal.name).toBe("গঙ্গা");
    expect(cmd.session).toBe("am");
    expect(cmd.yieldAmount).toBe(12.5);
    expect(cmd.unit).toBe("L");
  });

  it("parses Hindi voice commands with Devanagari numerals and evening kg", () => {
    // शाम ५.० किलो
    const cmd = parseShedVoiceCommand("गौरी शाम ५.० किलो", herd);
    expect(cmd.animal.name).toBe("गौरी");
    expect(cmd.session).toBe("pm");
    expect(cmd.yieldAmount).toBe(5.0);
    expect(cmd.unit).toBe("kg");
  });

  it("resolves animal by tag_id if spoken", () => {
    const cmd = parseShedVoiceCommand("tag-102 morning 7.5 litres", herd);
    expect(cmd.animal.id).toBe("a2");
    expect(cmd.session).toBe("am");
    expect(cmd.yieldAmount).toBe(7.5);
  });
});
