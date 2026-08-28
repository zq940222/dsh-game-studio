/**
 * dsh-game-studio web client plugin: panel shell + commands/roles tabs.
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
 * ## Delegate prefill: `ctx.conversation.setDraft` doesn't exist either
 *
 * Task 5's brief has the delegate button call
 * `ctx.conversation.setDraft(\`按 gs-roster 协议委派给 ${'{'}role{'}'}：\`)`
 * directly on the root context. That call was never exercised at runtime —
 * the brief's own design doc lifted it from `SessionInputResolver`'s type
 * definition — and it fails the same way `ctx.conversation.send` failed
 * above: `setDraft` isn't even a method on `IConversation`
 * (`dsh-client-ui-conversation/client`'s `service.d.ts`); it lives on
 * `SessionInput`, the per-session facade `IConversation.input.for(actx)`
 * resolves, one level deeper than the brief's snippet reaches.
 *
 * The proven path, read out of the shipped
 * `@linxin666/dsh-client-ui-aionui-panel`'s own composer-drop-target code
 * (`src/client/index.ts`'s `conversation.input.dock` inject, which calls
 * this exact sequence to splice a dragged file path into the draft):
 *
 * ```ts
 * const actx  = ctx.sessions.scope(sessionId); // scoped ctx; undefined if no session
 * const shell = ctx.conversation.input.for(actx); // SessionInputResolver.for()
 * const draft = shell.state.getSnapshot().draft;  // read the existing draft first
 * shell.setDraft(withDelegationPrefix(draft, prefix)); // insert, never overwrite
 * ```
 *
 * Two things worth calling out, both load-bearing:
 *
 * - `conversation` is read off **this plugin's own `ctx`** (where the
 *   fiber inject below actually grants it), never off `actx` — `actx` is
 *   only ever used as the *argument* to `input.for(...)`. Dereferencing
 *   `.conversation` on `actx` itself would repeat the exact structural
 *   failure the command-dispatch section above already hit for
 *   `ctx.sessions.scope(id).conversation`: `actx` is a scoped context
 *   rooted under `SessionRuntime`'s own fiber, nowhere near where
 *   `dsh-client-ui-conversation` provides the service.
 * - The reference reads the draft before writing it and inserts into it.
 *   The brief's literal `setDraft(prefix)` would silently discard
 *   whatever the user had already typed — `withDelegationPrefix`
 *   (`delegate-prefix.ts`) prepends instead, and replaces any delegation
 *   prefix already leading the draft rather than stacking a new one on
 *   top of it, so browsing roles and clicking two or three in a row never
 *   leaves more than one prefix for the user to hand-clean. See that
 *   module's own doc comment for the fix history and the one accepted
 *   false-positive case.
 *
 * Unlike `"conversation"` in the command-dispatch section above (dropped
 * entirely — nothing in that path ever needed it), the delegate path
 * really does need the `conversation` service, so `"conversation"` is
 * added to `export const inject` below and to `package.json`'s
 * `dsh.client.inject` alongside `@deepseek-ai/dsh-client-ui-conversation`
 * (confirmed, via `dsh-web-app`'s own `package.json`, to be one of its
 * hard dependencies — not an optional sibling plugin — so gating this
 * fiber's `apply()` on it carries the same low risk `"sessions"` already
 * does, not the unbounded-hang risk the trap below warns about for an
 * optional service).
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
// Type-only: merges `conversation: IConversation` onto cordis Context (see the module doc's "delegate prefill" section).
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import { withDelegationPrefix } from "./delegate-prefix.js";
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

/** Required services: see the module doc for why each one is here — "conversation" is for the delegate-prefill path only ("send" was dropped). */
export const inject: string[] = ["sessions", "locale", "conversation"];

const ENTRY_ATTR = "data-dsh-game-studio-entry";

/**
 * Inline icon for the sidebar entry — a minimal gamepad silhouette (rounded
 * body, d-pad, one face button) on the same `0 0 16 16` viewBox, 14×14,
 * `stroke="currentColor"` shape the host's own plugin entries (task board,
 * SSH) use for theirs, captured verbatim from the live DOM. Static markup
 * (no interpolated data), so `innerHTML` is safe here; the label text next
 * to it is always set via `textContent` instead — see `mountSidebarEntry`.
 */
