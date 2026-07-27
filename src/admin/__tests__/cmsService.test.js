import { describe, it, expect } from "vitest";
import { cmsService } from "../services/cmsService.js";

describe("cmsService", () => {
  it("CRUD articles", async () => {
    const art = await cmsService.addArticle({ title: "Test Article", body: "Content", category: "general" });
    expect(art.title).toBe("Test Article");
    expect(art.status).toBe("draft");

    const all = await cmsService.getArticles();
    expect(all.some((a) => a.id === art.id)).toBe(true);

    const updated = await cmsService.updateArticle(art.id, { status: "published" });
    expect(updated.status).toBe("published");

    await cmsService.removeArticle(art.id);
    const found = await cmsService.getArticleById(art.id);
    expect(found).toBeNull();
  });

  it("CRUD announcements", async () => {
    const ann = await cmsService.addAnnouncement({ title: "Banner", message: "Hello" });
    expect(ann.status).toBe("active");

    const all = await cmsService.getAnnouncements();
    expect(all.some((a) => a.id === ann.id)).toBe(true);

    await cmsService.removeAnnouncement(ann.id);
  });
});
