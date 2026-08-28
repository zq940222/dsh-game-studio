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

## 当前状态：Phase 3 —— 编排与工作区脚手架

这是完整移植，不再是骨架。今天实际装上的东西是：

- `gs-studio`、`gs-roster`、`gs-guards`、`gs-templates`、`gs-pipeline`，
  以及七个 `gs-phase-*` 阶段技能 —— 12 个编排技能（模型可见，运行时注册，
  本次安装的绝对内容路径已替换进去）
- 74 条命令技能，都能在 `/` 菜单里找到、但模型看不见：73 条工作室命令，
  外加本阶段自己的安装探针 `gs-ping`
- 49 份角色简报，每个角色一个文件，外加移植脚本生成的 `roles/_index.md`
  名册
- 40 个文档模板、11 份按路径生效的编码规范规则文件、46 份按引擎划分的
  参考文档（Godot / Unity / Unreal），以及 13 份手册文档（名册、门禁、
  协作规则、guards）
- `pipeline/` 目录下的 7 阶段流水线指南与目录
- `content/project/`：`/gs-start` 用来搭建新项目工作区的 `AGENTS.md`
  模板和目录脚手架——详见下文"工作区脚手架"一节

今天去找 `/gs-start` 或者 `game-designer` 角色简报，都能找到——`/gs-start`
现在不只是给你指路了，详见下文"工作区脚手架"一节。还没落地的是流水线
阶段的主动执行，以及 guard / 模型分层这两层——具体本阶段实现了哪些配置
项，见下面的"配置"一节。

## 安装

本包没有发布到 npm registry。从 GitHub release 附带的 tarball 安装：

```bash
dsh plugin --profile web add https://github.com/zq940222/dsh-game-studio/releases/download/v0.2.1/dsh-game-studio-0.2.1.tgz
dsh web
```

该 tarball 自带构建好的 `lib/`，所以安装时不需要构建步骤、不需要
`allowBuilds` 条目，也不需要能连上 GitHub 的 SSH。改用 git URL
（`git+https://github.com/…`）也能装，但明显更差：pnpm 解析 git 依赖时
会走 `git ls-remote` 并规范化成 **SSH**——即使你给的是 HTTPS 地址也一样，
所以在任何封了 22 端口的网络下、或任何没配 GitHub SSH key 的机器上都会
直接失败；而且它还额外要求一个钉在确切 commit SHA 上的 `allowBuilds`
条目，每推一次新提交就得改一次。优先用 release tarball。

以后升级，把同一条命令指向更新的 release tag 即可。

下面是两条路线，取决于你想把它装进日常在用的 profile，还是单独隔离出一个。

### 路线一：装进已有 profile（推荐）

上面那条命令就是。它针对的是 `web` profile，换成你自己在用的 profile 名即可。

`dsh plugin` 会读取本包的 `dsh.bundle` 声明，自己把它归并进该 profile 的
`dsh.profile.bundles` 列表——不需要手动编辑 `package.json`。

### 路线二：单独的隔离 profile

