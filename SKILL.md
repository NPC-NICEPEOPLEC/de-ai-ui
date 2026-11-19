---
name: de-ai-ui
description: Use when building, redesigning, or reviewing any interface that must not look AI-generated — landing pages, dashboards, admin panels, settings pages, component libraries, or design tokens — and whenever someone says the UI looks cheap, templated, "有 AI 味", "像 AI 做的", "不够高级", "一眼廉价", vibe-coded, or slop. Turns taste into checkable constraints and a deterministic audit.
---

# 去 AI 味：把「一眼廉价」变成可检查的约束

> vibe 出来的界面一眼廉价，往往输在细节上。—— [@bruc3van](https://x.com/bruc3van/status/2115963644811116732)

AI 生成的界面不像「AI 画的」，它像**没做完的**。原因不是审美差，而是三种可以测出来的失败：

| 失败 | 现场长什么样 | 怎么治 |
|---|---|---|
| **加法过度** | 分割线、标签、emoji、解释文案、阴影、彩色图标层层叠加 | 每个元素先问「能不能不要」 |
| **几何不精确** | 嵌套圆角不同心、该 0.5px 用了 1px、图标粗细不一、没有光学对齐 | 数值上网格，圆角走公式 |
| **没有系统** | 每个卡片一个颜色、字号随手定、硬编码内联样式 | 先定 token，再写界面 |

三条对症的规则都不是风格偏好，而是**能被 `scripts/slop-lint.mjs` 测出来**的。所以本 skill 的工作方式是：**先立约束，再生成，最后跑检查器**——而不是生成完再凭感觉挑毛病。

## 30 秒流程

```
定义 (为什么做/给谁)  →  契约 (5 行硬约束)  →  生成  →  slop-lint  →  按优先级单点修  →  复跑
```

1. **定义**：一句话写清「给谁用、解决什么问题、要给人什么感觉」。说不清就先问用户，这一步不要出设计。
2. **契约**：把下面 5 行填完，贴在生成请求最前面。没定的数值就等于交给 AI 随手编。
3. **生成**：先出完整一版，不要边想边补局部。
4. **审计**：`node <skill 目录>/scripts/slop-lint.mjs <目标目录> --json`。
5. **修**：按 P0 → P1 → P2 顺序，**每轮只改一类**，改完复跑。分数不再上升就停。

## 生成前：5 行契约

生成任何界面前，先把这五行写出来（写不出来就先别生成）：

```text
受众与唯一目标：{谁在用，这个页面只让他们做一件什么事}
界面色彩：chrome（按钮/卡片/输入框/边框）只用黑白灰；品牌色只出现在 {具体位置}
字号档位：{12, 14, 16, 20} ← 最多 4 档，最小 12px
圆角档位：{4, 8, 16} + pill；4px 网格；嵌套 r = R − p（共享圆心）
描边：0.5px hairline，全站同粗；字体栈：{先西后中，sans-serif 兜底}
```

这五行是后面所有检查的判据。**契约里没写的数值，AI 会自己编一个。**

## 生成中：三道闸门

**闸门 1 — 加法**
每加一个元素问一次：分割线能不能用间距代替？标签能不能用文案代替？图标能不能去掉？解释性描述是不是在替用户读界面？
（[@dingyi] [@ianneo_ai] 都把这列为 AI 界面的第一失败模式）

**闸门 2 — 几何**
同层同圆角；嵌套走 `r = R − p`；所有 padding / gap / radius 落 4px 网格；有 token 就改 token，不要硬编码；从外往里推：dialog → panel → input/button → chip。
（[@Kubai087]）

**闸门 3 — 系统**
颜色、字号、圆角、间距都必须是**枚举**，不是任意值。做不到「从集合里选」说明系统还没建。

## 生成后：审计与修复

```bash
# 脚本随 skill 一起安装，路径指向你放 skill 的位置（示例为 Claude Code 的个人目录）
node ~/.claude/skills/de-ai-ui/scripts/slop-lint.mjs src --json          # 机器可读
node ~/.claude/skills/de-ai-ui/scripts/slop-lint.mjs src --min-severity P1   # 只看要命的
```

检查器给 0–100 的 craft score（100 = 无违规）。修复顺序：

| 优先级 | 规则 | 含义 |
|---|---|---|
| **P1** | R001 R003 C001 C002 T001 T002 T003 T005 L001 L002 K001 S001 S002 | 每个都会单独让界面「一眼假」，不修完不许交付 |
| **P2** | R002 C003 T004 T006 T007 Y001 Y002 Y003 Y004 M001 M002 M003 A001 A002 D001 | 打磨项，按分数收益排 |

检查器同时预留了 P0 层（当前没有规则使用）；一旦触发即视为不可交付，退出码直接失败。

**一次只改一类**，改完复跑。不要一口气重写整页——重写会把上一轮修好的东西又弄坏。
（[@Xian0063]：先出全貌，再逐块改，每轮只改一处）

## 硬规则速查

> 出处见 [`references/sources.md`](references/sources.md)。`[判断]` 是我的引申，不是作者原话。

**圆角与描边**
- 内圆角 = 外圆角 − 间距，内外共用一个圆心。dialog 32 + padding 16 → 内部 16；16 的 panel 内 padding 8 的 chip → 8。[Kubai087]
- 同层同圆角，最小 4px；pill 和圆形保持全圆。[Kubai087]
- 边框与线条统一 0.5px；「该 0.5px 的地方用了 1px」是 slop 指纹。[ZaynHao] [dingyi]
- 连续圆角作为渐进增强：保留 `border-radius`，用 `@supports (corner-shape: superellipse(1.25))` 追加。[Kubai087]

**颜色**
- 界面 chrome 只用黑白灰，颜色留给照片、插画、数据。[ianneo_ai]
- 颜色走成套色阶（Radix Colors 的 12 级语义），不要现调。[ZaynHao]
- 不要：紫色/紫蓝渐变、渐变按钮、彩色图标、一卡一色、只染一个字。[dingyi] [ianneo_ai]

**字体与排版**
- 字号 ≤ 4 档（最好 3 档），最小 12px；层级不够用字重/颜色/间距解决。[ZaynHao] [dingyi]
- 避开被用烂的三款：Instrument Serif、Space Grotesk、Bricolage Grotesque。[dingyi]
- 中文栈**先西后中**，中文字体写英文名，带空格加引号，最后 sans-serif 兜底。[ricouii]
- 不要全大写小标题、标题上方的眉标、章节编号。[dingyi]

**文案**
- 不要用中点「·」当分隔符。[ZaynHao] [dingyi]
- 不要冗余解释性描述；正文不塞 emoji；不造词、不过度口语化。[ZaynHao] [dingyi]
- 不编造数据和社会证明（「10,000+ 满意客户」这种没有来路的数字直接删）。[判断]

**动效与交互**
- 动画越少越好；必须有时，ease-out、约 250ms 起步。[ZaynHao]
- 进场用 ease-out 而不是 ease-in；不要 `transition: all`。[判断]
- 减少需要用户停下来判断的交互；必须有时，放在用户本来就要做选择的地方。[ZaynHao]

**素材与组件**
- 整套界面图标来自同一风格体系，粗细、圆角、视觉重量一致。[yanliudreamer] [Kubai087]
- 优先复用项目已有组件库与 token；深色/Clear 等模式单独设计，不要滤镜转。[remixdesigner]

## 反模式：过度矫正

去 AI 味的失败方式有两种，第二种更常见：**把界面修成灰扑扑的性冷淡**。

- **0.5px 在 1x 屏会消失。** 给回退：`@media (min-resolution: 1.5dppx) { ... 0.5px }`，否则低分屏上等于没有边框。[判断]
- **全黑白灰不是万能。** 儿童、游戏、强品牌识别的产品需要颜色；此时把它们收敛进 token，而不是删掉。[判断]
- **删光动效会显得呆板。** 保留 1–2 个 150–250ms 的状态反馈（按下、展开），比全静更可信。[判断]
- **超椭圆不是必须。** 浏览器不支持时会退回普通圆角，这是设计好的降级，不是 bug。[Kubai087]
- **规则服务于质感，不服务于规则本身。** 一条规则明显在破坏当前场景（例如全屏沉浸式摄影页却强制白底灰字），先问为什么，再决定是否破例。[判断]

## 可直接粘贴的 Prompt

```text
按「去 AI 味」约束重做这个界面。只改我指定的页面/组件；项目已有 token 或组件库时改 token、复用组件，不要硬编码。

1. 界面 chrome 只用黑白灰，颜色留给内容。禁止紫色渐变、渐变按钮、彩色图标、卡片左边缘彩色竖线。
2. 字号最多 4 档、最小 12px；层级用字重/颜色/间距，不要加第五档。
3. 嵌套圆角满足 内圆角 = 外圆角 − 间距，内外同心；同层同圆角，最小 4px；padding/gap/radius 落 4px 网格；pill 与圆形保持全圆。
4. 线条与边框统一 0.5px。去掉多余分割线、多层阴影、半透明叠色、带边框容器与卡片套卡片。
5. 删掉中点「·」、冗余解释文案、正文 emoji。
6. 删掉标题上方的眉标、全大写小标题、章节编号、超大字 hero。
7. 中文 font-family 先西后中，最后 sans-serif 兜底。
8. 动效收敛：必须时 ease-out、约 250ms，不要 transition: all。
9. 图标整套同一体系，不要混用两个图标库。

完成后输出 element: old -> new 的变更清单，以及你用 slop-lint 复跑后的分数。
```

## 参考文件

| 文件 | 什么时候读 |
|---|---|
| [`references/radius-and-borders.md`](references/radius-and-borders.md) | 要算圆角、写超椭圆、处理 0.5px 回退 |
| [`references/color.md`](references/color.md) | 定色板、把颜色迁到 Radix、处理品牌色 |
| [`references/typography-cjk.md`](references/typography-cjk.md) | 中文字体栈、字号层级、字号 token |
| [`references/copy-and-content.md`](references/copy-and-content.md) | 改文案、删解释文字、写真实社会证明 |
| [`references/motion-and-interaction.md`](references/motion-and-interaction.md) | 动效参数、菜单/按钮/拖拽细节 |
| [`references/assets-and-icons.md`](references/assets-and-icons.md) | 图标体系、插画、深色模式素材 |
| [`references/slop-checklist.md`](references/slop-checklist.md) | 交付前逐条自查 |
| [`references/sources.md`](references/sources.md) | 想核对某条规则的原始出处 |
