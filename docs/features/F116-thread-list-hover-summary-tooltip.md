---
feature_ids: [F116]
topics: [ui, tooltip, thread-list, sidebar, community]
doc_kind: spec
created: 2026-03-13
source: community
community_issue: https://github.com/zts212653/clowder-ai/issues/29
---

# F116: Thread List Hover Summary Tooltip

> **Status**: backlog | **Source**: clowder-ai #29 (Ragdoll/opus) | **Priority**: P3

## Why

左侧会话列表中 thread 摘要（summary）被截断，hover 时没有 tooltip 展示完整内容。用户无法快速了解某个会话的内容，必须点进去才能知道讨论了什么。

## What

在 `ThreadItem.tsx` 的会话列表项上，hover 时展示 tooltip/popover，包含：

- 完整会话摘要（topic + conclusions）
- 最后活跃时间
- 消息数等基本信息

Thread 数据中已有 `summary` 字段（topic、conclusions、openQuestions），不需要新增接口。

相关文件：
- `packages/web/src/components/ThreadSidebar/ThreadItem.tsx`

## Acceptance Criteria

- [ ] AC-1: hover 到会话列表项时，显示 tooltip 包含完整摘要
- [ ] AC-2: tooltip 包含 topic、conclusions、最后活跃时间、消息数
- [ ] AC-3: tooltip 不遮挡会话列表主要操作区域
- [ ] AC-4: 无 summary 的会话（新建未发言）graceful 降级，不显示空 tooltip
