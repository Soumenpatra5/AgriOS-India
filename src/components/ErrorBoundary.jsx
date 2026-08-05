import { Component } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";

/* Catches render/runtime errors in the subtree so one broken screen never
   white-screens the whole app. `resetKey` (e.g. the active route) clears the
   error automatically on navigation. `onReset`/`variant` tune recovery:
   - variant "screen": a single crashed page, offers "Go back".
   - variant "root":   the whole app, offers "Reload app". */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const root = this.props.variant === "root";
    const label = root ? "Reload app" : "Go back";
    const action = root ? () => location.reload() : this.handleReset;

    return (
      <div style={{ minHeight: root ? "100vh" : 320, display: "grid", placeItems: "center", padding: 32, background: T.bg }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: T.redSoft, color: T.red,
            display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="AlertTriangle" size={28} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>
            {root
              ? "The app hit an unexpected error. Reloading usually fixes it — your data is saved on this device."
              : "This screen ran into a problem. You can go back and try again — nothing was lost."}
          </div>
          <button onClick={action}
            style={{ padding: "12px 24px", borderRadius: T.pill, border: "none", cursor: "pointer",
              background: T.primary, color: T.onPrimary, fontSize: 14, fontWeight: 600, fontFamily: T.body,
              display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name={root ? "RefreshCw" : "ArrowLeft"} size={16} /> {label}
          </button>
        </div>
      </div>
    );
  }
}
