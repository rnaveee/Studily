(function () {
  const stored = localStorage.getItem("studily.theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = stored === "dark" || (!stored && prefersDark);
  if (dark) document.documentElement.classList.add("dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0c0c10" : "#f3f3f7");
})();
