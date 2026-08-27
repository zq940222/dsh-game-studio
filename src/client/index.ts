/**
 * dsh-game-studio web client plugin: panel shell + commands tab.
 *
 * Extends Task 3's proven mount (sidebar entry + floating panel, both raw
 * DOM against the shell's rendered markup — see that file's history for why:
 * no generic sidebar slot exists, and the one documented additive surface,
 * `shell.overlay`, is a `ui-layout`-declared slot this bundle would need a
 * new `slots` inject for. Raw DOM is proven on this real shell already;
 * `shell.overlay` is an untested path that would also need toggle-state
 * plumbing between the raw-DOM entry and a slot-rendered tree, so it stays
 * on the shelf — the brief marks it optional ("if it fits better than what
 * is there now"), and it doesn't yet).
 *
 * ## Command dispatch: not `ctx.conversation`, and not the brief's inject list either
 *
 * The brief's Step 2 has `onPick` call `ctx.conversation.send(\`/${name}\`)`,
 * and item (A) says the only two new services this task injects are
 * `"conversation"` and `"locale"`. Both turned out wrong on the real
 * machine, in three stages (Step 5's real-machine check hit each in turn,
 * console-logged verbatim):
 *
 * 1. `ctx.conversation.send` is scope-addressed — it resolves the caller's
 *    session via `ctx.sessions.scopeOf(this.ctx)` internally, and this
 *    plugin's own root `ctx` carries no session tag, so it throws
 *    `"conversation.send requires a session scope — address one via
 *    ctx.sessions.scope(id).conversation"`. That message's own suggested
 *    fix is the second failure: `ctx.sessions.scope(id)` mints a *new*
 *    plugin fiber (`ctx.plugin(agentScope)`, confirmed in
 *    `dsh-client-runtime`'s compiled `client.js`), rooted under
 *    `SessionRuntime`'s own construction context — nowhere near this
 *    plugin's position in the tree, and nowhere near wherever
 *    `dsh-client-ui-conversation` provides `conversation`. Accessing
 *    `.conversation` on that scoped context walks *its* fiber ancestry
 *    looking for the service and never finds it, throwing cordis's own
 *    `"cannot get property \"conversation\" without inject"` — a structural
 *    access error, not the session-scope business error the first throw
 *    promised.
 *
 * 2. The obvious-looking fix, `ISession.command(line)` — `SessionFace`'s
 *    purpose-built verb for "execute one slash-command line against this
 *    session's agent" (`dsh-client-runtime/client`'s
 *    `contract/session.d.ts`), reached through `ctx.sessions.binding(id)`
 *    with no scope dance and no `conversation` service — resolves cleanly
 *    but comes back `{ ok: true, value: { matched: false } }` for every
 *    `gs-*` name. Confirmed by contrast: typing the identical `/gs-ping`
 *    into the real composer and pressing Enter *does* run it, appearing in
 *    the transcript as a "Skill" turn. `.command()` dispatches against the
 *    host's native-command registry (`/help`, `/clear`, `/compact` — the
 *    small fixed set `dsh-native-command` and siblings register); the 74
 *    `gs-*` triggers are skill-catalog entries the agent loop matches
 *    against ordinary prompt text, not native commands at all.
 *
 * 3. The actual fix: `ISession.prompt(content, mode)` — the same verb the
 *    shipped reference package uses for sending into a session
 *    (`@linxin666/dsh-client-ui-task-board`'s `ExecutionService`, via
 *    `sessions.binding(id)?.session.prompt(...)`) — with `/${name}` as a
 *    single text content part and `mode: "queue"`. This is functionally
 *    what `ctx.conversation.send` was always going to do (its own doc
 *    comment: "sent verbatim as one text block"); `.prompt()` just reaches
 *    it through a path an external plugin can actually use. It also means
 *    the `"conversation"` fiber inject and the
 *    `@deepseek-ai/dsh-client-ui-conversation` manifest inject the brief
 *    called for are simply unused — dropped, per this file's own standing
 *    rule (declare only what the factory actually calls).
 *
 * The one part of the brief's inject guidance that *was* incomplete rather
 * than wrong: `"sessions"` needs to be injected too (not named by the
 * brief's item (A) at all), both here and in `package.json`'s
 * `dsh.client.inject` (`@deepseek-ai/dsh-client-runtime` — confirmed, via
 * the reference package's own manifest, to be the package that supplies
 * the `sessions` service).
 *
 * ## The inject trap (carried from Task 3's review)
 *
 * A service named in `export const inject` gates `apply()`: it will not run
 * until every named service is available on `ctx`. Naming a service here
 * without also declaring the *package* that provides it in this file's
 * `package.json` (`dsh.client.inject`) means a profile that never wires
 * that package in leaves `apply()` waiting forever, with no error — exactly
 * what cost Task 3 hours before it landed on an empty `inject`.
 *
 * ## Double-mount guard and observer lifetime (also carried from review)
 *
 * `claimApply`/`releaseApply` below follow the shape of the reference
 * package's `apply-guard.ts` (a `globalThis` flag, first claim wins,
 * released on fiber unload) without adding a new file for it — this
 * plugin's guard is two functions, not a module. `mountSidebarEntry`'s
 * `MutationObserver` used to run unbounded on `document.body` for the page
 * lifetime because Task 3's `apply()` discarded the disposer it returned;
 * that — not the observer's own logic — was the actual bug. It is now
 * wired through `ctx.effect`, so fiber unload disconnects it (matching the
 * reference's own answer: keep observing for self-heal, disconnect only on
 * disposal — the cheap `document.body.contains(entry)` short-circuit
 * already keeps steady-state cost low).
 *
 * @module dsh-game-studio/client
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
// Type-only: merges `locale: LocaleRuntime` onto cordis Context and pulls in LocaleNamespaceMap.
import type {} from "@deepseek-ai/dsh-client-locale/client";
import { Panel } from "./Panel.js";
import { en, NS, zh, type GameStudioKey } from "./locales.js";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    /** Panel copy: title, tab names, phase labels, command/role count text. */
    "game-studio": GameStudioKey;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __dshGameStudioApplied: boolean | undefined;
}

