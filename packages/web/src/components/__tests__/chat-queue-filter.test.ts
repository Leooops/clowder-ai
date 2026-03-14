/**
 * #20: Queued messages should NOT appear in the chat message stream.
 *
 * When a user message is queued (its ID matches a QueueEntry with status='queued'),
 * it should be filtered out of the chat render items and only shown in QueuePanel.
 *
 * Crucially, when status changes from 'queued' to 'processing', the message must
 * reappear in the chat stream — because QueuePanel only shows 'queued' entries.
 */

import { describe, expect, it } from 'vitest';
import type { QueueEntry } from '@/stores/chat-types';
import type { ChatMessage } from '@/stores/chatStore';

/** Mirrors the queuedMessageIds logic in ChatContainer (only status='queued') */
function buildQueuedMessageIds(queue: QueueEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of queue) {
    if (entry.status !== 'queued') continue;
    if (entry.messageId) ids.add(entry.messageId);
    for (const mid of entry.mergedMessageIds) ids.add(mid);
  }
  return ids;
}

/** Mirrors the renderItems filtering logic in ChatContainer */
function filterMessages(messages: ChatMessage[], queuedIds: Set<string>): ChatMessage[] {
  return messages.filter((m) => !queuedIds.has(m.id));
}

const NOW = Date.now();

function makeMsg(id: string, type: 'user' | 'assistant' = 'user'): ChatMessage {
  return { id, type, content: `msg ${id}`, timestamp: NOW } as ChatMessage;
}

function makeQueueEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: 'q1',
    threadId: 'thread-1',
    userId: 'u1',
    content: 'queued message',
    messageId: null,
    mergedMessageIds: [],
    source: 'user',
    targetCats: ['opus'],
    intent: 'execute',
    status: 'queued',
    createdAt: NOW,
    ...overrides,
  };
}

describe('#20: queued message filtering', () => {
  it('hides a message whose ID matches a queued entry', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3', 'assistant')];
    const queue = [makeQueueEntry({ messageId: 'm2' })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('hides messages matching mergedMessageIds', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3')];
    const queue = [makeQueueEntry({ messageId: 'm1', mergedMessageIds: ['m2'] })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m3']);
  });

  it('shows all messages when queue is empty', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    const queuedIds = buildQueuedMessageIds([]);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('shows all messages when queue entries have no messageId yet', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    const queue = [makeQueueEntry({ messageId: null })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('handles multiple queue entries correctly', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3'), makeMsg('m4')];
    const queue = [makeQueueEntry({ id: 'q1', messageId: 'm2' }), makeQueueEntry({ id: 'q2', messageId: 'm4' })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  // ── P1 fix: processing entries must NOT be filtered ──

  it('does NOT hide messages when entry status is processing', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    const queue = [makeQueueEntry({ messageId: 'm2', status: 'processing' })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    // processing entry → message visible in chat (QueuePanel already hides it)
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('queued→processing transition: message becomes visible in chat', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3')];

    // Phase 1: entry is queued → m2 hidden
    const queuedPhase = [makeQueueEntry({ messageId: 'm2', status: 'queued' })];
    const hiddenIds = buildQueuedMessageIds(queuedPhase);
    expect(filterMessages(messages, hiddenIds).map((m) => m.id)).toEqual(['m1', 'm3']);

    // Phase 2: entry moves to processing → m2 visible again
    const processingPhase = [makeQueueEntry({ messageId: 'm2', status: 'processing' })];
    const visibleIds = buildQueuedMessageIds(processingPhase);
    expect(filterMessages(messages, visibleIds).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('merged entry: all messageIds become visible on processing', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3'), makeMsg('m4')];
    const entry = makeQueueEntry({
      messageId: 'm2',
      mergedMessageIds: ['m3'],
      status: 'queued',
    });

    // Queued: m2 + m3 hidden
    const queuedIds = buildQueuedMessageIds([entry]);
    expect(filterMessages(messages, queuedIds).map((m) => m.id)).toEqual(['m1', 'm4']);

    // Processing: m2 + m3 both visible
    const processingEntry = { ...entry, status: 'processing' as const };
    const processingIds = buildQueuedMessageIds([processingEntry]);
    expect(filterMessages(messages, processingIds).map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('normal/force delivery messages are never filtered (no queue entry)', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    // Empty queue — simulates normal/force delivery
    const queuedIds = buildQueuedMessageIds([]);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
