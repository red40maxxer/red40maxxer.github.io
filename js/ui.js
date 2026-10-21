(function () {
  "use strict";
  var root = document.documentElement;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function setAttr(name, value) {
    if (value) root.setAttribute(name, value); else root.removeAttribute(name);
  }

  function apply(kind, value) {
    var attr = kind === "skin" ? "data-skin" : "data-font";
    setAttr(attr, value);
    document.querySelectorAll("[data-set-" + kind + "]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set-" + kind) === value));
    });
    store("gridkit-" + kind, value);
    if (kind === "font") document.dispatchEvent(new CustomEvent("gridkit:fontchange"));
  }

  function boot() {
    ["skin", "font"].forEach(function (kind) {
      var saved = store("gridkit-" + kind);
      apply(kind, saved || root.getAttribute(kind === "skin" ? "data-skin" : "data-font") || "");
      document.querySelectorAll("[data-set-" + kind + "]").forEach(function (b) {
        b.addEventListener("click", function () { apply(kind, b.getAttribute("data-set-" + kind)); });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