const ENTRY_ICON_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ' +
  'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="1.5" y="5.5" width="13" height="6" rx="3"></rect>' +
  '<path d="M4.6 7.6v1.8M3.7 8.5h1.8"></path>' +
  '<circle cx="11.2" cy="8.5" r="0.75" fill="currentColor" stroke="none"></circle>' +
  "</svg>";

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
 * Places the entry where it belongs relative to the sidebar root: after the
 * "new session" row and before the plugin-region divider, which is where
 * the host's own plugin entries (task board, SSH) already sit — measured on
 * the live DOM. `place()` used to `insertBefore(entry, root.firstChild)`,
 * which landed the entry above the product logo instead; that was defect 1
 * of the v0.2.0 invisible-entry bug (see `mountSidebarEntry`'s doc comment).
 *
 * Same local-name-fragment idiom `sidebarRoot()` already uses for hashed
 * CSS-module classes: `[class*="regionArea"]` is the divider itself,
 * `[class*="newSession"]` is the fallback anchor if a restyle ever drops
 * `regionArea`. Insertion always goes through the matched anchor's own
 * `parentNode` — not assumed to be `root` — since `querySelector` searches
 * the whole subtree and `Node.insertBefore` throws `NotFoundError` if the
 * reference node isn't a direct child of the node it's called on. If
 * neither anchor matches, `root.appendChild` is the last resort — still far
 * safer than the old before-firstChild placement, which was guaranteed
 * wrong (above the logo).
 * @param root - the sidebar root returned by `sidebarRoot()`.
 * @param entry - the entry button to place.
 */
function placeInSidebar(root: HTMLElement, entry: HTMLElement): void {
  const region = root.querySelector<HTMLElement>('[class*="regionArea"]');
  if (region !== null && region.parentNode !== null) {
    region.parentNode.insertBefore(entry, region);
    return;
  }
  const newSession = root.querySelector<HTMLElement>('[class*="newSession"]');
  if (newSession !== null && newSession.parentNode !== null) {
    newSession.parentNode.insertBefore(entry, newSession.nextSibling);
    return;
  }
  root.appendChild(entry);
}

/**
 * Mounts the sidebar entry button, waiting for the shell to render it and
 * self-healing if a shell re-render displaces the node. Known selector
 * fragility (accepted for now, per the brief): `sidebarRoot()` matches
 * CSS-module local-name fragments in hashed class names, so a shell
 * restyle can silently stop matching. Where Task 3 failed silently, this
 * logs once instead — a small, welcome visibility improvement, not a fix
 * for the fragility itself.
 *
 * A second failure mode gets the same treatment: the selector can keep
 * matching but land on the wrong element (a restyle that makes
 * `[class*="sidebarCol"]` hit something else). `insertBefore` then
 * succeeds, so `document.body.contains(entry)` is true forever and the
 * not-found branch above never fires again — the entry silently renders
 * nowhere the user can see it. Right after insertion this is checked with
 * `offsetParent`/`getBoundingClientRect` and warned once, same one-shot
 * pattern as the not-found case. This only makes the failure visible; it
 * does not attempt recovery.
 *
 * v0.2.0 shipped two further, independent ways for an inserted-and-visible
 * entry to still be invisible to a real user, both confirmed with direct
 * DOM measurement against a live shell and fixed here:
 *
 * - Defect 1 (position): the entry landed above the product logo instead of
 *   with the other plugin entries. Fixed by anchoring on
 *   `placeInSidebar()` instead of `root.firstChild`.
 * - Defect 2 (collapsed rail, no icon): the sidebar can be collapsed to a
 *   ~35px icon rail, where only an icon renders — a text-only entry has
 *   nothing to show, and (per the measurement) its whole-word text wrapped
 *   into a multi-line smear cut off by the rail's width. Fixed by giving
 *   the entry an icon span (`ENTRY_ICON_SVG`) ahead of a `nowrap` label
 *   span (`.gs-entry-label` in panel.css), matching the peers' own
 *   icon-span + label-span structure, plus `aria-label` so the accessible
 *   name survives even when the label itself is clipped away.
 * @param label - translated entry button text (also used as `aria-label`).
 * @param onToggle - called on every click.
 * @returns disposer removing the entry and its observer.
 */
function mountSidebarEntry(label: string, onToggle: () => void): () => void {
  const entry = document.createElement("button");
  entry.type = "button";
  entry.setAttribute(ENTRY_ATTR, "");
  entry.className = "gs-entry";
  entry.setAttribute("aria-label", label);

  const icon = document.createElement("span");
  icon.className = "gs-entry-icon";
  icon.innerHTML = ENTRY_ICON_SVG;
  entry.appendChild(icon);

  const labelEl = document.createElement("span");
  labelEl.className = "gs-entry-label";
  labelEl.textContent = label;
  entry.appendChild(labelEl);

  entry.addEventListener("click", onToggle);

  let warned = false;
  let warnedInvisible = false;
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
    placeInSidebar(root, entry);
    if (!warnedInvisible && (entry.offsetParent === null || entry.getBoundingClientRect().height === 0)) {
      warnedInvisible = true;
      console.warn(
        "[dsh-game-studio] sidebar entry was inserted but is not visible " +
          "(offsetParent is null or height is 0) — sidebarRoot() likely matched " +
          "the wrong element after a host restyle. The button exists in the DOM " +
          "but the user cannot see or click it; see mountSidebarEntry()'s doc comment.",
      );
    }
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
 * @param onDelegate - what a role card's delegate button does.
 * @returns a toggle function and a disposer.
 */
function mountPanel(
  ctx: ClientContext,
  onPick: (name: string) => void,
  onDelegate: (role: string) => void,
): { toggle: () => void; dispose: () => void } {
  const el = document.createElement("div");
  el.className = "gs-panel";
  el.hidden = true;
  document.body.appendChild(el);

  const root: Root = createRoot(el);
  root.render(createElement(Panel, { locale: ctx.locale, onPick, onDelegate }));

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
 * Best-effort fallback when the draft cannot be reached (no active
 * session, or the `conversation` service errors at call time): copies the
 * delegation prefix to the clipboard instead of losing it. Chosen over
 * `SessionInput.beginCommand` — that verb exists for the composer's
 * slash-command trigger machinery (it takes a `CommandClaim` + `TokenSpan`
 * naming an in-progress `/token` match), not for placing arbitrary text;
 * a role delegation is not a slash command, so it does not fit.
 * @param text - the text to copy.
 */
function copyDelegatePrefixToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch((error: unknown) => {
    console.error("[dsh-game-studio] clipboard write failed", error);
  });
}

/**
 * Builds the role-card delegate button's click handler. See the module
 * doc's "delegate prefill" section for why this is
 * `sessions.scope(id)` + `conversation.input.for(actx)` + a read-then-write
 * `setDraft`, not the brief's bare `ctx.conversation.setDraft(...)` (that
 * method does not exist on `IConversation` at all).
 * @param ctx - client context (`sessions`, `conversation`, `locale` injected).
 * @param t - bound translator (identity is stable; it reads the active
 * locale at call time — see `LocaleRuntime.bind`'s own doc comment — so
 * reusing the one instance `apply()` already created stays fresh across
 * a later locale switch, same as `Panel.tsx`'s own `t`).
 * @returns handler for a role name (prefills, never sends).
 */
function makeOnDelegate(ctx: ClientContext, t: (key: GameStudioKey, params?: Record<string, unknown>) => string): (role: string) => void {
  return (role: string) => {
    const prefix = t("role.delegatePrefix", { role });
    const sessionId = ctx.sessions.list.getSnapshot().current;
    const actx = sessionId === undefined ? undefined : ctx.sessions.scope(sessionId);
    if (actx === undefined) {
      console.warn(`[dsh-game-studio] no active session — copying the delegate prefix for ${role} to the clipboard instead`);
      copyDelegatePrefixToClipboard(prefix);
      return;
    }
    try {
      const shell = ctx.conversation.input.for(actx);
      const draft = shell.state.getSnapshot().draft;
      shell.setDraft(withDelegationPrefix(draft, prefix));
    } catch (error) {
      // Log, never throw: a failed prefill must degrade the panel, not the GUI.
      console.error(`[dsh-game-studio] delegate prefill failed for ${role}`, error);
      copyDelegatePrefixToClipboard(prefix);
    }
  };
}

/**
 * Client plugin entry point.
 * @param ctx - client cordis context (`sessions`, `locale`, `conversation` injected).
 */
export function apply(ctx: ClientContext): void {
  if (!claimApply()) return;
  ctx.effect(() => releaseApply, "dsh-game-studio: apply claim");

  console.log("[dsh-game-studio] client apply() running");

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-game-studio: dictionaries");

  const t = ctx.locale.bind(NS);
  const onPick = makeOnPick(ctx);
  const onDelegate = makeOnDelegate(ctx, t);

  ctx.effect(() => {
    const panel = mountPanel(ctx, onPick, onDelegate);
    const disposeEntry = mountSidebarEntry(t("entry.label"), panel.toggle);
    return () => {
      disposeEntry();
      panel.dispose();
    };
  }, "dsh-game-studio: panel + sidebar entry");
}
