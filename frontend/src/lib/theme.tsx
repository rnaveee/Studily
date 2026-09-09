import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
  classic: boolean;
  setClassic: (classic: boolean) => void;
}

const Ctx = createContext<ThemeCtx>({
  dark: false,
  toggle: () => {},
  classic: false,
  setClassic: () => {},
});

const THEME_COLOR = {
  modern: { dark: "#08090e", light: "#eef0f7" },
  classic: { dark: "#16161e", light: "#ffffff" },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [classic, setClassic] = useState(() =>
    document.documentElement.classList.contains("classic"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("studily.theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    document.documentElement.classList.toggle("classic", classic);
    localStorage.setItem("studily.ui", classic ? "classic" : "modern");
  }, [classic]);

  useEffect(() => {
    const palette = classic ? THEME_COLOR.classic : THEME_COLOR.modern;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? palette.dark : palette.light);
  }, [dark, classic]);

  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d), classic, setClassic }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}
