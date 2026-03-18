---
name: thread-orchestration
description: >
  大任务的主动拆解与多 thread 并行编排。
  Use when: 任务涉及 2+ 个独立可交付子任务，需要不同猫参与、不同 thread 并行推进。
  Not for: 单一任务（直接做）、已有 thread 之间的被动协调（用 cross-thread-sync）、单 session 内 subagent 并行（用 parallel-execution）。
  Output: 子 thread 创建 + 选猫 + 各 thread 交付 + 主 thread 汇聚报告。
triggers:
  - "拆任务"
  - "分 thread"
  - "并行推进"
  - "开多个 thread"
  - "thread orchestration"
  - "任务分解"
---

# Thread Orchestration — 多 Thread 并行编排

**核心理念**：一个 thread 对应一个独立可交付的工作单元。主 thread 是指挥部，子 thread 是战场。

## 何时触发

```
任务可以拆成多个独立子任务？
  → 子任务之间有代码依赖？ → 串行（先完成依赖项）
  → 子任务独立？ → 本 skill：开 thread 并行推进
只有一个任务？ → 不需要本 skill，直接做
```

## 五步流程

### Step 1: 拆解 — 识别独立可交付单元

**判定标准**：两个子任务能否由不同猫在不同 worktree 里同时做？能 → 独立。

拆解时明确每个子任务的：
- **Scope**: 改哪些文件/模块
- **交付物**: 代码 + 测试 + 文档（具体到文件）
- **验收条件**: 怎么算完（测试绿 / lint 过 / review 通过）

### Step 2: 建 Thread — 每个子任务一个 thread

```
→ cat_cafe_create_thread(
    title: "简洁描述任务目标",
    preferredCats: ["执行猫", "review猫"]
  )
```

**命名规则**：`[优先级/批次] 动词 + 对象`
- 例："P1 功能完善：Web UI + Semantic Scholar + API 降级"
- 例："P2 工程质量：CI/CD + Linting"

### Step 3: 选猫 — 按任务性质匹配能力

| 任务性质 | 适合的猫 | 理由 |
|---------|---------|------|
| 代码实现 | 架构猫（自己）或快速编码猫 | 产出代码 |
| 代码 Review | 缅因猫系（审查专长） | 跨家族 review |
| UI/体验/文案 | 暹罗猫系（审美专长） | 设计视角 |
| 架构决策 | 布偶猫 Opus 4.5 / 缅因猫 GPT | 深度思考 |
| 确定性执行 | 狸花猫 | 零信任验证 |

**铁律**：同一子任务的实现和 review 不能是同一只猫（no self-review）。

在 thread 里发任务描述 + 分工提议：

```
→ cat_cafe_cross_post_message(
    threadId: "<thread_id>",
    content: "## 任务描述\n...\n## 分工提议\n...\n@codex 请确认"
  )
```

### Step 4: 并行执行 — Worktree 隔离

**每个 thread 的代码改动应使用独立 worktree**，避免文件冲突。

thread 内的执行遵循已有 skill：
- 写代码 → `tdd`
- 完成后自检 → `quality-gate`
- 请 review → `request-review` + `cross-cat-handoff`（五件套）
- 收到反馈 → `receive-review`

**加速手段**：thread 内可用 `parallel-execution` 的 subagent 模式加速实现，但 review 必须由其他猫完成。

### Step 5: 汇聚 — 报告回主 thread

**铁律：子 thread 达到里程碑时，必须立刻通知主 thread。**

主 thread 不追踪过程，只接收结果。汇报格式：

```markdown
## [子任务名] — 完成 / 阻塞 / 待确认

| 子项 | 状态 | 关键产出 |
|------|------|---------|
| ... | ✅/🚧/❌ | 一句话 |

验证：[测试结果 / lint 结果]
下一步需要：[team lead 确认 commit / 无需动作 / 解除阻塞]
```

**不要让 team lead 自己去子 thread 查进度。**

## 依赖管理

| 场景 | 处理 |
|------|------|
| 子任务完全独立 | 并行，各自 worktree |
| B 依赖 A 的产出 | A 先做，A merge 到 main 后 B 从 main 拉 |
| A 和 B 改同一文件 | 不要并行！串行处理，或重新拆分 scope |
| 多个 thread 都要改共享状态 | 走 `cross-thread-sync` 的 Claim 协议 |

## Quick Reference

```
拆解 → 建 thread → 选猫 → 并行执行 → 汇聚

主 thread = 指挥部（拆 + 收）
子 thread = 战场（做 + review）
Worktree = 隔离（不冲突）
汇报 = 及时（不让 team lead 追）
```

## Common Mistakes

| 错误 | 后果 | 修法 |
|------|------|------|
| 在主 thread 里直接改代码 | 子 thread 看不到过程，审计困难 | 代码改动必须在子 thread + worktree |
| 子 thread 完成不通知主 thread | team lead 要自己查 | 完成/阻塞时立刻 cross-post 回主 thread |
| 多 thread 在同一 worktree 改代码 | 文件冲突 | 每个 thread 用独立 worktree |
| 只拉同家族猫 | 缺少多元视角 | 按任务性质跨家族选猫 |
| 拆得太细（1 个小文件 = 1 个 thread） | 编排开销 > 收益 | 相关小任务合并到同一 thread |
| 忘记在子 thread 发任务描述 | 被拉的猫不知道干啥 | 建 thread 后立刻发 scope + 分工 |

## 和其他 Skill 的区别

| Skill | 层级 | 方向 | 核心区别 |
|-------|------|------|---------|
| **thread-orchestration** | 跨 thread | 主动拆解 → 分发 → 汇聚 | 全生命周期编排 |
| `parallel-execution` | session 内 | subagent 并行 | 不涉及 thread、不涉及其他猫 |
| `cross-thread-sync` | 跨 thread | 被动发现 → 通知 → 协调 | 响应式，不主动建 thread |
| `cross-cat-handoff` | 猫对猫 | 一次性交接 | 点对点，不涉及多 thread 编排 |

## 下一步

- 子 thread 内写代码 → `worktree` → `tdd`
- 子 thread 完成自检 → `quality-gate`
- 子 thread 请 review → `request-review`
- 子 thread merge → `merge-gate`
- 子 thread 之间有冲突 → `cross-thread-sync`
