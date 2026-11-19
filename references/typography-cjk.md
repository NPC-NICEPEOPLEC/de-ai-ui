# 中文排版与字体

## 1. 中文字体栈：先西后中

[@ricouii](https://x.com/ricouii/status/2113462025556996412) 的写法可以直接用：

```css
:root {
  --font-sans:
    /* 西文 */
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Helvetica, Arial,
    /* 中文 */
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
    "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans CN",
    /* 兜底 */
    sans-serif;

  --font-mono:
    "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    "Liberation Mono", "Courier New", monospace;
}

body { font-family: var(--font-sans); }
code, pre, kbd { font-family: var(--font-mono); }
```

**三条必须遵守的原因**

1. **西文在前。** 中文字体自带的英文字母偏粗笨，如果中文字体排在前面，它会把英文和数字一起"接管"，西文排版立刻降级。这是 AI 写中文页面最高发的错误（`T005`）。
2. **中文字体写英文名。** `"Microsoft YaHei"` 而不是「微软雅黑」——部分 Linux / macOS 浏览器对中文名识别失败。
3. **带空格的字体名必须加引号。** `"Helvetica Neue"`、`"PingFang SC"`。

**不要忘记兜底。** 栈尾必须有 `sans-serif` / `serif` / `monospace`（`T006`）。不声明时浏览器渲染的是默认字体，不是系统字体，跨平台会崩。

## 2. 字号：最多 4 档，最小 12px

> 界面的文字大小不要超过 4 种，最好三种。最小可用文字尺寸是 12px。如果不够用，可以考虑使用字重、字体颜色、间距设计来调整页面的关系结构。—— [@ZaynHao](https://x.com/ZaynHao/status/2113456751915982917)

推荐的 5 档以内尺度（按需裁到 3–4 档）：

```css
:root {
  --text-caption: 12px;  /* 最小，只给辅助信息 */
  --text-body: 14px;     /* 正文主力 */
  --text-title: 20px;    /* 区块标题 */
  --text-display: 28px;  /* 页面主标题，不要更大 */
}
```

- **层级不够时用字重、颜色、间距，不要加第五档。** `14px/400`、`14px/600`、`14px/400 + muted` 已经是三个层级。
- **hero 标题不要大得离谱。** 96px 的 hero 是落地页模板习惯（`T007`）。移动端更明显：一行放不下 8 个字。
- **行高比字号更重要。** 正文 1.6–1.75，标题 1.2–1.3，中文字距不要乱加。

## 3. 避开被用烂的字体

[@dingyi](https://x.com/dingyi/status/2115790005423734818) 点名的三款（`T003`）：

- **Instrument Serif**（"莫奈风格"）
- **Space Grotesk**
- **Bricolage Grotesque**

它们的共同问题是：在 2025–2026 的 AI 生成页面里出现频率太高，读者已经把它们和"模板"绑定了。想特别出众，一般要么买付费字体，要么用系统字体 + 优秀排版。

其他相关：
- **不要滥用等宽字体。** 等宽是给代码和数字对齐用的，不是风格道具。
- **不要滥用斜体。** 中文没有真正的斜体，浏览器强行倾斜会变形。

## 4. 中文排版的细节

- **标点**：中文用全角标点（，。：；），中英混排时英文与数字两侧留 1/4 em 空格（`text-spacing-trim` 或手动 `&nbsp;` 都不是好方案，优先用 `word-break: normal` + 足够行宽）。
- **断行**：`line-break: strict; overflow-wrap: anywhere;` 处理长链接和长英文单词。
- **数字与单位**：价格、日期用 tabular numbers，`font-variant-numeric: tabular-nums;` 表格才不会跳。
- **不要用 `<br>` 强行断行**做视觉调整，窄屏会断得很难看。

## 5. 不要做的

- ❌ 全大写小标题（`T004`）——中文界面里的全大写英文小标题是模板记号。
- ❌ 标题上方的"眉标"（eyebrow / overline）、章节编号 `01 —`（`Y003` `Y004`）。
- ❌ 用字号而不是用层级来表达重要性（"重要的就放大"）。
- ❌ 正文塞 emoji。

## 与检查器的对应

| 规则 | 含义 |
|---|---|
| `T001` | 字号超过 4 种 |
| `T002` | 字号小于 12px |
| `T003` | 用了三款 slop 字体之一 |
| `T004` | 全大写小标题 |
| `T005` | 中文字体排在西文字体前面 |
| `T006` | 字体栈没有通用兜底 |
| `T007` | hero 字号超过 64px |
