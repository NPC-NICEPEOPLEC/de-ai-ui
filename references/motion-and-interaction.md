# 动效与交互细节

## 1. 少即是多

> 尽量减少页面中的元素动画过渡效果，如果一定要添加，则考虑通常 ease-out，250ms 是个不错的基础设定。—— [@ZaynHao](https://x.com/ZaynHao/status/2113456751915982917)

AI 生成页面最典型的动效错误是**什么都动**：滚动视差、逐字浮现、卡片悬停上浮 + 阴影 + 边框变色同时发生。结果是页面一直在抖，用户找不到焦点。

**动效只做三件事**：
1. 说明状态变化（按下、加载、成功）
2. 说明空间关系（从哪儿来、到哪儿去）
3. 引导注意力（一次性，不循环）

不服务这三件事的动效，删掉。

## 2. 参数

| 场景 | 时长 | 曲线 |
|---|---|---|
| 按下反馈 | 80–120ms | ease-out |
| 状态切换（hover、开关） | 150–200ms | ease-out |
| 展开 / 收起（菜单、抽屉） | 200–250ms | ease-out |
| 页面级转场 | 250–320ms | ease-out |

- **只用 ease-out。** ease-in 会延迟第一帧，读起来像卡顿；`ease-in-out` 在短时长里没有意义。
- **不要 `transition: all`**（`M003`）——它会连布局属性一起动画，造成抖动。明确写要动哪些属性。
- **只动 `transform` 和 `opacity`。** 动 `width` / `height` / `top` / `left` 会触发布局重排。

```css
.button {
  transition: background-color 150ms ease-out, transform 100ms ease-out;
}
.button:active { transform: scale(0.97); }

.menu {
  transform-origin: top center;
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}
.menu[hidden] { opacity: 0; transform: scale(0.96); }
```

## 3. 几个具体细节

**下拉菜单必须从触发它的按钮长出来。** 不是从屏幕中央淡入。`transform-origin` 要对准触发按钮。

**进场从 0.96 缩放开始，不要从 0。** 从 0 开始会像"弹出来"，从 0.96 开始像"展开"。

**按钮按下缩到 0.97。** 这是 iOS 的手感来源，比变色更可信。

**toast 要叠成一摞，不挤内容。** 多条同时出现时向上堆叠，不要推挤下面的布局。

**长名字截断，大数字缩写。** `1,284` → `1.3k`；超长标题用 `text-overflow: ellipsis`，不要让布局被撑破。

**减少需要判断的交互。** 必须有时，放在用户本来就要做选择的地方，并重新排信息优先级。[@ZaynHao]

**下拉按钮的箭头图标要专门修。** [@dingyi](https://x.com/dingyi/status/2115790005423734818) 把这一条列为"最恶心最严重"：箭头没有垂直居中、和文字基线不对齐、hover 时不跟按钮一起变色、展开时不旋转。这四处几乎是默认的。

## 4. 无障碍与偏好

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

同时保证：
- 所有交互元素可键盘到达，焦点环可见（不要 `outline: none` 了事）。
- 触控目标 ≥ 44×44px。
- 图标按钮必须有 `aria-label`。

## 5. 与检查器的对应

| 规则 | 含义 |
|---|---|
| `M001` | transition / animation 超过 400ms |
| `M002` | 用了 ease-in |
| `M003` | `transition: all` |
| `A001` | 大部分内容居中（破坏阅读节奏） |
