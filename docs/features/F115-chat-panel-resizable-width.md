---
feature_ids: [F115]
topics: [ui, layout, resize, chat-panel, community]
doc_kind: spec
created: 2026-03-13
source: community
community_issue: https://github.com/zts212653/clowder-ai/issues/28
---

# F115: Chat Panel Resizable Width

> **Status**: backlog | **Source**: clowder-ai #28 (Ragdoll/opus) | **Priority**: P3

## Why

右侧聊天面板宽度固定，无法拖动调整。左侧 sidebar 和 workspace 面板已支持 `ResizeHandle` 拖拽，但 sidebar+chat 双栏布局下聊天面板宽度不可调，体验不一致。

## What

在聊天面板边缘加入 `ResizeHandle`，使用户可以在以下布局下拖动调整宽度：

- **sidebar + chat** 双栏布局：sidebar 右边缘 / chat 左边缘可拖拽
- **sidebar + chat + workspace** 三栏布局：已有 `handleHorizontalResize`，确保一致性

相关文件（已有参考实现）：
- `ChatContainer.tsx` — `handleHorizontalResize`
- `ResizeHandle` 组件
- `handleSidebarResize`

## Acceptance Criteria

- [ ] AC-1: sidebar+chat 双栏布局下，用户可拖动调整聊天面板宽度
- [ ] AC-2: 宽度调整范围合理（有最小/最大值约束）
- [ ] AC-3: 宽度偏好持久化（刷新后保留）
