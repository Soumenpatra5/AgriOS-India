import { repo } from "../adminDb.js";

const articles = repo("articles");
const announcements = repo("announcements");

export const cmsService = {
  async addArticle(data) { return articles.add({ ...data, status: data.status || "draft" }); },
  getArticles: () => articles.getAll(),
  getArticleById: (id) => articles.getById(id),
  updateArticle: (id, patch) => articles.update(id, patch),
  removeArticle: (id) => articles.remove(id),

  async addAnnouncement(data) { return announcements.add({ ...data, status: data.status || "active" }); },
  getAnnouncements: () => announcements.getAll(),
  updateAnnouncement: (id, patch) => announcements.update(id, patch),
  removeAnnouncement: (id) => announcements.remove(id),
};
