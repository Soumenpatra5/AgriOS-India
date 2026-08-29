/* Employee skills, training and performance (spec §18–§20).

   One kind-discriminated store (employeeRecords) keeps the schema simple and
   offline-synced. Performance reviews are ENTERED BY A SUPERVISOR — there are
   no AI-generated ratings (spec §18). */

import { repo } from "../erp/erpDb.js";

export const SKILL_LEVELS = [
  { id: "beginner",     label: "Beginner", i18n: { en: "Beginner", hi: "शुरुआती", bn: "শিক্ষানবিশ" } },
  { id: "intermediate", label: "Intermediate", i18n: { en: "Intermediate", hi: "मध्यम", bn: "মাঝারি" } },
  { id: "advanced",     label: "Advanced", i18n: { en: "Advanced", hi: "उन्नत", bn: "উন্নত" } },
  { id: "expert",       label: "Expert", i18n: { en: "Expert", hi: "विशेषज्ञ", bn: "বিশেষজ্ঞ" } },
];

export const TRAINING_STATUSES = [
  { id: "planned",   label: "Planned", i18n: { en: "Planned", hi: "नियोजित", bn: "পরিকল্পিত" } },
  { id: "ongoing",   label: "Ongoing", i18n: { en: "Ongoing", hi: "जारी", bn: "চলমান" } },
  { id: "completed", label: "Completed", i18n: { en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" } },
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
