import { describe, expect, it } from 'vitest';
import { mergeMessages, type Message } from './messages';

const message = (id: string, createdAt = '2026-01-01T00:00:00Z'): Message => ({
  id, createdAt, author: 'Ada', body: 'Hello', instance: 'replica-a',
});

describe('message reconciliation', () => {
  it('deduplicates repeated events and overlapping history', () => {
    expect(mergeMessages([message('a')], [message('a'), message('b')])).toHaveLength(2);
  });
  it('sorts delayed events chronologically', () => {
    expect(mergeMessages([message('later', '2026-01-02T00:00:00Z')], [message('earlier')]).map(m => m.id))
      .toEqual(['earlier', 'later']);
  });
  it('keeps the latest 100 messages', () => {
    const messages = Array.from({ length: 105 }, (_, i) => message(String(i).padStart(3, '0')));
    expect(mergeMessages([], messages).map(m => m.id)).toEqual(messages.slice(5).map(m => m.id));
  });
  it('orders ISO timestamps with different fractional precision correctly', () => {
    expect(mergeMessages([], [
      message('later', '2026-01-01T00:00:00.123Z'),
      message('earlier', '2026-01-01T00:00:00.12Z'),
    ]).map(m => m.id)).toEqual(['earlier', 'later']);
  });
});