```bash
dsh plugin --profile game-studio add https://github.com/zq940222/dsh-game-studio/releases/download/v0.2.1/dsh-game-studio-0.2.1.tgz
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

## 工作室面板

装好本插件后，在跑 `dsh web` 的 profile 的侧边栏里会多出一个"游戏工作室"
入口。点开它，会弹出一个悬浮面板，里面是两个标签页：

- **命令** —— 全部 74 条命令技能，按 7 个流水线阶段分组（概念、设计、
  架构、冲刺、质量保证、打磨、发布）。点一行就会立刻在当前会话里执行
  那条命令，跟自己手敲 `/名字` 效果一样——没有二次确认这一步。
- **角色** —— 全部 49 份角色简报，按 8 个部门分组。点开一张卡片会展开
  它的五个 frontmatter 字段（角色、描述、部门、阶层、建议模型层级），
  以及简报自己的内容相对路径。卡片上的"委派任务"按钮只会往输入框里
  **预填**一条针对这个角色的委派话术——插在你已经打的字前面，绝不会
  替你发送，还是得你自己看一眼再按发送。

侧边栏入口是直接塞进宿主壳层已渲染的侧边栏 DOM 里的一段普通节点——
目前还没有插件专用的挂载槽位——所以壳层大多数自身重渲染它都扛得住、
能自愈，但它盯着的是当前这版 DOM 的样子，不是一份稳定契约。如果宿主
改版把侧边栏结构改得足够多，它就可能找不到地方挂了，入口会悄悄消
失，得等本包出新版本跟上新结构才会恢复。

## 工作区脚手架：`/gs-start` 与 `AGENTS.md`

`/gs-start` 是一个命令技能——只能在 `/` 菜单里找到，模型看不见它，即使
模型主动点名要加载，执行层也会拒绝。除了继承自上游的引导式提问（你现在
在哪一步、接下来想做什么）之外，在这个 harness 上它还会顺手把工作区
本身搭起来：

- **先问后写。** 它会先给出完整计划——要创建哪些目录、`{{PROJECT_NAME}}`
  / `{{ENGINE}}` / `{{CONTENT_DIR}}` 分别会填成什么——等你批准之后才会
  真正落盘。
- **搭建目录树。** 批准之后，它会按 `content/project/directory-scaffold.md`
  里列出的顶层目录（`src/`、`assets/`、`design/`、`docs/`、`tests/`、
  `tools/`、`prototypes/`、`production/`，以及文档里写明的各自子目录）
  逐一创建那些还不存在的目录，绝不删除或覆盖已有目录。
- **写一份填好的 `AGENTS.md`。** 它会填充
  `content/project/AGENTS.md.template`——项目名、引擎，以及这次安装自身
  的绝对内容路径（从技能自己的 resource base 反推出来，不是猜的）——
  然后把结果写到工作区根目录的 `AGENTS.md` 里。如果那个文件已经存在，
  它会先展示 diff，问过你之后才会动它。

这份 `AGENTS.md` 不只是留给你自己看的文件：此后在这个工作区里新开的
每一个会话，harness 都会把它注入进去，排在技能目录之前，这样项目的引擎、
内容路径，以及按路径生效的规则对照表（哪种改动该读哪份规则）不需要每个
会话重新交代一遍就能让模型看到。这一条已经在真机上验证过——在一个已搭好
脚手架的工作区里新开一个禁用工具和文件读取的会话，模型仅凭注入内容就
正确回答出了项目的引擎和内容路径，实测每个会话大约多花 0.8K token。

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
| `engine` | `"auto" \| "godot" \| "unity" \| "ue5"` | `"auto"` | 被替换进 `gs-studio` 定向技能里，作为当前引擎显示。各引擎参考手册（`content/engines/`）已经上线；用这个值在它们之间自动挑选的机制还没接上。 |
| `reviewIntensity` | `"full" \| "lean" \| "solo"` | `"full"` | 被替换进 `gs-studio` 以及全部七个 `gs-phase-*` 阶段技能里。每个阶段技能会据此决定自己那道门禁的强制程度——`full` 跑全部检查项，`lean` 只跑标记为必需的检查项，`solo` 只跑交付物检查（详见 `gs-pipeline`）。 |
| `watch` | `boolean` | `false` | 不重启 harness、重新扫描 `content/skills/` 的变化。发行的内容是不可变的——除非你在开发本插件本身，否则保持 `false`。 |
| `exposeCommandSkillsToModel` | `boolean` | `false` | 可选逃生舱。为 `true` 时，全部 74 条命令技能会**额外**以运行时技能的形式注册为模型可调用——覆盖它们自己 frontmatter 里的 `disable-model-invocation: true`，是叠加在 12 条编排技能之上，而不是取代它们。这与本包默认的、经过实测的设计主张（见下文"共享 profile 的代价"）正好相反；除非你确实想让模型能直接调用工作室命令，否则请保持 `false`。 |

这是本阶段实现的全部配置项。设计文档里别处提到的其它字段
（`modelTiers`、`guards`）属于本移植的后续阶段，在这一版里并不存在。

## 共享 profile 的代价

把本插件装进你日常写代码用的 profile 不是没有代价的。全部 12 个编排技能
——`gs-studio`、`gs-roster`、`gs-guards`、`gs-templates`、`gs-pipeline`，
以及七个 `gs-phase-*` 阶段技能——都以运行时技能的形式注册，会进入该 profile
**每一个会话**的模型技能目录，包括那些跟游戏开发毫无关系的普通编码会话。
不管你用不用它们，它们都会加进每个会话的技能清单里。

命令技能（一共 74 条——73 条工作室命令加上 `gs-ping`）不带这个代价——
`disable-model-invocation: true` 让它们完全不进入模型自己的目录。但它们仍
会出现在 `/` 菜单里；在那里敲 `/gs` 可以把它们从其余列表里过滤出来。

如果你不想在日常主力 profile 上付这个代价，用上面的路线二。

## 署名

本包是
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
的衍生作品，版权所有 (c) 2026 Donchitos，采用 MIT 许可证。上游许可证全文
原样收录在 `LICENSE.upstream` 里；`NOTICE` 总结了移植过程中发生了哪些变化。
本包自身的代码采用 `LICENSE` 里的条款，同为 MIT 许可。
