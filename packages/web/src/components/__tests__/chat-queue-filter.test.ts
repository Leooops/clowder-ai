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

/** Mirrors the queuedContentCounts logic in ChatContainer (ID-aware, merged-aware) */
function buildQueuedContentCounts(queue: QueueEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const entry of queue) {
    if (entry.status !== 'queued') continue;
    if (!entry.content) continue;
    if (entry.mergedMessageIds.length > 0) {
      const segments = entry.content.split('\n');
      if (!entry.messageId && segments[0]) bump(segments[0]);
      for (let i = 1; i < segments.length; i++) {
        if (i - 1 >= entry.mergedMessageIds.length && segments[i]) {
          bump(segments[i]);
        }
      }
    } else if (!entry.messageId) {
      bump(entry.content);
    }
  }
  return counts;
}

/** Mirrors the renderItems filtering logic in ChatContainer (count-based content match) */
function filterMessages(
  messages: ChatMessage[],
  queuedIds: Set<string>,
  queuedContentCounts: Map<string, number> = new Map(),
): ChatMessage[] {
  const quota = new Map(queuedContentCounts);
  return messages.filter((m) => {
    if (queuedIds.has(m.id)) return false;
    if (m.id.startsWith('user-') && m.type === 'user') {
      const q = quota.get(m.content) ?? 0;
      if (q > 0) {
        quota.set(m.content, q - 1);
        return false;
      }
    }
    return true;
  });
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
  // ── ID-based filtering ──

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

  // ── Processing entries must NOT be filtered ──

  it('does NOT hide messages when entry status is processing', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    const queue = [makeQueueEntry({ messageId: 'm2', status: 'processing' })];
    const queuedIds = buildQueuedMessageIds(queue);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('queued→processing transition: message becomes visible in chat', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3')];

    const queuedPhase = [makeQueueEntry({ messageId: 'm2', status: 'queued' })];
    const hiddenIds = buildQueuedMessageIds(queuedPhase);
    expect(filterMessages(messages, hiddenIds).map((m) => m.id)).toEqual(['m1', 'm3']);

    const processingPhase = [makeQueueEntry({ messageId: 'm2', status: 'processing' })];
    const visibleIds = buildQueuedMessageIds(processingPhase);
    expect(filterMessages(messages, visibleIds).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('merged entry: all messageIds become visible on processing', () => {
    const messages = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3'), makeMsg('m4')];
    const entry = makeQueueEntry({ messageId: 'm2', mergedMessageIds: ['m3'], status: 'queued' });

    const queuedIds = buildQueuedMessageIds([entry]);
    expect(filterMessages(messages, queuedIds).map((m) => m.id)).toEqual(['m1', 'm4']);

    const processingEntry = { ...entry, status: 'processing' as const };
    const processingIds = buildQueuedMessageIds([processingEntry]);
    expect(filterMessages(messages, processingIds).map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('normal/force delivery messages are never filtered (no queue entry)', () => {
    const messages = [makeMsg('m1'), makeMsg('m2')];
    const queuedIds = buildQueuedMessageIds([]);
    const visible = filterMessages(messages, queuedIds);

    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  // ── Content-based optimistic ID fallback ──

  it('hides optimistic bubble via exact content match before ID swap', () => {
    const messages = [
      { id: 'user-aaa', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage,
      makeMsg('m2', 'assistant'),
    ];
    const queue = [makeQueueEntry({ content: 'hello', messageId: null })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    expect(visible.map((m) => m.id)).toEqual(['m2']);
  });

  it('does not hide non-optimistic messages via content match', () => {
    const messages = [{ id: 'server-id-1', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage];
    const queue = [makeQueueEntry({ content: 'hello', messageId: null })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    expect(visible.map((m) => m.id)).toEqual(['server-id-1']);
  });

  it('hides optimistic bubble with multiline content (Shift+Enter) via full string match', () => {
    const multiline = 'line one\nline two\nline three';
    const messages = [{ id: 'user-ccc', type: 'user', content: multiline, timestamp: NOW } as ChatMessage];
    const queue = [makeQueueEntry({ content: multiline, messageId: null })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    expect(visible.map((m) => m.id)).toEqual([]);
  });

  // ── Count-based: force-send safety ──

  it('does not hide force-sent optimistic message with same content as a queued entry', () => {
    const messages = [
      { id: 'user-qqq', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage,
      { id: 'user-rrr', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage,
    ];
    const queue = [makeQueueEntry({ content: 'hello', messageId: null })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // Only ONE bubble hidden (matching queue entry), the second stays visible
    expect(visible.map((m) => m.id)).toEqual(['user-rrr']);
  });

  it('does not hide force-sent message whose content is a substring of queued merged content', () => {
    // Queue has merged content "a\nb" with both IDs backfilled. User force-sends "b".
    // "b" should NOT be hidden — mergedMessageIds already covers the merged "b".
    const messages = [{ id: 'user-sss', type: 'user', content: 'b', timestamp: NOW } as ChatMessage];
    const queue = [makeQueueEntry({ content: 'a\nb', messageId: 'm1', mergedMessageIds: ['m2'] })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // Both IDs covered → no content quota → "b" stays visible
    expect(visible.map((m) => m.id)).toEqual(['user-sss']);
  });

  // ── ID-covered entries skip content quota ──

  it('does not consume content quota when entry already has messageId', () => {
    // Queue entry has messageId backfilled (server-abc), content "hello".
    // User force-sends "hello" → should NOT be hidden by content match.
    const messages = [
      { id: 'server-abc', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage,
      { id: 'user-force', type: 'user', content: 'hello', timestamp: NOW } as ChatMessage,
    ];
    const queue = [makeQueueEntry({ content: 'hello', messageId: 'server-abc' })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // server-abc hidden by ID; user-force should stay visible (no content quota)
    expect(visible.map((m) => m.id)).toEqual(['user-force']);
  });

  // ── Merged entry optimistic segments ──

  it('hides optimistic bubble for merged entry segment not yet ID-covered', () => {
    // Merged entry: content "a\nb", messageId=null (first still optimistic),
    // mergedMessageIds=["server-b"] (second already backfilled by server).
    // The first segment ("a") has no server ID yet → needs content fallback.
    // The second segment ("b") has server ID "server-b" → handled by ID filter.
    const messages = [
      { id: 'user-aaa', type: 'user', content: 'a', timestamp: NOW } as ChatMessage,
      { id: 'user-bbb', type: 'user', content: 'b', timestamp: NOW } as ChatMessage,
    ];
    const queue = [makeQueueEntry({ content: 'a\nb', messageId: null, mergedMessageIds: ['server-b'] })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // user-aaa: hidden by content quota for "a" (first segment, messageId null)
    // user-bbb: stays visible (not in queuedIds, "b" has no content quota since
    //           segment index 1 is covered by mergedMessageIds[0])
    expect(visible.map((m) => m.id)).toEqual(['user-bbb']);
  });

  it('hides third segment when only first two are ID-covered in triple merge', () => {
    // Triple merge: content "a\nb\nc", messageId="server-a" (first covered),
    // mergedMessageIds=["server-b"] (second covered), third still optimistic.
    const messages = [
      { id: 'user-ccc', type: 'user', content: 'c', timestamp: NOW } as ChatMessage,
      { id: 'user-extra', type: 'user', content: 'c', timestamp: NOW } as ChatMessage,
    ];
    const queue = [makeQueueEntry({ content: 'a\nb\nc', messageId: 'server-a', mergedMessageIds: ['server-b'] })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // Only segment "c" (index 2) is uncovered → quota=1 for "c"
    // user-ccc: hidden by content quota
    // user-extra: stays visible (quota exhausted)
    expect(visible.map((m) => m.id)).toEqual(['user-extra']);
  });

  it('skips all segments when merged entry is fully ID-covered', () => {
    // Merged entry: content "a\nb", messageId="server-a", mergedMessageIds=["server-b"]
    // Both covered by server IDs → no content quota at all.
    const messages = [
      { id: 'user-force-a', type: 'user', content: 'a', timestamp: NOW } as ChatMessage,
      { id: 'user-force-b', type: 'user', content: 'b', timestamp: NOW } as ChatMessage,
    ];
    const queue = [makeQueueEntry({ content: 'a\nb', messageId: 'server-a', mergedMessageIds: ['server-b'] })];
    const queuedIds = buildQueuedMessageIds(queue);
    const queuedContents = buildQueuedContentCounts(queue);
    const visible = filterMessages(messages, queuedIds, queuedContents);

    // No content quota → both force-sends stay visible
    expect(visible.map((m) => m.id)).toEqual(['user-force-a', 'user-force-b']);
  });
});
