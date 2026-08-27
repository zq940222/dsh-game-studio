/**
 * dsh-game-studio web client plugin — Task 3's format-proving probe.
 *
 * This is deliberately NOT the real panel. Task 3 exists to answer one
 * question before any UI gets built: can the web host load a bundle this
 * package produces at all? Everything here is scoped to answering that —
 * one sidebar entry that opens a panel rendering a single line of text
 * sourced from the generated catalog. No commands tab, no roles tab, no
 * catalog rendering.
 *
 * No cordis client services are used, and `inject` is deliberately empty.
 * The task-3-brief's Step 2 example registers into the
 * `web-ui.plugin.item` slot (copied from the reference package,
 * `@linxin666/dsh-client-ui-task-board`'s `src/client/index.ts`) — but
 * reading the rest of that reference shows that slot is a *settings-card*
 * seat declared by a sibling "Web UI settings group" plugin the reference
 * package depends on, not by dsh core or `@deepseek-ai/dsh-web-app`
 * (confirmed: `web-ui.plugin.item` does not appear anywhere in the
 * globally installed `@deepseek-ai/dsh` package). A throwaway profile
 * seeded with only dsh-base + dsh-web-app never declares it, so
 * `ctx.slots.inject`'s callback would simply never fire — the probe would
 * silently render nothing, a false failure of this task's hard gate.
 *
 * The reference package's OWN actual sidebar entry
 * (`src/client/sidebar-entry.ts`) and its OWN actual panel mount
 * (`src/client/board-mount.tsx`) use neither `ctx.slots` nor any other
 * cordis service: both are raw DOM injection against the shell's rendered
 * markup, self-healing through a `MutationObserver`, because — per that
 * file's own doc comment — "dsh's sidebar shell exposes no slot an
 * external plugin can register into." This file copies that shape
 * instead of the brief's snippet; see task-3-report.md for the full
 * comparison.
 *
 * @module dsh-game-studio/client
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CATALOG } from "./catalog.generated.js";
import panelCss from "./panel.css";

/**
 * No cordis service this probe touches (see the module doc above). An
 * empty `inject` means `apply` runs as soon as this plugin's fiber
 * starts, with no wait on a service a bare profile might never register.
 */
export const inject: string[] = [];

const ENTRY_ATTR = "data-dsh-game-studio-entry";
const STYLE_ID = "dsh-game-studio-client-style";

/**
 * Locates the sidebar's DOM root. Same two-selector fallback and
 * logo-row heuristic as the reference `sidebar-entry.ts`'s `sidebarRoot`:
 * `[data-pane="sidebar"]` on current shells, a `sidebarCol`-ish class on
 * older ones; within that, prefer the element that owns the logo row
 * (the actual rendered sidebar root) and fall back to the pane's first
 * child.
 * @returns the sidebar root element, or undefined while the shell has
 * not mounted it yet.
 */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]');
  if (column === null) return undefined;
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement;
  return logoOwner ?? (column.firstElementChild as HTMLElement | null) ?? undefined;
}

/** Injects this probe's stylesheet as a single <style> tag (idempotent). */
function injectStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = panelCss;
  document.head.appendChild(style);
}

/**
 * Mounts the sidebar entry button, waiting for the shell to render it and
 * self-healing if a shell re-render displaces the node — without this, a
 * React reconciliation pass over the sidebar tears out any DOM node it
 * did not itself create, and the entry silently vanishes.
 * @param onToggle - called on every click.
 * @returns disposer removing the entry and its observer.
 */
function mountSidebarEntry(onToggle: () => void): () => void {
  const entry = document.createElement("button");
  entry.type = "button";
  entry.setAttribute(ENTRY_ATTR, "");
  entry.className = "gs-entry";
  entry.textContent = "Game Studio";
  entry.addEventListener("click", onToggle);

  const place = (): void => {
    if (document.body.contains(entry)) return;
    const root = sidebarRoot();
    if (root === undefined) return;
    root.insertBefore(entry, root.firstChild);
  };

  const observer = new MutationObserver(place);
  observer.observe(document.body, { childList: true, subtree: true });
  place();

  return () => {
    observer.disconnect();
    entry.remove();
  };
}

/**
 * Mounts the floating panel (hidden until the sidebar entry is clicked).
 * Rendered through React so the bundle's `react` / `react-dom/client`
 * externals actually get exercised at materialization time, not just
 * declared — that require() path is exactly what Task 3 is proving out
 * for every later task's real UI.
 * @returns a toggle function and a disposer.
 */
function mountPanel(): { toggle: () => void; dispose: () => void } {
  const el = document.createElement("div");
  el.className = "gs-panel";
  el.hidden = true;
  document.body.appendChild(el);

  const root: Root = createRoot(el);
  root.render(
    createElement(
      "span",
      { className: "gs-panel-line" },
      `dsh-game-studio: ${CATALOG.roles.length} roles, ${CATALOG.commands.length} commands loaded`,
    ),
  );

  return {
    toggle: () => {
      el.hidden = !el.hidden;
    },
    dispose: () => {
      root.unmount();
      el.remove();
    },
  };
}

/**
 * Client plugin entry point. See the module doc for why this does so
 * little — proving the bundle format and the build-time purity gate is
 * the entire job of Task 3, not building the real panel.
 * @param ctx - client cordis context; unused (see module doc).
 */
export function apply(ctx: unknown): void {
  void ctx;
  // The one signal a browser console check can use to tell "the factory
  // never materialized" apart from "apply ran, but mounting failed".
  console.log("[dsh-game-studio] client apply() running");

  injectStyle();
  const panel = mountPanel();
  mountSidebarEntry(panel.toggle);
}
