/**
 * Commands tab: the 74 studio commands grouped by pipeline phase.
 *
 * `CATALOG.commands` is already sorted by phase position then name at
 * generation time (Task 2 Step 4, backed by `tools/port/static/command-phases.md`
 * plus `test/command-phases-truth.test.ts`). This component only walks the
 * array once and starts a new group when `phase` changes — no sorting, no
 * groupBy, the data is already in the shape the panel needs.
 */
import type { CatalogCommand } from "./catalog.generated.js";
import type { GameStudioKey } from "./locales.js";

/** One contiguous run of commands sharing a phase. */
interface PhaseGroup {
  phase: string;
  commands: CatalogCommand[];
}

/** Translate function bound to the `game-studio` namespace. */
export type T = (key: GameStudioKey, params?: Record<string, unknown>) => string;

export interface CommandsTabProps {
  commands: readonly CatalogCommand[];
  onPick: (name: string) => void;
  t: T;
}

/**
 * Split a phase-sorted command array into contiguous phase groups, in one
 * linear pass. Not a groupBy: a phase name reappearing non-contiguously
 * would open a second group rather than merging into the first — that case
 * does not occur given the generator's sort, and command-phases-truth.test.ts
 * is what guards it.
 */
function toPhaseGroups(commands: readonly CatalogCommand[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const command of commands) {
    const current = groups[groups.length - 1];
    if (current === undefined || current.phase !== command.phase) {
      groups.push({ phase: command.phase, commands: [command] });
    } else {
      current.commands.push(command);
    }
  }
  return groups;
}

/** Phase display key, keyed off the literal phase name the catalog carries. */
function phaseTitleKey(phase: string): GameStudioKey {
  // Cast, not a lookup table: the 7 legal phase names are enforced upstream
  // by test/command-phases-truth.test.ts (Task 1), so this key always
  // resolves. A future mismatch would fall back to the raw "phase.X" string
  // (the locale service's own missing-key behavior — visible, not blank).
  return `phase.${phase}` as GameStudioKey;
}

export function CommandsTab({ commands, onPick, t }: CommandsTabProps): JSX.Element {
  const groups = toPhaseGroups(commands);
  return (
    <div className="gs-commands">
      {groups.map((group) => (
        <section className="gs-command-group" key={group.phase}>
          <h3 className="gs-command-group-title">{t(phaseTitleKey(group.phase))}</h3>
          <ul className="gs-command-list">
            {group.commands.map((command) => (
              <li key={command.name}>
                <button
                  type="button"
                  className="gs-command-row"
                  title={command.description}
                  onClick={() => {
                    onPick(command.name);
                  }}
                >
                  <span className="gs-command-name">/{command.name}</span>
                  <span className="gs-command-desc">{command.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
