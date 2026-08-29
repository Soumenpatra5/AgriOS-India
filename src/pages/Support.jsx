import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";

const FAQS = [
  {
    q: { en: "Is the AI advice reliable?", hi: "क्या AI सलाह भरोसेमंद है?", bn: "AI পরামর্শ কি নির্ভরযোগ্য?" },
    a: { en: "It's AI-assisted guidance, not a confirmed diagnosis. For pesticide/medicine doses and animal treatment, always confirm with your local agriculture officer, vet, or KVK.",
         hi: "यह AI-सहायता है, पुष्ट निदान नहीं। दवा/कीटनाशक की मात्रा और पशु उपचार के लिए हमेशा स्थानीय कृषि अधिकारी, पशु चिकित्सक या KVK से पुष्टि करें।",
         bn: "এটি AI-সহায়তা, নিশ্চিত রোগ নির্ণয় নয়। ওষুধ/কীটনাশকের মাত্রা ও পশু চিকিৎসার জন্য সর্বদা স্থানীয় কৃষি অফিসার, পশু চিকিৎসক বা KVK-র সঙ্গে নিশ্চিত করুন।" },
  },
  {
    q: { en: "Does the app work offline?", hi: "क्या ऐप ऑफ़लाइन काम करता है?", bn: "অ্যাপ কি অফলাইনে কাজ করে?" },
    a: { en: "Yes — your records, diary and prices work offline and sync when you reconnect. The AI assistant needs internet to answer.",
         hi: "हाँ — आपके रिकॉर्ड, डायरी और भाव ऑफ़लाइन काम करते हैं और दोबारा कनेक्ट होने पर सिंक होते हैं। AI सहायक को जवाब के लिए इंटरनेट चाहिए।",
         bn: "হ্যাঁ — আপনার রেকর্ড, ডায়েরি ও দর অফলাইনে কাজ করে ও পুনরায় সংযুক্ত হলে সিঙ্ক হয়। AI সহায়কের উত্তরের জন্য ইন্টারনেট প্রয়োজন।" },
  },
  {
    q: { en: "How do I change the language or theme?", hi: "भाषा या थीम कैसे बदलें?", bn: "ভাষা বা থিম কীভাবে বদলাবো?" },
    a: { en: "Go to Profile → Settings → Personalize. You can change language, theme, colours, layout and more.",
         hi: "प्रोफ़ाइल → सेटिंग्स → अनुकूलित करें पर जाएँ। भाषा, थीम, रंग, लेआउट आदि बदल सकते हैं।",
         bn: "প্রোফাইল → সেটিংস → ব্যক্তিগতকরণ-এ যান। ভাষা, থিম, রঙ, লেআউট ইত্যাদি বদলাতে পারেন।" },
  },
];

function ContactRow({ icon, label, sub, href }) {
  return (
    <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", textDecoration: "none", color: T.ink }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{sub}</div>
      </div>
      <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
    </a>
  );
}

export default function Support() {
  const { pop, tc } = useApp();
  const [open, setOpen] = useState(null);

  return (
    <>
      <AppBar title={tc({ en: "Support", hi: "सहायता", bn: "সহায়তা" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 18, animation: "ag-fade .25s var(--ag-ease)" }}>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "Get help", hi: "मदद पाएँ", bn: "সাহায্য নিন" })}</div>
          <Card pad={6} style={{ display: "flex", flexDirection: "column" }}>
            <ContactRow icon="LifeBuoy" label={tc({ en: "Kisan Call Centre", hi: "किसान कॉल सेंटर", bn: "কিষান কল সেন্টার" })} sub="1800-180-1551 · 6 AM–10 PM" href="tel:18001801551" />
            <div style={{ borderTop: `1px solid ${T.lineSoft}` }} />
            <ContactRow icon="Send" label={tc({ en: "Email us", hi: "ईमेल करें", bn: "ইমেইল করুন" })} sub="support@agrios.example" href="mailto:support@agrios.example?subject=AgriOS%20Support" />
            <div style={{ borderTop: `1px solid ${T.lineSoft}` }} />
            <ContactRow icon="Landmark" label={tc({ en: "Find your KVK", hi: "अपना KVK खोजें", bn: "আপনার KVK খুঁজুন" })} sub={tc({ en: "krishi vigyan kendra", hi: "कृषि विज्ञान केंद्र", bn: "কৃষি বিজ্ঞান কেন্দ্র" })} href="https://kvk.icar.gov.in" />
          </Card>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "FAQ", hi: "सामान्य प्रश्न", bn: "সাধারণ প্রশ্ন" })}</div>
          <Card pad={6} style={{ display: "flex", flexDirection: "column" }}>
            {FAQS.map((f, i) => (
              <div key={i} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                <button onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>{tc(f.q)}</span>
                  <Icon name={open === i ? "ChevronUp" : "ChevronDown"} size={18} style={{ color: T.inkFaint, flexShrink: 0 }} />
                </button>
                {open === i && (
                  <div style={{ padding: "0 12px 14px", fontSize: 13, color: T.inkSoft, lineHeight: 1.55 }}>{tc(f.a)}</div>
                )}
              </div>
            ))}
          </Card>
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: T.inkFaint }}>AgriOS India · v2.0.0</div>
      </div>
    </>
  );
}
