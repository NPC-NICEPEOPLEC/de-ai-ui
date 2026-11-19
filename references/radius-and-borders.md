# 圆角与描边

## 1. 嵌套圆角：内圆角 = 外圆角 − 间距

同一圆心的两条弧，半径差正好等于它们之间的间距。所以嵌套容器的内圆角不是"看着差不多"，而是算出来的：

```
r(inner) = R(outer) − p(padding between them)
```

从外往里推，每一层都减掉自己的 padding：

| 层级 | 外圆角 R | 间距 p | 内圆角 r |
|---|---|---|---|
| dialog → panel | 32 | 16 | 16 |
| panel → input / button | 16 | 8 | 8 |
| panel → chip / tag | 16 | 8（chip 内缩 8） | 8 |
| card → 内部 row | 24 | 16 | 8 |

**检查方法**：把外圆角的外弧和内圆角的内弧画出来，两条弧应该能拼成一个同心圆环。拼不上就是错的——这是肉眼最敏感的一类错误，也是 AI 最常犯的一类（它会给每个盒子独立随手定一个圆角）。

**约束**
- 同层级的盒子用同一个圆角。
- 最低 4px。低于 4px 的圆角读起来像渲染事故，不像设计决定。
- pill（药丸）和圆形永远保持全圆，不参与递减。

```css
:root {
  --radius-outer: 24px;
  --radius-inner: 16px; /* 24 − 8 */
  --radius-control: 8px; /* 16 − 8 */
}
.card   { border-radius: var(--radius-outer); padding: 8px; }
.panel  { border-radius: var(--radius-inner); padding: 8px; }
.button { border-radius: var(--radius-control); }
.pill   { border-radius: 999px; }
```

## 2. 连续圆角 / 超椭圆

普通圆角接到直边的地方有一道可见的"折痕"；iOS 用的是连续曲率，过渡更顺。现在有 CSS 原生支持，但必须先查兼容：

```css
/* 先给所有浏览器一个正常圆角 */
:where(.card, .panel) {
  border-radius: 24px;
}

/* 支持的浏览器再升级成超椭圆 */
@supports (corner-shape: superellipse(1.25)) {
  :where(.card, .panel) {
    corner-shape: superellipse(1.25);
  }
  /* pill 与圆形必须显式退回 round，否则会被超椭圆切坏 */
  :where(.pill, .avatar) {
    corner-shape: round;
  }
}
```

- Chrome / Edge 139+ 渲染；Safari / Firefox 跳过 `@supports` 块，显示普通圆角。这是**设计好的降级**，不是兼容 bug。
- 指数 1.25 是常用值；再大就更接近"方中带圆"。

## 3. 0.5px 描边

细线是"精致"和"廉价"的直接分野：AI 默认给 1px，而 1px 在 2x 屏上视觉重量是 0.5px 的两倍，界面立刻变"粗"。

```css
:root {
  --hairline: 0.5px;
  --hairline-color: rgba(0, 0, 0, 0.12);
}
.divider { border-top: var(--hairline) solid var(--hairline-color); }
```

**低分屏回退**：1x 屏（老设备、部分外接显示器）上 0.5px 会被渲染成 0 或 1px 的抽风效果，需要显式回退：

```css
@media (max-resolution: 1.49dppx) {
  :root { --hairline: 1px; }
}
```

**另外两条**
- 粗细统一：一处 0.5px、一处 1px，比全部 1px 更廉价。
- 分割线不该存在的场合：分组用间距、留白、字重，而不是线。AI 喜欢给每一行之间加一条线。

## 4. 什么时候不要用圆角和阴影

- **不要因为"好看"就加圆角**。全站只有一套圆角语言，多出来的圆角都是噪音。
- **不要给卡片加左边缘的彩色竖线**——这是后台模板和 AI 生成最典型的记号，几乎从不携带信息。
- **不要同时用阴影和描边表达同一个层级**，也不要卡片套卡片。

## 5. 与检查器的对应

| 规则 | 含义 |
|---|---|
| `R001` | 圆角不在 4px 网格上 |
| `R002` | 全文件圆角值超过 4 种 |
| `R003` | 圆角 0 < r < 4px |
| `L001` | 该用 0.5px 的地方写了 1px |
| `L002` | 卡片左侧带彩色竖线 |
| `D001` | 卡片套卡片 |
