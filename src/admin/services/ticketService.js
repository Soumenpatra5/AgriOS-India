import { repo } from "../adminDb.js";

const tickets = repo("tickets");

export const ticketService = {
  async create(data) {
    return tickets.add({ ...data, status: "open", priority: data.priority || "medium" });
  },
  getAll: () => tickets.getAll(),
  getById: (id) => tickets.getById(id),
  update: (id, patch) => tickets.update(id, patch),
  resolve: (id) => tickets.update(id, { status: "resolved" }),
  close: (id) => tickets.update(id, { status: "closed" }),
  remove: (id) => tickets.remove(id),
};
