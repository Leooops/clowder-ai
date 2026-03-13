---
feature_ids: [F114]
related_features: [F059, F110]
topics: [bootcamp, ux, onboarding, community]
doc_kind: spec
created: 2026-03-13
source: community
community_issue: https://github.com/zts212653/clowder-ai/issues/16
---

# F114: Bootcamp Phase Transition UX

> **Status**: backlog | **Source**: clowder-ai #16 (mindfn) | **Priority**: P2

## Why

内测用户 mindfn 在走 Bootcamp 引导流程时遇到三个体验断点：

1. Phase 3 全部检查通过时静默跳过，没有明确告知用户"Phase 3 完成，进入下一阶段"
2. Phase 3.5（进阶功能：TTS、工具调用等）没有主动询问用户是否要配置，直接跳过
3. 各 Phase 之间缺乏明确的标题/分隔提示，用户不知道当前到了哪一步

## What

- **Phase 通过确认**：Phase 全部 OK 时，猫明确说"Phase X 完成 ✓ 进入 Phase Y"，不静默跳过
- **可选 Phase 主动询问**：Phase 3.5 等可选阶段，猫主动问"是否要配置进阶功能？"，给 Yes/No 选择
- **Phase 标题提示**：进入新 Phase 时展示明确的阶段标题，例如"## Phase 4: 探索功能"

## Acceptance Criteria

- [ ] AC-1: Phase 3 全 OK 时，猫主动告知完成并宣布进入下一阶段
- [ ] AC-2: Phase 3.5 开始前猫主动询问是否配置进阶功能
- [ ] AC-3: 每个 Phase 开始时有明确的标题标识当前阶段

## Dependencies

- Related: F059（开源社区治理）
- Related: F110（Bootcamp Vision Elicitation — bootcamp 整体升级）
