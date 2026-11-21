// rStats.js demo: bundled standalone build of the library and mixed-models area.

import { applyI18n, getLang, initLang, setLang, t } from "./i18n.js";
import { h, setChildren, storage } from "./util.js";
import { createDistributionsTab } from "./distributions.js";
import { createSpecialTab } from "./special.js";
import { createRandomTab } from "./random.js";
import { createTestsTab } from "./tests.js";
import { createLinalgTab } from "./linalg.js";
import { createDescriptiveTab } from "./descriptive.js";
import { createNumericsTab } from "./numerics.js";
import { createCompareTab } from "./examples.js";
import * as lib from "@numero-uno-jpn/rstats";
import * as mixed from "@numero-uno-jpn/rstats/mixed";
import examplesFile from "./examples.json";
import rResults from "./r-results.json";

const VERSION = "v1.3.0";
const source = "bundled";
const libUrl = "@numero-uno-jpn/rstats";

const ALL_TABS = ["distributions", "descriptive", "special", "random", "tests", "linalg", "numerics", "compare"];
/** Tabs that need functions newer than some builds: shown only when the loaded build has them */
const NEEDS = { descriptive: "quantile", numerics: "integrate" };
let TAB_IDS = ALL_TABS;

const statusEl = document.getElementById("status");
const main = document.getElementById("main");
const tabsNav = document.getElementById("tabs");

// ---------- theme ----------

const THEMES = ["auto", "light", "dark"];
let theme = THEMES.includes(storage.get("rstats-demo-theme")) ? storage.get("rstats-demo-theme") : "auto";
const themeButton = document.getElementById("theme-toggle");
function applyTheme() {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  themeButton.textContent = `${t("theme.label")}: ${t(`theme.${theme}`)}`;
}
themeButton.addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  storage.set("rstats-demo-theme", theme);
  applyTheme();
});

// ---------- language ----------

const langButton = document.getElementById("lang-toggle");
const onLangChange = [];
function applyLang() {
  document.documentElement.lang = getLang();
  applyI18n(document);
  langButton.textContent = getLang() === "ja" ? "English" : "日本語";
  langButton.setAttribute("lang", getLang() === "ja" ? "en" : "ja");
  langButton.setAttribute("aria-label", t("lang.switch"));
  document.title = t("app.title");
  applyTheme();
  renderStatus();
  for (const fn of onLangChange) fn();
}
langButton.addEventListener("click", () => {
  setLang(getLang() === "ja" ? "en" : "ja");
  storage.set("rstats-demo-lang", getLang());
  applyLang();
});

// ---------- status line ----------

let state = { phase: "loading" };
function renderStatus() {
  statusEl.dataset.state = state.phase;
  statusEl.dataset.source = source;
  const where = t("status.local");
  if (state.phase === "loading") setChildren(statusEl, t("status.loading", VERSION, where));
  else if (state.phase === "error") setChildren(statusEl, h("span", { class: "status-bad", text: t("status.failed", where) }));
  else
    setChildren(
      statusEl,
      h("span", { class: "status-dot", "aria-hidden": "true" }),
      h("span", {}, t("status.loaded", VERSION, where, state.count)),
      " ",
      h("code", { class: "status-url", text: libUrl }),
    );
}

function showLoadError(err) {
  state = { phase: "error" };
  renderStatus();
  setChildren(
    main,
    h(
      "section",
      { class: "card load-error", role: "alert", "data-testid": "load-error" },
      h("h2", { class: "card-title", i18n: "load.title" }),
      h("p", {}, h("span", { i18n: "load.url" }), " ", h("code", { text: libUrl })),
      h("p", { class: "mono error-text", text: String(err?.message ?? err) }),
      h("p", { i18n: "load.localHint" }),
    ),
  );
}

// ---------- tabs ----------

function buildTabs(ctx) {
  TAB_IDS = ALL_TABS.filter((id) => !NEEDS[id] || ctx.lib[NEEDS[id]]);
  const factories = {
    distributions: createDistributionsTab,
    descriptive: createDescriptiveTab,
    numerics: createNumericsTab,
    special: createSpecialTab,
    random: createRandomTab,
    tests: createTestsTab,
    linalg: createLinalgTab,
    compare: createCompareTab,
  };
  const tabs = {};
  const buttons = {};
  const panels = {};
  for (const id of TAB_IDS) {
    buttons[id] = h("button", {
      type: "button",
      role: "tab",
      id: `tab-${id}`,
      class: "tab",
      "aria-controls": `panel-${id}`,
      "data-testid": `tab-${id}`,
      i18n: `tab.${id}`,
      on: { click: () => select(id, true), keydown: (e) => onKey(e, id) },
    });
    panels[id] = h("section", { role: "tabpanel", id: `panel-${id}`, class: "panel", "aria-labelledby": `tab-${id}`, "data-testid": `panel-${id}`, tabindex: "-1" });
  }
  setChildren(tabsNav, Object.values(buttons));
  setChildren(main, Object.values(panels));
  for (const id of TAB_IDS) {
    try {
      tabs[id] = factories[id](ctx);
      panels[id].append(tabs[id].el);
    } catch (e) {
      console.error(e);
      panels[id].append(h("p", { class: "error-box", role: "alert", text: `${t("error")}: ${e.message}` }));
    }
  }
  function select(id, focus = false) {
    for (const k of TAB_IDS) {
      const on = k === id;
      buttons[k].setAttribute("aria-selected", String(on));
      buttons[k].tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    }
    if (focus) buttons[id].focus();
    if (location.hash !== `#${id}`) history.replaceState(null, "", `${location.search}#${id}`);
  }
  function onKey(e, id) {
    const i = TAB_IDS.indexOf(id);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TAB_IDS.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    select(TAB_IDS[(next + TAB_IDS.length) % TAB_IDS.length], true);
  }
  const fromHash = () => (TAB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "distributions");
  window.addEventListener("hashchange", () => select(fromHash()));
  select(fromHash());
  onLangChange.push(() => {
    for (const tab of Object.values(tabs)) tab.update?.();
    for (const fn of ctx.refreshers) fn();
  });
}

async function start() {
  initLang(storage.get("rstats-demo-lang"), navigator.language);
  applyLang();
  const mixedNames = new Set(Object.keys(mixed));
  const ctx = {
    lib: { ...lib, ...mixed },
    examples: Array.isArray(examplesFile?.examples) ? examplesFile.examples : null,
    rResults: rResults?.results ? rResults : null,
    refreshers: [],
    importLine: (names) => {
      const unique = [...new Set(names)];
      const fromMixed = unique.filter((n) => mixedNames.has(n));
      const fromMain = unique.filter((n) => !mixedNames.has(n));
      return [
        ...(fromMain.length ? [`import { ${fromMain.join(", ")} } from "@numero-uno-jpn/rstats";`] : []),
        ...(fromMixed.length ? [`import { ${fromMixed.join(", ")} } from "@numero-uno-jpn/rstats/mixed";`] : []),
      ].join("\n");
    },
  };
  buildTabs(ctx);
  state = { phase: "ready", count: Object.keys(ctx.lib).length };
  renderStatus();
}

start();
