import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { Card, accent } from "../primitives.jsx";
import { Pill } from "../erp/RecordList.jsx";
import CapacityBar from "./CapacityBar.jsx";
import { warehouseMeta } from "../../services/logistics/constantsLog.js";
import { rupee } from "../../utils/format.js";

export default function WarehouseCard({ warehouse: w, onClick }) {
  const meta = warehouseMeta(w.type);
  const c = accent(w.accent || meta.accent);
  return (
    <Card pad={13} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg,
          display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={w.icon || meta.icon} size={20} color={c.fg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.ink, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
            {w.cold && <Pill fg={T.blue} bg={T.blueSoft}>Cold</Pill>}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {w.village} · {rupee(w.pricePerTonneMonth)}/t·mo
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <CapacityBar used={w.allocatedKg} total={w.capacityKg} />
      </div>
    </Card>
  );
}
