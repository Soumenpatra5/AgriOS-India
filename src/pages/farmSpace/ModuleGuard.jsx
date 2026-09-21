import { useState, useEffect } from "react";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { AppBar, ErrorState, Button, Spinner } from "../../components/index.js";
import { MODULE_CATALOG } from "./moduleCatalog.js";

/* Wrapper for optional modules. Checks if the module is enabled in the current Farm Space. */
export default function ModuleGuard({ moduleId, children }) {
  const { tc, pop, push } = useApp();
  const [enabled, setEnabled] = useState(null);
  const [space, setSpace] = useState(null);

  useEffect(() => {
    let alive = true;
    const s = farmSpaceService.active();
    if (!s) { pop(); return; }
    setSpace(s);

    farmSpaceService.modules(s.id).then(mods => {
      if (!alive) return;
      const m = mods.find(x => x.module_id === moduleId);
      // It's enabled if it's explicitly in the enabled array
      setEnabled(!!m && m.enabled !== false);
    }).catch(() => {
      if (alive) setEnabled(false);
    });
    return () => { alive = false; };
  }, [moduleId, pop]);

  if (enabled === null || !space) {
    return <><AppBar title={tc(MODULE_CATALOG[moduleId]?.label || { en: "Loading..." })} onBack={pop} /><div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }

  if (enabled === false) {
    return (
      <>
        <AppBar title={tc(MODULE_CATALOG[moduleId]?.label || { en: "Module" })} onBack={pop} />
        <div style={{ padding: 20 }}>
          <ErrorState 
            icon="Ban"
            title={tc({ en: "Module Not Enabled", hi: "मॉड्यूल सक्षम नहीं है", bn: "মডিউল সক্ষম নয়" })}
            body={tc({ en: "This module is not enabled for the current Farm Space.", hi: "यह मॉड्यूल वर्तमान फ़ार्म स्पेस के लिए सक्षम नहीं है।", bn: "এই মডিউলটি বর্তমান ফার্ম স্পেসের জন্য সক্ষম নয়।" })} 
          />
          {farmSpaceService.can(space, "farm.settings.manage") && (
            <div style={{ marginTop: 24, padding: "0 20px" }}>
              <Button full onClick={() => push({ kind: "farmSpaceCustomize", props: { spaceId: space.id } })}>
                {tc({ en: "Enable in Customize", hi: "कस्टमाइज़ में सक्षम करें", bn: "কাস্টমাইজে সক্ষম করুন" })}
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  return children;
}
