/**
 * Panel shell: two tabs (Commands, Roles) inside the floating view Task 3
 * mounted. Commands lists 74 studio commands by pipeline phase
 * (CommandsTab); Roles lists the 49 role briefs by department (RolesTab),
 * each expandable, each with a button that prefills a delegation prompt
 * into the composer (never sends it — see index.ts's module doc for why
 * `ctx.conversation.setDraft` needs both `sessions.scope(id)` and
 * `conversation.input.for(actx)`, not a bare `ctx.conversation.setDraft`
 * call).
 *
 * Style delivery follows the brief literally: `panel.css` arrives as a
 * string via esbuild's `text` loader, and this component creates the one
 * `<style>` element itself, on mount (not at plugin apply() time) — see the
 * effect below. It is idempotent (STYLE_ID guard) and removes the tag on
 * unmount, so a hot-reloaded bundle with changed CSS re-injects fresh
 * styles instead of the id check silently skipping a stale sheet.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LocaleRuntime } from "@deepseek-ai/dsh-client-locale/client";
import { CATALOG } from "./catalog.generated.js";
import { CommandsTab } from "./CommandsTab.js";
import { NS } from "./locales.js";
import { RolesTab } from "./RolesTab.js";
import panelCss from "./panel.css";

const STYLE_ID = "dsh-game-studio-client-style";

export interface PanelProps {
  /** The locale service itself (not a pre-bound `t`): lets the panel re-bind on every render, and subscribe to switches. */
  locale: LocaleRuntime;
  onPick: (name: string) => void;
  onDelegate: (role: string) => void;
}

type Tab = "commands" | "roles";

/** Injects panel.css once per page, and removes it when the last Panel instance unmounts. */
function useInjectedStyle(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID) !== null) return undefined;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = panelCss;
    document.head.appendChild(style);
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);
}

export function Panel({ locale, onPick, onDelegate }: PanelProps): JSX.Element {
  useInjectedStyle();

  // Re-render on locale switch: `locale.bind(NS)` itself always reads the
  // active locale at call time, but React only re-renders on its own signal
  // — this subscription is that signal. Proportionate, not more: no local
  // state, just a revision counter to force a re-render.
  useSyncExternalStore(
    (onChange) => locale.subscribe(onChange),
    () => locale.getSnapshot().revision,
  );
  const t = locale.bind(NS);

  const [tab, setTab] = useState<Tab>("commands");

  return (
    <div className="gs-panel-body">
      <div className="gs-panel-header">
        <span className="gs-panel-title">{t("panel.title")}</span>
      </div>
      <div className="gs-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "commands"}
          className={tab === "commands" ? "gs-tab gs-tab-active" : "gs-tab"}
          onClick={() => {
            setTab("commands");
          }}
        >
          {t("tab.commands")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "roles"}
          className={tab === "roles" ? "gs-tab gs-tab-active" : "gs-tab"}
          onClick={() => {
            setTab("roles");
          }}
        >
          {t("tab.roles")}
        </button>
      </div>
      <div className="gs-tab-panel">
        {tab === "commands" ? (
          <>
            <p className="gs-panel-summary">{t("commands.summary", { count: CATALOG.commands.length })}</p>
            <CommandsTab commands={CATALOG.commands} onPick={onPick} t={t} />
          </>
        ) : (
          <>
            <p className="gs-panel-summary">{t("roles.summary", { count: CATALOG.roles.length })}</p>
            <RolesTab roles={CATALOG.roles} onDelegate={onDelegate} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
