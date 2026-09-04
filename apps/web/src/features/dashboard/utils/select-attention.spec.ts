import { describe, expect, it } from 'vitest';

import { makeAttentionItem } from '../test/fixtures';
import { splitAttention } from './select-attention';

const overdue = makeAttentionItem({ id: 'r-overdue', urgency: 'overdue', daysUntilDue: -2 });
const today = makeAttentionItem({ id: 'r-today', urgency: 'today', daysUntilDue: 0 });
const week = makeAttentionItem({ id: 'r-week', urgency: 'this_week', daysUntilDue: 4 });
const monthDoc = makeAttentionItem({
  id: 'd-month',
  kind: 'document',
  documentKind: 'insurance',
  title: 'Insurance policy',
  urgency: 'this_month',
  daysUntilDue: 20,
});
const weekDoc = makeAttentionItem({
  id: 'd-week',
  kind: 'document',
  documentKind: 'puc',
  title: 'PUC certificate',
  urgency: 'this_week',
  daysUntilDue: 5,
});
const monthReminder = makeAttentionItem({ id: 'r-month', urgency: 'this_month', daysUntilDue: 12 });
const attention = [overdue, today, week, weekDoc, monthDoc, monthReminder];

describe('splitAttention', () => {
  it('keeps urgent items in the queue and this_month items in coming up', () => {
    const result = splitAttention(attention);

    expect(result.queue.map((item) => item.id)).toEqual(['r-overdue', 'r-today', 'r-week', 'd-week']);
    expect(result.comingUp.map((item) => item.id)).toEqual(['d-month', 'r-month']);
  });

  it('caps coming up at five items', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      makeAttentionItem({ id: `m-${index}`, urgency: 'this_month', daysUntilDue: 10 + index }),
    );

    expect(splitAttention(many).comingUp).toHaveLength(5);
  });

  it('filters by focus and empties coming up while a focus is active', () => {
    expect(splitAttention(attention, 'overdue').queue.map((item) => item.id)).toEqual([
      'r-overdue',
    ]);
    expect(splitAttention(attention, 'week').queue.map((item) => item.id)).toEqual([
      'r-today',
      'r-week',
      'd-week',
    ]);
    expect(splitAttention(attention, 'documents').queue.map((item) => item.id)).toEqual([
      'd-week',
      'd-month',
    ]);
    expect(splitAttention(attention, 'documents').comingUp).toEqual([]);
  });
});
