import { EmptyState } from "./index.js";

/* Shown in place of a section the current device access role can't view (M7).
   Pass `tc` for localized copy. */
export default function Restricted({ tc }) {
  const T = (obj) => (tc ? tc(obj) : obj.en);
  return (
    <div style={{ padding: "8px 16px" }}>
      <EmptyState
        icon="Lock"
        title={T({ en: "Restricted", hi: "प्रतिबंधित", bn: "সীমাবদ্ধ" })}
        body={T({
          en: "This section is limited by the device's access mode. Switch to Owner in Profile → Access mode to view it.",
          hi: "यह अनुभाग डिवाइस के एक्सेस मोड द्वारा सीमित है। देखने के लिए प्रोफ़ाइल → एक्सेस मोड में मालिक पर स्विच करें।",
          bn: "এই বিভাগটি ডিভাইসের অ্যাক্সেস মোড দ্বারা সীমিত। দেখতে প্রোফাইল → অ্যাক্সেস মোডে মালিক-এ যান।",
        })}
      />
    </div>
  );
}
