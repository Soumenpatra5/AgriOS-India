/* Reusable presence computation and formatting helpers for Farm Space.
   Used across Team Roster, Member Details, Group Chat and Direct Messages. */

export const PRESENCE_THRESHOLDS = {
  ONLINE_MS: 90 * 1000,          // < 90s is considered actively Online
  RECENT_MS: 60 * 60 * 1000,     // < 60m is Recently Active
};

export const PRESENCE_COLORS = {
  online: {
    dot: "#16a34a",
    badgeBg: "#dcfce7",
    badgeFg: "#15803d",
  },
  recent: {
    dot: "#d97706",
    badgeBg: "#fef3c7",
    badgeFg: "#b45309",
  },
  offline: {
    dot: "#9ca3af",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
  },
};

/**
 * Returns raw presence classification: { state: "online" | "recent" | "offline", diffMs, seenDate }
 */
export function getPresenceState(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) {
    return { state: "offline", diffMs: Infinity, seenDate: null };
  }

  const seenDate = new Date(lastSeenAt);
  const seenTime = seenDate.getTime();
  if (isNaN(seenTime)) {
    return { state: "offline", diffMs: Infinity, seenDate: null };
  }

  let diffMs = now - seenTime;
  // Handle clock skew: server clock ahead of local clock
  if (diffMs < 0) {
    diffMs = 0;
  }

  if (diffMs < PRESENCE_THRESHOLDS.ONLINE_MS) {
    return { state: "online", diffMs, seenDate };
  }
  if (diffMs < PRESENCE_THRESHOLDS.RECENT_MS) {
    return { state: "recent", diffMs, seenDate };
  }
  return { state: "offline", diffMs, seenDate };
}

/**
 * Formats presence into localized text, dot color and badge styling.
 * @param {string|Date|null} lastSeenAt - ISO timestamp or Date object
 * @param {function} tc - Translation helper (returns string for { en, hi, bn })
 * @param {number} [now] - Current timestamp (defaults to Date.now())
 */
export function formatPresence(lastSeenAt, tc = (obj) => obj?.en || "", now = Date.now()) {
  const { state, diffMs, seenDate } = getPresenceState(lastSeenAt, now);
  const colors = PRESENCE_COLORS[state];

  if (state === "online") {
    return {
      state: "online",
      label: tc({ en: "Online", hi: "ऑनलाइन", bn: "অনলাইন" }),
      dotColor: colors.dot,
      badgeBg: colors.badgeBg,
      badgeFg: colors.badgeFg,
    };
  }

  if (state === "recent") {
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    return {
      state: "recent",
      label: tc({
        en: `Active ${mins}m ago`,
        hi: `${mins} मिनट पहले सक्रिय`,
        bn: `${mins} মিনিট আগে সক্রিয়`,
      }),
      dotColor: colors.dot,
      badgeBg: colors.badgeBg,
      badgeFg: colors.badgeFg,
    };
  }

  // State is "offline"
  if (!seenDate) {
    return {
      state: "offline",
      label: tc({ en: "Offline", hi: "ऑफ़लाइन", bn: "অফলাইন" }),
      dotColor: colors.dot,
      badgeBg: colors.badgeBg,
      badgeFg: colors.badgeFg,
    };
  }

  const nowDate = new Date(now);
  const isToday =
    seenDate.getDate() === nowDate.getDate() &&
    seenDate.getMonth() === nowDate.getMonth() &&
    seenDate.getFullYear() === nowDate.getFullYear();

  if (isToday) {
    return {
      state: "offline",
      label: tc({ en: "Active today", hi: "आज सक्रिय", bn: "আজ সক্রিয়" }),
      dotColor: colors.dot,
      badgeBg: colors.badgeBg,
      badgeFg: colors.badgeFg,
    };
  }

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(nowDate.getDate() - 1);
  const isYesterday =
    seenDate.getDate() === yesterdayDate.getDate() &&
    seenDate.getMonth() === yesterdayDate.getMonth() &&
    seenDate.getFullYear() === yesterdayDate.getFullYear();

  if (isYesterday) {
    return {
      state: "offline",
      label: tc({ en: "Active yesterday", hi: "कल सक्रिय", bn: "গতকাল সক্রিয়" }),
      dotColor: colors.dot,
      badgeBg: colors.badgeBg,
      badgeFg: colors.badgeFg,
    };
  }

  let dateStr;
  try {
    dateStr = seenDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    dateStr = seenDate.toISOString().slice(0, 10);
  }

  return {
    state: "offline",
    label: tc({
      en: `Active ${dateStr}`,
      hi: `${dateStr} को सक्रिय`,
      bn: `${dateStr} সক্রিয়`,
    }),
    dotColor: colors.dot,
    badgeBg: colors.badgeBg,
    badgeFg: colors.badgeFg,
  };
}

