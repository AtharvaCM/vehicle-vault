import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DueLine } from './due-line';
import { Figure } from './figure';
import { Money } from './money';
import { SectionHeader } from './section-header';
import { dueStatus, StatusDot, StatusPill, type Status } from './status-pill';

// 10:00 in India on Wed 23 Sep 2026.
const now = new Date('2026-09-23T04:30:00.000Z');
const day = (isoDate: string) => `${isoDate}T00:00:00.000Z`;

describe('StatusPill and StatusDot', () => {
  const statuses: Status[] = ['late', 'soon', 'ok', 'ended', 'draft', 'info'];

  it.each(statuses)('%s pairs its colour with words, and the dot stays silent', (status) => {
    const { unmount } = render(<StatusPill status={status}>Words</StatusPill>);

    expect(screen.getByText('Words')).toHaveAttribute('data-status', status);
    expect(document.querySelector('[data-slot="status-mark"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    unmount();
  });

  it('colours the words, not just the dot', () => {
    render(<StatusDot status="late">3 days late</StatusDot>);

    expect(screen.getByText('3 days late')).toHaveClass('text-late');
  });
});

describe('dueStatus', () => {
  it('is late once a date to act on has passed', () => {
    expect(dueStatus(-3)).toBe('late');
  });

  it('is soon today and this week; after that a task is coming up and a paper all clear', () => {
    expect(dueStatus(0)).toBe('soon');
    expect(dueStatus(7)).toBe('soon');
    expect(dueStatus(8)).toBe('info');
    expect(dueStatus(8, { mode: 'ends' })).toBe('ok');
    expect(dueStatus(20, { soonWithin: 30 })).toBe('soon');
  });

  it('lets a lapsed validity be late (insurance) or ended (a warranty)', () => {
    expect(dueStatus(-1, { mode: 'ends' })).toBe('late');
    expect(dueStatus(-1, { mode: 'ends', lapsed: 'ended' })).toBe('ended');
  });

  it('has no status without a date', () => {
    expect(dueStatus(null)).toBeNull();
  });
});

describe('DueLine', () => {
  function line() {
    return document.querySelector('[data-slot="due-line"]');
  }

  it('says how late, then when it ended: "3 days late · Ended 20 Sep"', () => {
    render(<DueLine date={day('2026-09-20')} mode="ends" now={now} />);

    expect(line()).toHaveTextContent('3 days late· Ended 20 Sep');
    expect(line()).toHaveAttribute('data-status', 'late');
  });

  it('says a lapsed warranty ended, in grey, once', () => {
    render(<DueLine date={day('2026-08-01')} lapsed="ended" mode="ends" now={now} />);

    expect(line()).toHaveTextContent(/^Ended 1 Aug$/);
    expect(line()).toHaveAttribute('data-status', 'ended');
  });

  it('gives the weekday for this week', () => {
    render(<DueLine date={day('2026-09-23')} now={now} />);

    expect(line()).toHaveTextContent('Today· Wed 23 Sep');
    expect(line()).toHaveAttribute('data-status', 'soon');
  });

  it('counts the days left on a paper, with the end date', () => {
    render(<DueLine date={day('2027-02-23')} mode="ends" now={now} />);

    expect(line()).toHaveTextContent('153 days left· Ends 23 Feb 2027');
    expect(line()).toHaveAttribute('data-status', 'ok');
  });

  it('says when an overdue task was due', () => {
    render(<DueLine date={day('2026-09-01')} now={now} />);

    expect(line()).toHaveTextContent('22 days late· Due 1 Sep');
  });

  it('uses days counted elsewhere', () => {
    render(<DueLine date={day('2026-09-23')} days={-1} now={now} />);

    expect(line()).toHaveTextContent('1 day late');
  });

  it('shows a dash without a date', () => {
    render(<DueLine date={null} now={now} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Figure', () => {
  it('labels its value in sentence case, as a named group', () => {
    render(
      <Figure hint="Service, fuel and insurance" label="Spent, last 12 months" value="₹28,236" />,
    );

    const group = screen.getByRole('group', { name: 'Spent, last 12 months' });
    expect(group).toHaveTextContent('₹28,236');
    expect(screen.getByText('Spent, last 12 months')).not.toHaveClass('uppercase');
  });
});

describe('Money', () => {
  it('writes rupees in Indian grouping with tabular numerals', () => {
    render(<Money value={131624} />);

    expect(screen.getByText('₹1,31,624')).toHaveClass('tabular-nums');
  });

  it('shows a dash for no amount', () => {
    render(<Money value={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('SectionHeader', () => {
  it('is a heading with its description and actions', () => {
    render(
      <SectionHeader
        actions={<button type="button">History</button>}
        description="The last two things you logged."
        title="Recently logged"
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Recently logged' })).toBeInTheDocument();
    expect(screen.getByText('The last two things you logged.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
  });
});
