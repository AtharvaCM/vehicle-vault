import { MaintenanceCategory } from '@vehicle-vault/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategoryChips } from './category-chips';

describe('CategoryChips', () => {
  it('logs New tyres as a tyre replacement, and keeps rotation under More…', () => {
    const onChange = vi.fn();
    render(<CategoryChips labelledBy="what" onChange={onChange} value={undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'New tyres' }));
    expect(onChange).toHaveBeenLastCalledWith(MaintenanceCategory.TyreReplacement);

    expect(screen.queryByRole('button', { name: 'Tyre rotation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tyre rotation' }));
    expect(onChange).toHaveBeenLastCalledWith(MaintenanceCategory.TyreRotation);
  });
});
