export type ThemePref = "dark" | "light" | "system";

export const THEME_KEY = "spil-theme";
export const THEME_COLOR = { dark: "#101114", light: "#F1F2F4" } as const;

// Runs inline in <head> before first paint, so it must be plain ES5 with no imports.
// dark is the default; "system" removes the attribute and the media query in tokens.css decides.
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=document.documentElement;if(p==="light"){d.dataset.theme="light"}else if(p==="system"){d.removeAttribute("data-theme")}else{d.dataset.theme="dark"}var l=p==="light"||(p==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",l?"${THEME_COLOR.light}":"${THEME_COLOR.dark}")}catch(e){document.documentElement.dataset.theme="dark"}})();`;
