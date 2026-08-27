/**
 * Roles tab: the 49 role briefs grouped by department.
 *
 * `CATALOG.roles` is already sorted by department, then tier ascending,
 * then role name, at generation time (Task 2 Step 4). This component only
 * walks the array once and starts a new group when `department` changes —
 * no sorting, no groupBy, exactly `CommandsTab.tsx`'s `toPhaseGroups`
 * pattern applied to the other catalog array.
 *
 * A role card starts collapsed (just its name and tier). Clicking it
 * expands to show **only the five frontmatter keys** — `role`,
 * `description`, `department`, `tier`, `modelTier` — plus the brief's
 * content-relative path and the delegate button. It deliberately does not
 * summarise the brief body: `## Responsibilities` / `## Collaboration`
 * exist in only 19 of 49 briefs, so a body-driven card would leave 30
 * roles with empty sections (spec U7 / global-constraints.md).
 */
import { useState } from "react";
import type { CatalogRole } from "./catalog.generated.js";
import type { GameStudioKey } from "./locales.js";

/** Translate function bound to the `game-studio` namespace. */
export type T = (key: GameStudioKey, params?: Record<string, unknown>) => string;

export interface RolesTabProps {
  roles: readonly CatalogRole[];
  onDelegate: (role: string) => void;
  t: T;
}

/** One contiguous run of roles sharing a department. */
interface DepartmentGroup {
  department: string;
  roles: CatalogRole[];
}

/**
 * Split a department-sorted role array into contiguous department groups,
 * in one linear pass. Mirrors `CommandsTab.tsx`'s `toPhaseGroups`: not a
 * groupBy, a department name reappearing non-contiguously would open a
 * second group rather than merging into the first — the generator's sort
 * (tools/catalog/build-catalog.mjs) is what guards against that ever
 * happening.
 */
function toDepartmentGroups(roles: readonly CatalogRole[]): DepartmentGroup[] {
  const groups: DepartmentGroup[] = [];
  for (const role of roles) {
    const current = groups[groups.length - 1];
    if (current === undefined || current.department !== role.department) {
      groups.push({ department: role.department, roles: [role] });
    } else {
      current.roles.push(role);
    }
  }
  return groups;
}

/** Department display key, keyed off the literal department name the catalog carries. */
function departmentTitleKey(department: string): GameStudioKey {
  // Cast, not a lookup table: the 8 legal department names are the
  // generator's own output (tools/catalog/build-catalog.mjs reading
  // roles/*.md frontmatter), so this key always resolves. A future new
  // department would fall back to the raw "department.X" string (the
  // locale service's own missing-key behavior — visible, not blank).
  return `department.${department}` as GameStudioKey;
}

/** One role card: collapsed by default, expands in place on click. */
function RoleCard({ role, onDelegate, t }: { role: CatalogRole; onDelegate: (role: string) => void; t: T }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="gs-role-item">
      <button
        type="button"
        className="gs-role-row"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((value) => !value);
        }}
      >
        <span className="gs-role-name">{role.role}</span>
        <span className="gs-role-tier-badge">T{role.tier}</span>
      </button>
      {expanded ? (
        <div className="gs-role-detail">
          <dl className="gs-role-fields">
            <dt>{t("role.field.role")}</dt>
            <dd>{role.role}</dd>
            <dt>{t("role.field.description")}</dt>
            <dd>{role.description}</dd>
            <dt>{t("role.field.department")}</dt>
            <dd>{role.department}</dd>
            <dt>{t("role.field.tier")}</dt>
            <dd>{role.tier}</dd>
            <dt>{t("role.field.modelTier")}</dt>
            <dd>{role.modelTier}</dd>
          </dl>
          <p className="gs-role-note">{t("role.modelTierNote")}</p>
          <p className="gs-role-path">
            <span className="gs-role-path-label">{t("role.briefPathLabel")}: </span>
            <span className="gs-role-path-value">{role.briefPath}</span>
          </p>
          <button
            type="button"
            className="gs-role-delegate"
            onClick={() => {
              onDelegate(role.role);
            }}
          >
            {t("role.delegateButton")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function RolesTab({ roles, onDelegate, t }: RolesTabProps): JSX.Element {
  const groups = toDepartmentGroups(roles);
  return (
    <div className="gs-roles">
      {groups.map((group) => (
        <section className="gs-role-group" key={group.department}>
          <h3 className="gs-role-group-title">{t(departmentTitleKey(group.department))}</h3>
          <ul className="gs-role-list">
            {group.roles.map((role) => (
              <RoleCard key={role.role} role={role} onDelegate={onDelegate} t={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
