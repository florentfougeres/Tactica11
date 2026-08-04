(function () {
  try {
    var saved = localStorage.getItem("tactica11.theme");
    var theme =
      saved === "dark" || saved === "light"
        ? saved
        : matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    // storage/matchMedia unavailable — dark (the CSS default) just applies
  }
})();
