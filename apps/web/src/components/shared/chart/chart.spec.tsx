import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chart, ChartRange, ShareBar, type ChartSeries } from '.';

const rows = [
  { period: '2026-08', fuel: 4200, service: 0 },
  { period: '2026-09', fuel: 3800.5, service: 131624 },
];
const series: ChartSeries<'fuel' | 'service'>[] = [
  { key: 'service', label: 'Service', slot: 1 },
  { key: 'fuel', label: 'Fuel', slot: 2 },
];

describe('Chart', () => {
  it('is a named figure with its numbers in a table, months and rupees as people read them', () => {
    render(
      <Chart data={rows} form="stacked" label="Monthly spend" series={series} xKey="period" />,
    );

    expect(screen.getByRole('figure', { name: 'Monthly spend' })).toHaveAttribute(
      'data-form',
      'stacked',
    );
    const table = screen.getByRole('table', { name: 'Monthly spend' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Month', 'Service', 'Fuel']);
    const september = within(table).getByRole('row', { name: /September 2026/ });
    expect(september).toHaveTextContent('₹1,31,624');
    expect(september).toHaveTextContent('₹3,801');
  });

  it('names every series in a legend once there is more than one', () => {
    render(<Chart data={rows} form="bar" label="Monthly spend" series={series} xKey="period" />);

    const legend = document.querySelector('[data-slot="chart-legend"]');
    expect(legend).toHaveTextContent('ServiceFuel');
  });

  it('has no legend box for a single series: the title names it', () => {
    render(
      <Chart
        data={rows}
        form="step"
        label="Balance"
        series={[{ key: 'fuel', label: 'Fuel', slot: 1 }]}
        xKey="period"
      />,
    );

    expect(document.querySelector('[data-slot="chart-legend"]')).toBeNull();
  });

  it('reads values in the format it is given', () => {
    render(
      <Chart
        data={[{ period: '2026-09', perKm: 8.4 }]}
        form="bar"
        label="Cost per km"
        series={[{ key: 'perKm', label: 'Per km', slot: 1 }]}
        valueFormat={(value) => `₹${value}/km`}
        xKey="period"
      />,
    );

    expect(screen.getByRole('cell', { name: '₹8.4/km' })).toBeInTheDocument();
  });
});

describe('ShareBar', () => {
  it('names each part with its amount and share, leaving out empty parts', () => {
    render(
      <ShareBar
        label="Spend by category"
        shares={[
          { key: 'service', label: 'Service', slot: 1, value: 7500 },
          { key: 'fuel', label: 'Fuel', slot: 2, value: 2500 },
          { key: 'insurance', label: 'Insurance', slot: 3, value: 0 },
        ]}
      />,
    );

    const group = screen.getByRole('group', { name: 'Spend by category' });
    expect(
      within(group)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Service₹7,50075%', 'Fuel₹2,50025%']);
  });

  it('draws nothing when there is nothing to split', () => {
    const { container } = render(
      <ShareBar label="Spend" shares={[{ key: 'fuel', label: 'Fuel', slot: 2, value: 0 }]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('ChartRange', () => {
  const options = [
    { value: '1y', label: '12 months' },
    { value: 'all', label: 'All time' },
  ] as const;

  it('picks a range and never empties it', () => {
    const onChange = vi.fn();
    render(<ChartRange onChange={onChange} options={options} value="1y" />);

    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    expect(onChange).toHaveBeenCalledWith('all');

    onChange.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: '12 months' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Range')).toBeInTheDocument();
  });
});
