# dsh-game-studio

[English](README.md) | 中文

面向 DeepSeek Harness 的游戏工作室：一个 Cordis bundle 插件，把 MIT 协议的
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
移植到 DSH 的技能注册体系与子代理委派接缝上。上游是一个 49 角色的虚拟工作室，
配一条 7 阶段生产流水线和一整套工作室命令，构建在 Claude Code 的
agent/skill/hook/rule 扩展点之上。本包把那个项目的形态重新表达到了另一个扩展面
不同的 harness 上——具体映射见 `NOTICE`。

## 能力缺口

**这做不到什么。** DeepSeek Harness 没有 pre-tool-use 拦截机制，所以上游项目
的 12 个校验 hook 无法被移植成阻断式门禁。它们变成了检查清单、审批提示和提醒。
这里的任何机制都不会阻止一次糟糕的提交——它只会告诉你这件事。

## 当前状态：Phase 1 骨架

这是一个 Phase 1 骨架，不是完整移植。今天实际装上的东西只有：

- `gs-ping` —— 一个命令技能（安装探针；能在 `/` 菜单里找到，但模型看不见）
- `gs-studio` 与 `gs-roster` —— 编排技能（模型可见，运行时注册，本次安装的
  绝对内容路径已替换进去）
- `creative-director` —— 一份角色简报，用作委派链探针

完整移植——49 份角色简报、73 条工作室命令、41 个文档模板、11 份编码规范规则
文件、按引擎划分的参考手册，以及 guard / 模型分层这两层——都在后续阶段才会
落地。今天如果去找 `/gs-start` 或者 `game-designer` 角色简报，是找不到的。

## 安装

两条路线，取决于你想把它装进日常在用的 profile，还是单独隔离出一个。

### 路线一：装进已有 profile（推荐）

```bash
dsh plugin --profile web add dsh-game-studio
dsh web
```

`dsh plugin` 会读取本包的 `dsh.bundle` 声明，自己把它归并进该 profile 的
`dsh.profile.bundles` 列表——不需要手动编辑 `package.json`。

### 路线二：单独的隔离 profile

```bash
dsh plugin --profile game-studio add dsh-game-studio
```

这条命令会新建一个 profile。一个刚创建的 profile 的 `dsh.profile.bundles`
里只预置了 `["@deepseek-ai/dsh-base"]`——里面没有 web app。打开该 profile
的 `package.json`，把 `"@deepseek-ai/dsh-web-app"` 加进
`dsh.profile.bundles`，位置排在 `@deepseek-ai/dsh-base` 之后、
`dsh-game-studio`（`add` 命令已经插进去的那一条）之前。然后：

```bash
dsh --profile game-studio
```

## 首次使用

在装了本插件的 profile 上开一个会话，在输入框敲 `/gs`——命令菜单里应该出现
`gs-ping`。发送它：它应该报告命令技能已经进了菜单，引用它自带的
`references/probe.md` 里的那一行标记，并打印出它加载自的绝对目录。

另外，在同一个会话或新开一个会话里，直接问模型它有哪些可用技能。回答里应该
提到 `gs-studio` 和 `gs-roster`，而**不应该**提到 `gs-ping`：命令技能带有
`disable-model-invocation: true`，永远不会进入模型自己的技能目录，只会出现
在 `/` 菜单里。接下来可以加载 `gs-studio`，了解已装了什么、都在哪。

## 配置

在该 profile 自己的补丁文件（`~/.dsh/profiles/<profile>/cordis.patch.yml`）
里覆盖以下任意项，目标是本包自身 `cordis.patch.yml` 插入的 `game-studio`
这个 id：

```yaml
- id: game-studio
  config:
    engine: godot
    reviewIntensity: lean
```

| 字段 | 类型 | 默认值 | 今天实际的作用 |
|---|---|---|---|
| `engine` | `"auto" \| "godot" \| "unity" \| "ue5"` | `"auto"` | 被替换进 `gs-studio` 定向技能里，作为当前引擎显示。它未来会用来挑选的各引擎参考手册还没上线（Phase 2）。 |
| `reviewIntensity` | `"full" \| "lean" \| "solo"` | `"full"` | 被替换进 `gs-studio` 定向技能里，作为当前审校强度显示。会消费这个值的流水线阶段还没上线（Phase 3）。 |
| `watch` | `boolean` | `false` | 不重启 harness、重新扫描 `content/skills/` 的变化。发行的内容是不可变的——除非你在开发本插件本身，否则保持 `false`。 |

这是本阶段实现的全部配置项。设计文档里别处提到的其它字段
（`exposeCommandSkillsToModel`、`modelTiers`、`guards`）属于本移植的后续
阶段，在这一版里并不存在。

## 共享 profile 的代价

把本插件装进你日常写代码用的 profile 不是没有代价的。两条编排技能
（`gs-studio`、`gs-roster`）以运行时技能的形式注册，会进入该 profile
**每一个会话**的模型技能目录——包括那些跟游戏开发毫无关系的普通编码会话。
不管你用不用它们，它们都会加进每个会话的技能清单里。

命令技能（今天的 `gs-ping`，Phase 2 落地后还会再加 73 条）不带这个代价——
`disable-model-invocation: true` 让它们完全不进入模型自己的目录。但它们仍
会出现在 `/` 菜单里；在那里敲 `/gs` 可以把它们从其余列表里过滤出来。

如果你不想在日常主力 profile 上付这个代价，用上面的路线二。

## 署名

本包是
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
的衍生作品，版权所有 (c) 2026 Donchitos，采用 MIT 许可证。上游许可证全文
原样收录在 `LICENSE.upstream` 里；`NOTICE` 总结了移植过程中发生了哪些变化。
本包自身的代码采用 `LICENSE` 里的条款，同为 MIT 许可。
