import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SearchableSelect } from './searchable-select';

beforeAll(() => {
  // cmdk measures and scrolls its list; jsdom does neither.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
});

const options = [
  { value: 'Creta', label: 'Creta' },
  { value: 'Venue', label: 'Venue' },
];

function renderPicker() {
  render(
    <>
      <SearchableSelect
        id="model"
        onChange={vi.fn()}
        options={options}
        placeholder="Select model"
        value=""
      />
      <input aria-label="Next field" />
    </>,
  );
}

async function pickCreta() {
  await userEvent.click(document.getElementById('model')!);
  const list = await screen.findByRole('listbox');
  // Synchronous, so nothing else runs before the test's next step.
  fireEvent.click(within(list).getByRole('option', { name: 'Creta' }));
}

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe('SearchableSelect focus on close', () => {
  it('returns focus to its trigger after a pick', async () => {
    renderPicker();

    await pickCreta();
    await flushTimers();

    expect(document.getElementById('model')).toHaveFocus();
  });

  it('leaves focus where it went if the owner moved on before the list finished closing', async () => {
    renderPicker();

    await pickCreta();
    screen.getByLabelText('Next field').focus();
    await flushTimers();

    expect(screen.getByLabelText('Next field')).toHaveFocus();
  });
});
