import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UpcomingGroup } from './upcoming-group';

describe('UpcomingGroup', () => {
  it('renders the group heading, its status and the count', () => {
    render(
      <UpcomingGroup count={2} emptyText="Nothing late" group="late">
        <div>a row</div>
      </UpcomingGroup>,
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Late' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute('id', 'upcoming-group-late-heading');
    expect(screen.getByText('Late')).toHaveAttribute('data-status', 'late');
    expect(screen.getByText('· 2')).toBeInTheDocument();

    const section = screen.getByTestId('upcoming-group-late');
    expect(section).toHaveAttribute('aria-labelledby', 'upcoming-group-late-heading');
  });

  it.each([
    ['this_week', 'This week', 'soon'],
    ['this_month', 'This month', 'info'],
    ['later', 'Later', 'ended'],
  ] as const)('names the %s group "%s" with status %s', (group, words, status) => {
    render(
      <UpcomingGroup count={1} emptyText="Nothing here" group={group}>
        <div>a row</div>
      </UpcomingGroup>,
    );

    expect(screen.getByRole('heading', { level: 2, name: words })).toBeInTheDocument();
    expect(screen.getByText(words)).toHaveAttribute('data-status', status);
    expect(screen.getByTestId(`upcoming-group-${group}`)).toBeInTheDocument();
  });

  it('renders the rows and footer when the group is not empty', () => {
    render(
      <UpcomingGroup
        count={1}
        emptyText="Nothing later"
        footer={<button type="button">Show more</button>}
        group="later"
      >
        <div data-testid="a-row">a row</div>
      </UpcomingGroup>,
    );

    expect(screen.getByTestId('a-row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing later')).not.toBeInTheDocument();
  });

  it('renders the empty text and no rows or footer when the count is 0', () => {
    render(
      <UpcomingGroup
        count={0}
        emptyText="Nothing due this month"
        footer={<button type="button">Show more</button>}
        group="this_month"
      >
        <div data-testid="a-row">a row</div>
      </UpcomingGroup>,
    );

    expect(screen.getByText('Nothing due this month')).toBeInTheDocument();
    expect(screen.queryByTestId('a-row')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
});
