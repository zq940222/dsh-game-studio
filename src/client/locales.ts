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
  "roles.summary": "共 {count} 位角色简报，按部门分组",
  "department.art": "美术",
  "department.audio": "音效",
  "department.design": "设计",
  "department.engineering": "工程",
  "department.leadership": "领导层",
  "department.narrative": "叙事",
  "department.production": "制作",
  "department.qa": "质量保证",
  "role.field.role": "角色",
  "role.field.description": "描述",
  "role.field.department": "部门",
  "role.field.tier": "阶层",
  "role.field.modelTier": "建议模型层级",
  "role.modelTierNote": "本 harness 无法按次为子 agent 指定模型，这一字段只是建议，不是强制机制。",
  "role.briefPathLabel": "简报路径",
  "role.delegateButton": "委派任务",
  "role.delegatePrefix": "按 gs-roster 协议委派给 {role}：",
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
  "roles.summary": "All {count} role briefs, grouped by department",
  "department.art": "Art",
  "department.audio": "Audio",
  "department.design": "Design",
  "department.engineering": "Engineering",
  "department.leadership": "Leadership",
  "department.narrative": "Narrative",
  "department.production": "Production",
  "department.qa": "QA",
  "role.field.role": "Role",
  "role.field.description": "Description",
  "role.field.department": "Department",
  "role.field.tier": "Tier",
  "role.field.modelTier": "Suggested model tier",
  "role.modelTierNote": "This harness cannot pick a model per sub-agent invocation — this field is a suggestion, not an enforced mechanism.",
  "role.briefPathLabel": "Brief path",
  "role.delegateButton": "Delegate task",
  "role.delegatePrefix": "Delegate to {role} per the gs-roster protocol: ",
};
