/* Curated icon registry. Shell-critical icons are imported eagerly (always in the
   initial bundle). The remaining ~190 icons live in iconRegistryDeferred.js and
   load via a single dynamic import that fires immediately — by the time any lazy
   screen renders they are already available. Unknown names fall back to Circle. */
import {
  Circle,
  AlertTriangle, Bell, BellRing, Bot, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight,
  CloudOff, CloudSun, Download, Droplets,
  Info, Languages, LocateFixed, MapPin, Microscope,
  ScanLine, Search, Sparkles, Sun, Wind,
} from "lucide-react";

const EAGER = {
  Circle,
  AlertTriangle, Bell, BellRing, Bot, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight,
  CloudOff, CloudSun, Download, Droplets,
  Info, Languages, LocateFixed, MapPin, Microscope,
  ScanLine, Search, Sparkles, Sun, Wind,
};

let deferred = {};
// Fires immediately on first import of Icon.jsx — well before any lazy screen loads.
import("./iconRegistryDeferred.js").then((m) => { deferred = m; });

export default function Icon({ name, size = 20, color = "currentColor", strokeWidth = 2, style }) {
  const Cmp = EAGER[name] || deferred[name] || Circle;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