/** Claims the plugin apply slot; false when another live instance already holds it (a duplicated fiber apply, an HMR re-injection). */
function claimApply(): boolean {
  if (globalThis.__dshGameStudioApplied === true) return false;
  globalThis.__dshGameStudioApplied = true;
  return true;
}

/** Releases the claim (wired through `ctx.effect`, runs on fiber unload) so a rebuilt bundle can claim again in the same page. */
function releaseApply(): void {
  globalThis.__dshGameStudioApplied = undefined;
}

/** Required services: see the module doc for why each one is here (and why "conversation" isn't). */
export const inject: string[] = ["sessions", "locale"];

const ENTRY_ATTR = "data-dsh-game-studio-entry";

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

/**
 * Mounts the sidebar entry button, waiting for the shell to render it and
 * self-healing if a shell re-render displaces the node. Known selector
 * fragility (accepted for now, per the brief): `sidebarRoot()` matches
 * CSS-module local-name fragments in hashed class names, so a shell
 * restyle can silently stop matching. Where Task 3 failed silently, this
 * logs once instead — a small, welcome visibility improvement, not a fix
 * for the fragility itself.
 * @param label - translated entry button text.
 * @param onToggle - called on every click.
 * @returns disposer removing the entry and its observer.
 */
function mountSidebarEntry(label: string, onToggle: () => void): () => void {
  const entry = document.createElement("button");
  entry.type = "button";
  entry.setAttribute(ENTRY_ATTR, "");
  entry.className = "gs-entry";
  entry.textContent = label;
  entry.addEventListener("click", onToggle);

  let warned = false;
  const place = (): void => {
    if (document.body.contains(entry)) return;
    const root = sidebarRoot();
    if (root === undefined) {
      if (!warned) {
        warned = true;
        console.warn(
          "[dsh-game-studio] sidebar root not found (selectors: " +
            '[data-pane="sidebar"], [class*="sidebarCol"]) — the entry button ' +
            "could not be placed. This selector matches hashed-class fragments " +
            "and is known-fragile; see sidebarRoot()'s doc comment.",
        );
      }
      return;
    }
    warned = false;
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
 * @param ctx - client context (passed through for the locale service; the
 * panel re-binds its own `t` on every render — see Panel.tsx).
 * @param onPick - what a command row's click does.
 * @returns a toggle function and a disposer.
 */
function mountPanel(ctx: ClientContext, onPick: (name: string) => void): { toggle: () => void; dispose: () => void } {
  const el = document.createElement("div");
  el.className = "gs-panel";
  el.hidden = true;
  document.body.appendChild(el);

  const root: Root = createRoot(el);
  root.render(createElement(Panel, { locale: ctx.locale, onPick }));

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
 * Builds the command-row click handler. See the module doc's "command
 * dispatch" section for why this is `session.prompt([...], "queue")`
 * through a session binding — not `ctx.conversation.send` (throws for an
 * external plugin on this real shell) and not `session.command(line)`
 * (matches against native commands only; `/gs-*` are skill triggers sent
 * as ordinary prompt text).
 * @param ctx - client context (`sessions` injected).
 * @returns handler for a command name (without the leading `/`).
 */
function makeOnPick(ctx: ClientContext): (name: string) => void {
  return (name: string) => {
    const sessionId = ctx.sessions.list.getSnapshot().current;
    if (sessionId === undefined) {
      console.warn(`[dsh-game-studio] no active session — open or start one, then run /${name} again`);
      return;
    }
    const binding = ctx.sessions.binding(sessionId);
    if (binding === undefined) {
      console.warn(`[dsh-game-studio] session "${sessionId}" resolved no binding — /${name} was not sent`);
      return;
    }
    binding.session
      .prompt([{ type: "text", text: `/${name}` }], "queue")
      .then((result) => {
        if (!result.ok) {
          console.error(`[dsh-game-studio] /${name} failed: ${result.error.code}: ${result.error.message}`);
        }
      })
      .catch((error: unknown) => {
        // Log, never throw: a failed send must degrade the panel, not the GUI.
        console.error(`[dsh-game-studio] /${name} failed to send`, error);
      });
  };
}

/**
 * Client plugin entry point.
 * @param ctx - client cordis context (`sessions`, `locale` injected).
 */
export function apply(ctx: ClientContext): void {
  if (!claimApply()) return;
  ctx.effect(() => releaseApply, "dsh-game-studio: apply claim");

  console.log("[dsh-game-studio] client apply() running");

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-game-studio: dictionaries");

  const t = ctx.locale.bind(NS);
  const onPick = makeOnPick(ctx);

  ctx.effect(() => {
    const panel = mountPanel(ctx, onPick);
    const disposeEntry = mountSidebarEntry(t("entry.label"), panel.toggle);
    return () => {
      disposeEntry();
      panel.dispose();
    };
  }, "dsh-game-studio: panel + sidebar entry");
}
