import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Card, Button, Spinner, IconTile, ErrorState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { MODULE_CATALOG, OPTIONAL_MODULES_ORDER } from "./moduleCatalog.js";
import Icon from "../../components/Icon.jsx";

export default function FarmSpaceCustomize({ spaceId }) {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [modules, setModules] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const s = farmSpaceService.peekSpaces()?.find(x => x.id === spaceId);
    if (!s) { pop(); return; }
    setSpace(s);
    
    farmSpaceService.modules(spaceId).then((mods) => {
      if (!alive) return;
      const visibleIds = new Set(mods.map(m => m.module_id));
      
      
        const missingOptionals = OPTIONAL_MODULES_ORDER.filter(id => !visibleIds.has(id));
        const allMods = [
        ...mods.map(m => ({ ...m, enabled: true })), 
        ...missingOptionals.map(id => ({ module_id: id, sort_order: 999, enabled: false }))
      ];
      setModules(allMods);
    }).catch((err) => {
      if (alive) setError(err.message || "Failed to load");
    });
    return () => { alive = false; };
  }, [spaceId, pop]);

  const moveUp = (index) => {
    if (index === 0) return;
    const m = [...modules];
    [m[index - 1], m[index]] = [m[index], m[index - 1]];
    setModules(m);
  };

  const moveDown = (index) => {
    if (index === modules.length - 1) return;
    const m = [...modules];
    [m[index], m[index + 1]] = [m[index + 1], m[index]];
    setModules(m);
  };

  const toggle = (moduleId) => {
    setModules(modules.map(m => m.module_id === moduleId ? { ...m, enabled: !m.enabled } : m));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const orderedModuleIds = modules.filter(m => m.enabled).map(m => m.module_id);
      
      // Because we must include the disabled ones at the end (or not at all, the server only saves the requested array).
      // Wait, if we just send the enabled ones, what happens to disabled? 
      // Actually, if we send the full ordered list, the server can derive enabled = true.
      // We will send ALL modules in the list, and the server will just save what we send.
      // But wait! The server's `validateModuleConfiguration` currently does not accept `enabled`. 
      // I should update `modules.js` to accept `{ moduleId, enabled }` or just send `orderedModuleIds` and everything else is disabled/deleted?
      // Yes, if we send `orderedModuleIds`, the backend currently deletes everything and only inserts what we send as enabled=true!
      // This means disabled modules are removed from `farm_space_modules`. That is perfectly fine, disabling != deleting data, they just don't have a row in `farm_space_modules`.
      // BUT wait, what if they re-enable? If they just append to the list, it's inserted back!
      
      const payloadModuleIds = modules.filter(m => m.enabled || OPTIONAL_MODULES_ORDER.includes(m.module_id) === false).map(m => m.module_id);
      // Wait, if it's optional and disabled, we don't send it. If it's core, we must send it.
      const toSend = modules.filter(m => m.enabled || !OPTIONAL_MODULES_ORDER.includes(m.module_id)).map(m => m.module_id);

      const res = await farmSpaceService.updateModules(spaceId, {
        expected_version: space.configuration_version || 1,
        orderedModuleIds: toSend
      });
      
      // Update cache
      farmSpaceService.setModules(spaceId, toSend.map((id, i) => ({ module_id: id, sort_order: i, enabled: true })));
      // Also update space version
      farmSpaceService.patchSpace(spaceId, { configuration_version: res.configuration_version });
      
      toast(tc({ en: "Changes saved.", hi: "बदलाव सहेजे गए।", bn: "পরিবর্তন সংরক্ষিত হয়েছে।" }), "success");
      pop();
    } catch (err) {
      toast(err.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <><AppBar title="Customize" onBack={pop} /><ErrorState body={error} /></>;
  if (!modules || !space) return <><AppBar title="Customize" onBack={pop} /><div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div></>;

  // Ensure all modules are represented in the list even if missing from cache
  // no longer need to map missing since state has them all
  
  const fullList = modules;

  return (
    <>
      <AppBar title={tc({ en: "Customize Workspace", hi: "कार्यस्थान", bn: "কর্মক্ষেত্র" })} onBack={pop} />
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <Card pad={0}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {fullList.map((m, i) => {
              const def = MODULE_CATALOG[m.module_id];
              if (!def) return null;
              const isCore = !OPTIONAL_MODULES_ORDER.includes(m.module_id);
              const isFirst = i === 0;
              const isLast = i === fullList.length - 1;

              return (
                <div key={m.module_id} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: 12 }}>
                    <button onClick={() => moveUp(i)} disabled={isFirst} style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", padding: 4, opacity: isFirst ? 0.3 : 1 }}>
                      <Icon name="ChevronUp" size={18} style={{ color: T.ink }} />
                    </button>
                    <button onClick={() => moveDown(i)} disabled={isLast} style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", padding: 4, opacity: isLast ? 0.3 : 1 }}>
                      <Icon name="ChevronDown" size={18} style={{ color: T.ink }} />
                    </button>
                  </div>

                  <IconTile name={def.icon} accent={def.a} style={{ opacity: m.enabled !== false ? 1 : 0.4 }} />
                  
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 12, opacity: m.enabled !== false ? 1 : 0.4 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{tc(def.label)}</div>
                    {isCore && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{tc({ en: "Required", hi: "आवश्यक", bn: "প্রয়োজনীয়" })}</div>}
                  </div>

                  {!isCore && (
                    <label style={{ display: "flex", alignItems: "center", padding: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={m.enabled !== false} onChange={() => toggle(m.module_id)} style={{ width: 20, height: 20, accentColor: T.primary }} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 16, background: "white", borderTop: `1px solid ${T.border}`, zIndex: 10 }}>
          <Button full size="large" onClick={save} disabled={saving}>
            {saving ? tc({ en: "Saving...", hi: "सहेजा जा रहा है...", bn: "সংরক্ষণ করা হচ্ছে..." }) : tc({ en: "Save Changes", hi: "बदलाव सहेजें", bn: "পরিবর্তন সংরক্ষণ করুন" })}
          </Button>
        </div>
      </div>
    </>
  );
}
