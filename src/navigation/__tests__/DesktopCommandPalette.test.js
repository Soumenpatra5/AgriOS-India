import { describe, it, expect } from "vitest";
import { filterPaletteItems } from "../DesktopCommandPalette.jsx";

describe("DesktopCommandPalette filterPaletteItems", () => {
  const mockItems = [
    {
      id: "screen-home",
      category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
      title: { en: "Dashboard / Home", hi: "डैशबोर्ड / होम", bn: "ড্যাশবোর্ড / হোম" },
    },
    {
      id: "screen-livestock",
      category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
      title: { en: "Dairy & Livestock Manager", hi: "डेयरी एवं पशु प्रबंधन", bn: "ডেইরি ও গবাদি পশু ম্যানেজার" },
    },
    {
      id: "ai-crop-doctor",
      category: { en: "AI Specialists", hi: "एआई विशेषज्ञ", bn: "এআই বিশেষজ্ঞ" },
      title: { en: "Crop Doctor", hi: "फसल डॉक्टर", bn: "ফসল ডাক্তার" },
    },
    {
      id: "qa-quick-entry",
      category: { en: "Quick Actions", hi: "त्वरित कार्रवाई", bn: "দ্রুত পদক্ষেপ" },
      title: { en: "New Farm Record", hi: "नया फार्म रिकॉर्ड", bn: "নতুন খামার রেকর্ড" },
    },
  ];

  it("returns all items when query is empty or whitespace", () => {
    expect(filterPaletteItems(mockItems, "")).toEqual(mockItems);
    expect(filterPaletteItems(mockItems, "   ")).toEqual(mockItems);
    expect(filterPaletteItems(mockItems, null)).toEqual(mockItems);
  });

  it("filters items by English title or category", () => {
    const results = filterPaletteItems(mockItems, "dairy");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("screen-livestock");

    const aiResults = filterPaletteItems(mockItems, "ai specialists");
    expect(aiResults).toHaveLength(1);
    expect(aiResults[0].id).toBe("ai-crop-doctor");
  });

  it("filters items by Bengali query", () => {
    const results = filterPaletteItems(mockItems, "ড্যাশবোর্ড");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("screen-home");

    const cropResults = filterPaletteItems(mockItems, "ফসল");
    expect(cropResults).toHaveLength(1);
    expect(cropResults[0].id).toBe("ai-crop-doctor");
  });

  it("filters items by Hindi query", () => {
    const results = filterPaletteItems(mockItems, "पशु");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("screen-livestock");
  });

  it("returns empty array when no item matches", () => {
    const results = filterPaletteItems(mockItems, "nonexistent-xyz");
    expect(results).toHaveLength(0);
  });
});
