import { useState, useEffect, useRef, useMemo } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { AI_TOOLS } from "../constants/content.js";

export function filterPaletteItems(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter((item) => {
    const enTitle = (item.title?.en || item.title || "").toLowerCase();
    const hiTitle = (item.title?.hi || "").toLowerCase();
    const bnTitle = (item.title?.bn || "").toLowerCase();
    const enCat = (item.category?.en || "").toLowerCase();
    return (
      enTitle.includes(q) ||
      hiTitle.includes(q) ||
      bnTitle.includes(q) ||
      enCat.includes(q)
    );
  });
}

export default function DesktopCommandPalette({ isOpen, onClose }) {
  const { tc, push, switchTab } = useApp();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const allItems = useMemo(() => {
    const screens = [
      {
        id: "screen-home",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Dashboard / Home", hi: "डैशबोर्ड / होम", bn: "ড্যাশবোর্ড / হোম" },
        icon: "LayoutDashboard",
        action: () => switchTab("home"),
      },
      {
        id: "screen-farmspace",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Farm Space & Team", hi: "खेत स्पेस और टीम", bn: "ফার্ম স্পেস ও টিম" },
        icon: "Users",
        action: () => switchTab("farmSpace"),
      },
      {
        id: "screen-ai",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "AI Farm Assistant Hub", hi: "एआई सहायक हब", bn: "এআই ফার্ম সহকারী হাব" },
        icon: "Bot",
        action: () => switchTab("ai"),
      },
      {
        id: "screen-services",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Services & Livestock Hub", hi: "सेवाएं और पशुधन", bn: "পরিষেবা ও পশুসম্পদ" },
        icon: "Grid",
        action: () => switchTab("services"),
      },
      {
        id: "screen-livestock",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Dairy & Livestock Manager", hi: "डेयरी एवं पशु प्रबंधन", bn: "ডেইরি ও গবাদি পশু ম্যানেজার" },
        icon: "Milk",
        action: () => push({ kind: "dairyManager" }),
      },
      {
        id: "screen-calendar",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Crop Calendar & Tasks", hi: "फसल कैलेंडर और कार्य", bn: "ফসল ক্যালেন্ডার ও কাজ" },
        icon: "Calendar",
        action: () => push({ kind: "cropCalendar" }),
      },
      {
        id: "screen-ledger",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Farm Ledger (Income & Expense)", hi: "फार्म लेज़र (आय-व्यय)", bn: "ফার্ম লেজার (আয়-ব্যয়)" },
        icon: "Receipt",
        action: () => push({ kind: "farmLedger" }),
      },
      {
        id: "screen-weather",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Weather Forecast & Spray Window", hi: "मौसम पूर्वानुमान", bn: "আবহাওয়া পূর্বাভাস" },
        icon: "CloudSun",
        action: () => push({ kind: "weather" }),
      },
      {
        id: "screen-marketplace",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Mandi Marketplace & Orders", hi: "मंडी मार्केटप्लेस", bn: "মান্ডি মার্কেটপ্লেস" },
        icon: "ShoppingBag",
        action: () => switchTab("marketplace"),
      },
      {
        id: "screen-schemes",
        category: { en: "Navigation", hi: "नेविगेशन", bn: "ন্যাভিগেশন" },
        title: { en: "Government Schemes Explorer", hi: "सरकारी योजनाएं", bn: "সরকারি প্রকল্প" },
        icon: "Award",
        action: () => push({ kind: "schemeExplorer" }),
      },
    ];

    const aiSpecialists = AI_TOOLS.map((tool) => ({
      id: `ai-${tool.id}`,
      category: { en: "AI Specialists", hi: "एआई विशेषज्ञ", bn: "এআই বিশেষজ্ঞ" },
      title: tool.title,
      icon: tool.icon || "Sparkles",
      action: () => push({ kind: "chat", props: { agentId: tool.agentId } }),
    }));

    const quickActions = [
      {
        id: "qa-quick-entry",
        category: { en: "Quick Actions", hi: "त्वरित कार्रवाई", bn: "দ্রুত পদক্ষেপ" },
        title: { en: "New Farm Record / Activity", hi: "नया फार्म रिकॉर्ड", bn: "নতুন খামার রেকর্ড" },
        icon: "PlusCircle",
        action: () => push({ kind: "feature", props: { title: "Quick Entry", desc: "Add new farm record", icon: "Plus", a: "farm" } }),
      },
      {
        id: "qa-notifications",
        category: { en: "Quick Actions", hi: "त्वरित कार्रवाई", bn: "দ্রুত পদক্ষেপ" },
        title: { en: "View Farm Alerts & Notifications", hi: "अलर्ट और सूचनाएं देखें", bn: "সতর্কতা ও বিজ্ঞপ্তি দেখুন" },
        icon: "Bell",
        action: () => push({ kind: "alertsCenter" }),
      },
    ];

    return [...screens, ...aiSpecialists, ...quickActions];
  }, [push, switchTab]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    return filterPaletteItems(allItems, query);
  }, [allItems, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.action();
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tc({ en: "Command Palette", hi: "कमांड पैलेट", bn: "কমান্ড প্যালেট" })}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "ag-fade .18s var(--ag-ease)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          background: T.surface,
          borderRadius: 16,
          boxShadow: T.shadowLg,
          border: `1px solid ${T.line}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: `1px solid ${T.line}`,
            background: T.surface,
          }}
        >
          <Icon name="Search" size={18} color={T.primary} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={tc({
              en: "Search any feature, tool, or screen...",
              hi: "कोई भी सुविधा, टूल या स्क्रीन खोजें...",
              bn: "যেকোনো ফিচার, টুল বা স্ক্রিন খুঁজুন...",
            })}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              fontFamily: T.body,
              color: T.ink,
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              background: T.surface2,
              border: `1px solid ${T.line}`,
              borderRadius: 6,
              color: T.inkFaint,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: 360,
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: T.inkSoft,
                fontSize: 13,
              }}
            >
              {tc({
                en: "No matching features or tools found",
                hi: "कोई मेल नहीं मिला",
                bn: "কোনো ফলাফল পাওয়া যায়নি",
              })}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: isSelected ? T.primarySoft : "transparent",
                    color: isSelected ? T.primary : T.ink,
                    cursor: "pointer",
                    transition: "background .12s ease",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isSelected ? T.surface : T.surface2,
                      display: "grid",
                      placeItems: "center",
                      color: isSelected ? T.primary : T.inkSoft,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={item.icon || "Sparkles"} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 700 : 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tc(item.title)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isSelected ? T.primary : T.inkFaint,
                      background: isSelected ? `${T.primary}18` : T.surface2,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {tc(item.category)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div
          style={{
            padding: "8px 16px",
            background: T.surface2,
            borderTop: `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            color: T.inkFaint,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <span>↑↓ {tc({ en: "Navigate", hi: "नेविगेट", bn: "উপরে-নিচে" })}</span>
            <span>↵ {tc({ en: "Select", hi: "चुनें", bn: "নির্বাচন" })}</span>
          </div>
          <span>AgriOS Fast Search</span>
        </div>
      </div>
    </div>
  );
}
