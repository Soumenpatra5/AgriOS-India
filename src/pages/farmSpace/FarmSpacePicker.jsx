import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, ErrorState, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Choosing which Farm Space to open.

   A user can belong to several — owner of their own farm, manager of a
   neighbour's, worker on a third — and the spec is explicit that data must
   never leak between them. Guessing would be the leak: the wrong space opened
   silently is indistinguishable, to the user, from the right one. So when
   there is more than one and none is chosen, we ask. */

export default function FarmSpacePicker() {
  const { pop, push, tc } = useApp();
  const [spaces, setSpaces] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const activeId = farmSpaceService.activeId();

  const load = useCallback(async () => {
    setState("loading");
    try {
      setSpaces(await farmSpaceService.spaces({ fresh: true }));
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const choose = (id) => { farmSpaceService.setActive(id); pop(); };

  const title = tc({ en: "Choose a Farm Space", hi: "फ़ार्म स्पेस चुनें", bn: "ফার্ম স্পেস বাছুন" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {spaces.map((s) => {
          const current = s.id === activeId;
          return (
            <Card key={s.id} pad={0}>
              <button onClick={() => choose(s.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "14px 12px",
                  background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center",
                  background: current ? T.primary : T.primarySoft, color: current ? "#fff" : T.primary }}>
                  <Icon name="Sprout" size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                    {tc(farmSpaceService.roleLabel(s.role))}
                    {s.member_count ? ` · ${s.member_count}` : ""}
                  </div>
                </div>
                {current && <Icon name="Check" size={18} style={{ color: T.primary }} />}
              </button>
            </Card>
          );
        })}

        <Button full variant="soft" onClick={() => push({ kind: "farmSpaceCreate" })}>
          {tc({ en: "Create another Farm Space", hi: "एक और फ़ार्म स्पेस बनाएँ", bn: "আরেকটি ফার্ম স্পেস তৈরি করুন" })}
        </Button>
      </div>
    </>
  );
}
