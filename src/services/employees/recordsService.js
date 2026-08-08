/* Employee skills, training and performance (spec §18–§20).

   One kind-discriminated store (employeeRecords) keeps the schema simple and
   offline-synced. Performance reviews are ENTERED BY A SUPERVISOR — there are
   no AI-generated ratings (spec §18). */

import { repo } from "../erp/erpDb.js";

export const SKILL_LEVELS = [
  { id: "beginner",     label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced",     label: "Advanced" },
  { id: "expert",       label: "Expert" },
];

export const TRAINING_STATUSES = [
  { id: "planned",   label: "Planned" },
  { id: "ongoing",   label: "Ongoing" },
  { id: "completed", label: "Completed" },
];

const records = repo("employeeRecords");
const today = () => new Date().toISOString().slice(0, 10);
const label = (list, id) => list.find((x) => x.id === id)?.label ?? id ?? "";

export const recordsService = {
  skillLevelLabel:     (id) => label(SKILL_LEVELS, id),
  trainingStatusLabel: (id) => label(TRAINING_STATUSES, id),

  /* kind: "skill" | "training" | "performance" */
  add: (kind, data) => records.add({ kind, createdOn: today(), ...data }),
  update: (id, patch) => records.update(id, patch),
  remove: (id) => records.remove(id),

  async forEmployee(employeeId, kind) {
    const list = await records.getBy("employeeId", employeeId);
    return list
      .filter((r) => !kind || r.kind === kind)
      .sort((a, b) => (b.date || b.reviewDate || b.createdOn || "").localeCompare(a.date || a.reviewDate || a.createdOn || ""));
  },
};
