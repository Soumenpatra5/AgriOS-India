import { useState, useEffect, useCallback, createContext, useContext } from "react";

const RouterCtx = createContext();

export function useRouter() { return useContext(RouterCtx); }

export function RouterProvider({ children }) {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/");

  useEffect(() => {
    const handler = () => setRoute(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((path) => { location.hash = path; }, []);

  const path = route.split("?")[0];
  const params = Object.fromEntries(new URLSearchParams(route.split("?")[1] || ""));

  return (
    <RouterCtx.Provider value={{ route: path, params, navigate }}>
      {children}
    </RouterCtx.Provider>
  );
}

export function AdminRouter({ routes, fallback: Fallback }) {
  const { route } = useRouter();
  const path = route.split("?")[0];
  const Page = routes[path] || Fallback;
  return <Page />;
}