/**
 * Counts online members in a list.
 */
export function countOnlineMembers(members = [], now = Date.now()) {
  if (!Array.isArray(members)) return 0;
  return members.filter((m) => {
    if (!m) return false;
    return getPresenceState(m.last_seen_at, now).state === "online";
  }).length;
}

export const ACTIVITY_EVENTS = {
  "space.created":        { icon: "Sprout",       a: "primary", text: { en: "created the Farm Space", hi: "ने फ़ार्म स्पेस बनाया", bn: "ফার্ম স্পেস তৈরি করেছেন" } },
  "member.joined":        { icon: "UserPlus",     a: "primary", text: { en: "joined",                 hi: "शामिल हुए",            bn: "যোগ দিয়েছেন" } },
  "member.invited":       { icon: "Mail",         a: "blue",    text: { en: "invited someone",        hi: "ने किसी को बुलाया",     bn: "কাউকে ডেকেছেন" } },
  "member.left":          { icon: "UserMinus",    a: "faint",   text: { en: "left the Farm Space",    hi: "ने फ़ार्म स्पेस छोड़ा",  bn: "ফার্ম স্পেস ছেড়েছেন" } },
  "task.created":         { icon: "ClipboardList",a: "blue",    text: { en: "created a task",         hi: "ने कार्य बनाया",        bn: "একটি কাজ তৈরি করেছেন" } },
  "task.accepted":        { icon: "Check",        a: "blue",    text: { en: "accepted a task",        hi: "ने कार्य स्वीकारा",     bn: "কাজ গ্রহণ করেছেন" } },
  "task.in_progress":     { icon: "Play",         a: "blue",    text: { en: "started a task",         hi: "ने कार्य शुरू किया",    bn: "কাজ শুরু করেছেন" } },
  "task.completed":       { icon: "CheckCheck",   a: "primary", text: { en: "completed a task",       hi: "ने कार्य पूरा किया",    bn: "কাজ সম্পন্ন করেছেন" } },
  "task.verified":        { icon: "ShieldCheck",  a: "primary", text: { en: "verified a task",        hi: "ने कार्य सत्यापित किया", bn: "কাজ যাচাই করেছেন" } },
  "task.rejected":        { icon: "Undo2",        a: "red",     text: { en: "sent a task back",       hi: "ने कार्य वापस भेजा",    bn: "কাজ ফেরত পাঠিয়েছেন" } },
  "task.cancelled":       { icon: "X",            a: "faint",   text: { en: "cancelled a task",       hi: "ने कार्य रद्द किया",    bn: "কাজ বাতিল করেছেন" } },
  "task.reassigned":      { icon: "Repeat",       a: "blue",    text: { en: "reassigned a task",      hi: "ने कार्य दूसरे को दिया", bn: "কাজ অন্যকে দিয়েছেন" } },
  "announcement.created": { icon: "Megaphone",    a: "orange",  text: { en: "posted an announcement", hi: "ने घोषणा की",           bn: "একটি ঘোষণা দিয়েছেন" } },
  "attendance.marked":    { icon: "CalendarCheck",a: "primary", text: { en: "marked attendance",      hi: "ने उपस्थिति दर्ज की",   bn: "উপস্থিতি নথিভুক্ত করেছেন" } },
};

export const ACTIVITY_TONES = {
  primary: ["#16a34a", "#dcfce7"],
  blue: ["#2563eb", "#dbeafe"],
  orange: ["#ea580c", "#ffedd5"],
  red: ["#dc2626", "#fee2e2"],
  faint: ["#6b7280", "#f3f4f6"],
};

export function formatActivityAgo(iso, tc = (o) => o?.en || "") {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1)  return tc({ en: "just now", hi: "अभी", bn: "এইমাত্র" });
  if (mins < 60) return tc({ en: `${mins}m ago`, hi: `${mins} मिनट पहले`, bn: `${mins} मिनट আগে` });
  const h = Math.round(mins / 60);
  if (h < 24)    return tc({ en: `${h}h ago`, hi: `${h} घंटे पहले`, bn: `${h} ঘণ্টা আগে` });
  const d = Math.round(h / 24);
  return tc({ en: `${d}d ago`, hi: `${d} दिन पहले`, bn: `${d} দিন আগে` });
}

