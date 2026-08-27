/**
 * Panel copy: zh and en dictionaries registered with the host's locale
 * service (`ctx.locale.register(NS, { zh, en })`, spec U10) and consumed
 * through `ctx.locale.bind(NS)` — not a standalone dictionary lookup. The
 * panel is a React tree the whole way down (unlike the sidebar entry, which
 * stays raw DOM), so one service-backed `t` covers both the entry label and
 * every string inside <Panel/>.
 *
 * `zh` is the key-set source of truth; `en` is typed against it so a missing
 * or extra key in either dictionary is a compile error (the locale service's
 * own registration type enforces the same balance — see
 * `LocaleRuntime.register`'s doc comment, "bilingual balance enforced at
 * registration").
 */

/** Locale namespace this plugin owns (merged into LocaleNamespaceMap in index.ts). */
export const NS = "game-studio" as const;

/** zh dictionary. */
export const zh = {
  "panel.title": "游戏工作室",
  "entry.label": "游戏工作室",
  "tab.commands": "命令",
  "tab.roles": "角色",
  "commands.summary": "共 {count} 条命令，按流水线阶段分组",
  "phase.Concept": "概念",
  "phase.Design": "设计",
  "phase.Architecture": "架构",
  "phase.Sprint": "冲刺",
  "phase.QA": "质量保证",
  "phase.Polish": "打磨",
  "phase.Release": "发布",
  "roles.comingSoon.title": "角色页即将上线",
  "roles.comingSoon.body":
    "这里会按部门列出全部 {count} 位角色简报，点击即可一键委派任务。当前版本还没有实现，敬请期待。",
} satisfies Record<string, string>;

/** The dictionary key union — both locales are typed against this. */
export type GameStudioKey = keyof typeof zh;

/** en dictionary, typed against `zh`'s key set. */
export const en: Record<GameStudioKey, string> = {
  "panel.title": "Game Studio",
  "entry.label": "Game Studio",
  "tab.commands": "Commands",
  "tab.roles": "Roles",
  "commands.summary": "All {count} commands, grouped by pipeline phase",
  "phase.Concept": "Concept",
  "phase.Design": "Design",
  "phase.Architecture": "Architecture",
  "phase.Sprint": "Sprint",
  "phase.QA": "QA",
  "phase.Polish": "Polish",
  "phase.Release": "Release",
  "roles.comingSoon.title": "Roles are on the way",
  "roles.comingSoon.body":
    "This tab will list all {count} role briefs by department, with one click to delegate a task to any of them. Not built yet.",
};
