/* Lightweight, dependency-free map — an OpenStreetMap embed with a marker.
   Avoids pulling in a heavy map library (Leaflet/Mapbox) to keep the bundle
   small for rural networks. Source is swappable via mapsService. */
import { T } from "../theme/ThemeProvider.jsx";
import { mapsService } from "../services/maps/mapsService.js";
import { useApp } from "../store/AppStore.jsx";

export default function MapView({ lat, lon, height = 180, zoom = 13, radius = 0.04 }) {
  const { tc } = useApp();
  if (lat == null || lon == null) return null;
  const src = mapsService.embedUrl({ lat, lon, zoom, delta: radius });
  return (
    <div style={{ borderRadius: T.rLg, overflow: "hidden", border: `1px solid ${T.line}`, background: T.surface2 }}>
      <iframe
        title={tc({ en: "Map", hi: "नक्शा", bn: "মানচিত্র" })}
        src={src}
        width="100%"
        height={height}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ border: 0, display: "block" }}
      />
    </div>
  );
}
