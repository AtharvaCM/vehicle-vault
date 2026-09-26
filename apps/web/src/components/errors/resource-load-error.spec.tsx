import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { ResourceLoadError, classifyResourceLoadError } from './resource-load-error';

const listAction = <a href="/garage">Your garage</a>;

describe('classifyResourceLoadError', () => {
  it('reads a 404 as not-found', () => {
    expect(classifyResourceLoadError(new ApiError('nope', 404))).toBe('not-found');
  });

  it('reads a 403 as forbidden', () => {
    expect(classifyResourceLoadError(new ApiError('nope', 403))).toBe('forbidden');
  });

  it('reads a 500 as retryable', () => {
    expect(classifyResourceLoadError(new ApiError('nope', 500))).toBe('retryable');
  });

  it('reads a network error (not an ApiError at all) as retryable', () => {
    expect(classifyResourceLoadError(new TypeError('Failed to fetch'))).toBe('retryable');
  });
});

describe('ResourceLoadError', () => {
  it('tells a malformed or unknown id apart with honest 404 copy and no Try again', () => {
    render(
      <ResourceLoadError
        error={new ApiError('Vehicle not found', 404)}
        listAction={listAction}
        onRetry={vi.fn()}
        resourceLabel="Vehicle"
        subject="vehicle"
      />,
    );

    expect(screen.getByText("This vehicle isn't in your garage.")).toBeInTheDocument();
    // Said once: the page's own title, no second card repeating it (#365).
    expect(screen.getAllByText('Vehicle not found')).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vehicle not found' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your garage' })).toBeInTheDocument();
  });

  it('tells removed access apart from a plain not-found', () => {
    render(
      <ResourceLoadError
        error={new ApiError('Forbidden', 403)}
        listAction={listAction}
        onRetry={vi.fn()}
        resourceLabel="Vehicle"
        subject="vehicle"
      />,
    );

    expect(
      screen.getByText('You no longer have access — the owner may have removed you.'),
    ).toBeInTheDocument();
    expect(screen.queryByText("This vehicle isn't in your garage.")).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers a working Try again on a network/5xx failure', () => {
    const onRetry = vi.fn();
    render(
      <ResourceLoadError
        error={new ApiError('Internal error', 500)}
        listAction={listAction}
        onRetry={onRetry}
        resourceLabel="Vehicle"
        subject="vehicle"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: "Couldn't load this vehicle" }),
    ).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables Try again and says so while a retry is already in flight', () => {
    render(
      <ResourceLoadError
        error={new ApiError('Internal error', 500)}
        isRetrying
        listAction={listAction}
        onRetry={vi.fn()}
        resourceLabel="Vehicle"
        subject="vehicle"
      />,
    );

    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled();
  });

  it('always shows the way back to the list, in every variant', () => {
    for (const error of [new ApiError('x', 404), new ApiError('x', 403), new ApiError('x', 500)]) {
      const { unmount } = render(
        <ResourceLoadError
          error={error}
          listAction={listAction}
          onRetry={vi.fn()}
          resourceLabel="Vehicle"
          subject="vehicle"
        />,
      );

      expect(screen.getByRole('link', { name: 'Your garage' })).toBeInTheDocument();
      unmount();
    }
  });
});
