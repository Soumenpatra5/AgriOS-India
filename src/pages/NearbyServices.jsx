import { useCallback, useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Screen, Card, Chip, Spinner, EmptyState, ErrorState, IconTile } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { locationService } from "../services/location/locationService.js";
import { nearbyService, NEARBY_CATEGORIES, getCategory } from "../services/nearby/nearbyService.js";
import { mapsService } from "../services/maps/mapsService.js";

export default function NearbyServices() {
  const { pop, push, tc } = useApp();
  const [loc] = useState(() => locationService.getActive());
  const [cat, setCat] = useState(NEARBY_CATEGORIES[0].id);
  const [state, setState] = useState({ status: "idle", items: [] });

  const load = useCallback(async (categoryId) => {
    if (!loc) { setState({ status: "empty", items: [] }); return; }
    setState({ status: "loading", items: [] });
    try {
      const items = await nearbyService.find({ categoryId, lat: loc.lat, lon: loc.lon });
      setState({ status: "ready", items });
    } catch (err) {
      setState({ status: "error", items: [], timedOut: !!err?.timedOut });
    }
  }, [loc]);

  useEffect(() => { load(cat); }, [cat, load]);

  const category = getCategory(cat);
  const { status, items } = state;

  return (
    <>
      <AppBar title={tc({ en: "Nearby services", hi: "नज़दीकी सेवाएँ", bn: "কাছাকাছি সেবা" })} onBack={pop} />
      <Screen gap={14}>
        {!loc ? (
          <EmptyState icon="MapPin" title={tc({ en: "Set your location first", hi: "पहले अपना स्थान सेट करें", bn: "প্রথমে আপনার অবস্থান সেট করুন" })}
            body={tc({ en: "We need your farm location to find services near you.", hi: "आपके पास सेवाएँ खोजने के लिए हमें आपके खेत का स्थान चाहिए।", bn: "আপনার কাছাকাছি সেবা খুঁজতে আপনার খামারের অবস্থান দরকার।" })}
            action={tc({ en: "Set location", hi: "स्थान सेट करें", bn: "অবস্থান সেট করুন" })} onAction={() => push({ kind: "farmLocations" })} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.inkSoft, fontSize: 12.5, padding: "0 2px" }}>
              <Icon name="MapPin" size={14} style={{ color: T.primary }} /> {tc({ en: `Around ${loc.name}`, hi: `${loc.name} के आसपास`, bn: `${loc.name}-এর আশেপাশে` })}
            </div>

            {/* category chips */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {NEARBY_CATEGORIES.map((c) => (
                <Chip key={c.id} active={c.id === cat} icon={c.icon} onClick={() => setCat(c.id)}>{c.label}</Chip>
              ))}
            </div>

            {status === "loading" && (
              <div style={{ display: "grid", placeItems: "center", padding: "40px 0" }}><Spinner size={26} /></div>
            )}
            {status === "error" && (
              <ErrorState
                title={tc({ en: "Couldn't load services", hi: "सेवाएँ लोड नहीं हुईं", bn: "সেবা লোড হয়নি" })}
                /* Don't blame the farmer's connection when it was the free
                   OpenStreetMap service that stalled — they'd go hunting for a
                   fault that isn't theirs. */
                body={state.timedOut
                  ? tc({ en: "The map service is busy right now. Your connection is fine — try again in a moment.",
                         hi: "मानचित्र सेवा अभी व्यस्त है। आपका इंटरनेट ठीक है — थोड़ी देर बाद पुनः प्रयास करें।",
                         bn: "মানচিত্র পরিষেবা এখন ব্যস্ত। আপনার ইন্টারনেট ঠিক আছে — একটু পরে আবার চেষ্টা করুন।" })
                  : tc({ en: "Check your connection and try again.", hi: "इंटरनेट जाँचें और पुनः प्रयास करें।", bn: "ইন্টারনেট দেখে আবার চেষ্টা করুন।" })}
                onRetry={() => load(cat)} />
            )}
            {status === "ready" && items.length === 0 && (
              <EmptyState icon="SearchX" title={tc({ en: `No ${category.label.toLowerCase()} found nearby`, hi: `पास में कोई ${category.label.toLowerCase()} नहीं मिला`, bn: `কাছাকাছি কোনো ${category.label.toLowerCase()} পাওয়া যায়নি` })}
                body={tc({ en: "Nothing within 15 km on the map. Try another category.", hi: "15 किमी के भीतर कुछ नहीं मिला। दूसरी श्रेणी आज़माएँ।", bn: "১৫ কিমি-র মধ্যে কিছু পাওয়া যায়নি। অন্য বিভাগ চেষ্টা করুন।" })} />
            )}

            {status === "ready" && items.map((p) => (
              <Card key={p.id} pad={13} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <IconTile name={category.icon} a={category.accent} size={44} iconSize={21} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {tc({ en: `${p.distanceKm} km away`, hi: `${p.distanceKm} किमी दूर`, bn: `${p.distanceKm} কিমি দূরে` })}{p.address ? ` · ${p.address}` : ""}
                  </div>
                </div>
                <a href={mapsService.directionsUrl({ lat: p.lat, lon: p.lon })} target="_blank" rel="noreferrer"
                  aria-label="Directions"
                  style={{ background: T.primarySoft, color: T.primary, borderRadius: 12, padding: 9, display: "flex", flexShrink: 0 }}>
                  <Icon name="Navigation" size={18} />
                </a>
              </Card>
            ))}

            {status === "ready" && items.length > 0 && (
              <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>
                {tc({ en: "Places from OpenStreetMap · distances are straight-line", hi: "OpenStreetMap से स्थान · सीधी-रेखा दूरी", bn: "OpenStreetMap থেকে স্থান · সরলরেখা দূরত্ব" })}
              </div>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
