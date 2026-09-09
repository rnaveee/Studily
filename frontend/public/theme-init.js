(function () {
  const stored = localStorage.getItem("studily.theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = stored === "dark" || (!stored && prefersDark);
  const classic = localStorage.getItem("studily.ui") === "classic";
  if (dark) document.documentElement.classList.add("dark");
  if (classic) document.documentElement.classList.add("classic");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color = classic
      ? (dark ? "#16161e" : "#ffffff")
      : (dark ? "#0a0e1a" : "#eef0f7");
    meta.setAttribute("content", color);
  }
})();
