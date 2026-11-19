# 样本

这 6 个文件是**未经手工修饰的 agent 输出**，原样提交，用来让任何人都能复算 [`RESULTS.md`](../RESULTS.md) 里的分数。

- `red-1/2/3.html`：只给任务的基线组（无 skill）。
- `green-1/2/3.html`：同一任务，前置要求读 `SKILL.md`、按它的流程做、并用 `slop-lint` 审计到 P1 为零。

采集条件：

| 项 | 值 |
|---|---|
| 时间 | 2026-11-19 |
| 运行环境 | DeepSeek Harness，默认模型（未做 provider / model 覆盖） |
| 任务提示 | 见 `../RESULTS.md` 的「方法」一节 |
| 采集方式 | agent 直接把成品写入文件，未做二次编辑 |

重新打分：

```bash
bash bench/score.sh
```

这些文件是**反面教材**，不要拿它们当实现参考——尤其 `red-*`。
