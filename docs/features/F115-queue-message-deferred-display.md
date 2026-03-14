---
feature_ids: [F115]
related_features: [F039, F047]
topics: [message, queue, UX]
doc_kind: spec
created: 2026-03-13
---

# F115: 排队消息延迟显示 — 队列中的消息不应进入聊天流

> **Status**: spec | **Owner**: opus | **Priority**: P1

## Why

当猫猫正在回复时，用户新发的消息会被排入队列（deliveryMode: 'queue'）。当前实现中，排队消息会**同时**出现在聊天消息流和队列面板中，造成视觉混乱——用户看到同一条消息出现了两次（截图证据：`1773392665674-dd01e0a4.png`）。

正确的行为：排队中的消息应**只在队列面板中可见**，直到消息被实际处理（dequeued）时才进入聊天消息流。

**Team experience**: 2026-03-13 owner 反馈"队列中的消息实际发出去后才会进入的"。

## What

### Phase A: 渲染层按队列状态过滤

**根因**：用户消息通过乐观插入（`useSendMessage.ts` `addMessage()`）进入 store，同时也出现在队列面板中，造成重复显示。

**实际修复方案**：

1. **前端 `ChatContainer.tsx`**：在 `renderItems` 中，构建 `queuedMessageIds` 集合（仅包含 `status === 'queued'` 的 queue entry 的 `messageId` 和 `mergedMessageIds`），渲染时跳过这些消息
2. **状态转换**：当 queue entry 从 `queued` 变为 `processing` 时，其 messageId 不再被过滤，消息自动出现在聊天流中
3. **无需改后端**：消息仍然被乐观插入到 store 中（确保 `markMessagesDelivered` 等逻辑正常工作），只在渲染层过滤
4. **队列面板**：只显示 `status === 'queued'` 的 entry（已有逻辑），与聊天流过滤天然互补

## Acceptance Criteria

### Phase A（渲染层按队列状态过滤）
- [x] AC-A1: 当 `deliveryMode === 'queue'` 时，用户消息不出现在聊天消息流中（被 `queuedMessageIds` 过滤）
- [x] AC-A2: 排队消息在队列面板中正常显示（含内容预览）
- [x] AC-A3: 当排队消息被 dequeue（status 变为 processing）时，用户消息出现在聊天消息流中
- [x] AC-A4: 非排队消息（正常发送、force 发送）行为不变
- [x] AC-A5: 队列面板的撤回、重排序、steer 功能不受影响

## Dependencies

- **Evolved from**: F039（消息排队投递基础设施）
- **Related**: F047（Queue Steer — 队列管理交互）

## Risk

| 风险 | 缓解 |
|------|------|
| 撤回队列消息后消息流中残留消息 | 渲染层过滤天然解决：queue entry 删除后消息恢复可见 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-13 | 立项（owner 反馈 UX 问题） |
