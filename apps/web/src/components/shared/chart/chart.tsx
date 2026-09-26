import { useId, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The five chart colours, a fixed slot per series (`--chart-1` … `--chart-5`
 * in tokens.css). A series keeps its slot whatever else is on screen, so a
 * filter never repaints it; there is no sixth, so a chart with more series
 * folds the smallest into "Other".
 */
export type ChartSlot = 1 | 2 | 3 | 4 | 5;

export type ChartSeries<Key extends string> = {
  key: Key;
  /** Sentence case, as the legend and tooltip say it: "Service", "Loan interest". */
  label: string;
  slot: ChartSlot;
};

/**
 * - `bar`: one bar per period, a series beside another. Monthly totals.
 * - `stacked`: the series stacked into one bar per period; the bar is the total.
 * - `step`: a value that holds between periods and changes at each (a loan balance).
 * - `line`: a straight-segment line for values measured continuously. Never
 *   for totals per period: a line implies values between the months.
 */
export type ChartForm = 'bar' | 'stacked' | 'step' | 'line';

type ValueFormat = 'money' | 'number' | ((value: number) => string);

type ChartProps<Row extends Record<string, unknown>, Key extends string> = {
  data: Row[];
  /** The key of each row's period: "2026-09" months, read through `format.date`. */
  xKey: keyof Row & string;
  series: ChartSeries<Key>[];
  form: ChartForm;
  /** How values read in the tooltip and table; the axis shortens money ("₹1.3L"). */
  valueFormat?: ValueFormat;
  /** A shorter form for the axis ticks when `valueFormat` is too long for them ("₹24" for "₹24.00/km"). */
  axisFormat?: (value: number) => string;
  /** Names the chart for assistive technology and captions its data table. */
  label: string;
  height?: number;
  className?: string;
  /**
   * A vertical line at one period, labelled ("Today" on a loan's balance): the
   * `xKey` value it sits on. Not drawn when no row has that value.
   */
  marker?: { at: string; label: string };
};

const colour = (slot: ChartSlot) => `var(--chart-${slot})`;

/** "2026-09" → a Date on the first of the month, so `format.date` can name it. */
function monthOf(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
    ? `${value}-01T00:00:00.000Z`
    : value;
}

function monthLabel(value: unknown, style: 'monthYear' | 'monthYearLong' = 'monthYear') {
  const text = format.date(monthOf(value) as string, style);
  return text === format.EMPTY ? String(value ?? '') : text;
}

function formatter(valueFormat: ValueFormat) {
  if (typeof valueFormat === 'function') return valueFormat;
  return valueFormat === 'money'
    ? (value: number) => format.money(value)
    : (value: number) => format.number(value);
}

function axisFormatter(valueFormat: ValueFormat) {
  if (valueFormat === 'money') return (value: number) => format.compactMoney(value);
  return formatter(valueFormat);
}

/** A small square in a series colour: identity beside a label, never the label itself. */
export function ChartSwatch({ slot, className }: { slot: ChartSlot; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-[2px]', className)}
      style={{ backgroundColor: colour(slot) }}
    />
  );
}

/** Every series named beside its colour, in slot order. Text stays in text colours. */
export function ChartLegend<Key extends string>({
  series,
  className,
}: {
  series: ChartSeries<Key>[];
  className?: string;
}) {
  return (
    <ul
      aria-hidden="true"
      className={cn('flex flex-wrap gap-x-4 gap-y-1 text-small text-fg-2', className)}
      data-slot="chart-legend"
    >
      {series.map((item) => (
        <li className="inline-flex items-center gap-1.5" key={item.key}>
          <ChartSwatch slot={item.slot} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip<Key extends string>({
  active,
  payload,
  label,
  series,
  read,
  total,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  label?: unknown;
  series: ChartSeries<Key>[];
  read: (value: number) => string;
  total: boolean;
}) {
  if (!active || !payload?.length) return null;

  const rows = series
    .map((item) => ({ ...item, value: payload.find((entry) => entry.dataKey === item.key)?.value }))
    .filter((row): row is typeof row & { value: number } => typeof row.value === 'number');
  const sum = rows.reduce((acc, row) => acc + row.value, 0);

  return (
    <div className="min-w-44 rounded-control border border-line bg-surface p-3 text-small shadow-overlay">
      <p className="mb-1.5 font-semibold text-fg">{monthLabel(label, 'monthYearLong')}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li className="flex items-center gap-2" key={row.key}>
            <ChartSwatch slot={row.slot} />
            <span className="text-fg-2">{row.label}</span>
            <span className="ml-auto pl-4 font-medium text-fg tabular-nums">{read(row.value)}</span>
          </li>
        ))}
      </ul>
      {total && rows.length > 1 ? (
        <p className="mt-1.5 flex border-t border-line-subtle pt-1.5 font-semibold text-fg">
          Total <span className="ml-auto pl-4 tabular-nums">{read(sum)}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * One chart for the app, over Recharts: the token palette, a single value
 * axis, months named by `format.date`, money shortened on the axis and in full
 * in the tooltip, a legend whenever there is more than one series, and the
 * numbers as a table for screen readers.
 *
 * Totals per period are bars (or steps), never smoothed lines. Two measures on
 * different scales are two charts, never two y-axes.
 */
export function Chart<Row extends Record<string, unknown>, Key extends string>({
  data,
  xKey,
  series,
  form,
  valueFormat = 'money',
  axisFormat,
  label,
  height = 240,
  className,
  marker,
}: ChartProps<Row, Key>) {
  const tableId = useId();
  const read = formatter(valueFormat);
  const axis = axisFormat ?? axisFormatter(valueFormat);
  const stacked = form === 'stacked';
  // The gap between stacked segments is card colour; on a dense chart (three
  // years of EMIs on a phone) 2px would swallow the thinnest segments.
  const gap = data.length > 18 ? 1 : 2;

  const grid = <CartesianGrid stroke="var(--line-subtle)" vertical={false} />;
  const markerLine =
    marker && data.some((row) => row[xKey] === marker.at) ? (
      <ReferenceLine
        ifOverflow="extendDomain"
        label={{
          value: marker.label,
          position: 'insideTopRight',
          fill: 'var(--fg-2)',
          fontSize: 12,
        }}
        stroke="var(--fg-3)"
        strokeDasharray="4 3"
        x={marker.at}
      />
    ) : null;
  const xAxis = (
    <XAxis
      axisLine={false}
      dataKey={xKey as string}
      interval="preserveStartEnd"
      minTickGap={16}
      tick={{ fill: 'var(--fg-3)', fontSize: 12 }}
      tickFormatter={(value: unknown) => monthLabel(value)}
      tickLine={false}
      tickMargin={8}
    />
  );
  const yAxis = (
    <YAxis
      axisLine={false}
      tick={{ fill: 'var(--fg-3)', fontSize: 12 }}
      tickFormatter={(value: number) => axis(value)}
      tickLine={false}
      width={56}
    />
  );
  const tooltip = (
    <Tooltip
      content={(props) => <ChartTooltip {...props} read={read} series={series} total={stacked} />}
      cursor={
        form === 'bar' || stacked ? { fill: 'var(--surface-page)' } : { stroke: 'var(--line)' }
      }
      isAnimationActive={false}
    />
  );

  return (
    <figure
      aria-label={label}
      className={cn('flex min-w-0 flex-col gap-3', className)}
      data-marker={markerLine ? marker!.at : undefined}
      data-slot="chart"
      data-form={form}
    >
      {series.length > 1 ? <ChartLegend series={series} /> : null}
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer height="100%" minWidth={0} width="100%">
          {form === 'bar' || stacked ? (
            <BarChart
              barCategoryGap="24%"
              barGap={2}
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              {markerLine}
              {series.map((item, index) => (
                <Bar
                  dataKey={item.key}
                  fill={colour(item.slot)}
                  isAnimationActive={false}
                  key={item.key}
                  maxBarSize={40}
                  name={item.label}
                  // Rounded only at the data end: the top of a lone bar, the top segment of a stack.
                  radius={!stacked || index === series.length - 1 ? [4, 4, 0, 0] : 0}
                  stackId={stacked ? 'stack' : undefined}
                  // A gap of card between stacked segments keeps them apart.
                  stroke={stacked ? 'var(--surface-card)' : undefined}
                  strokeWidth={stacked ? gap : 0}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              {markerLine}
              {series.map((item) => (
                <Line
                  activeDot={{ r: 4, stroke: 'var(--surface-card)', strokeWidth: 2 }}
                  dataKey={item.key}
                  dot={false}
                  isAnimationActive={false}
                  key={item.key}
                  name={item.label}
                  stroke={colour(item.slot)}
                  strokeWidth={2}
                  type={form === 'step' ? 'stepAfter' : 'linear'}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <ChartTable data={data} id={tableId} label={label} read={read} series={series} xKey={xKey} />
    </figure>
  );
}

/** The chart's numbers as a table, for screen readers (and anyone who needs the figures). */
function ChartTable<Row extends Record<string, unknown>, Key extends string>({
  data,
  xKey,
  series,
  read,
  label,
  id,
}: {
  data: Row[];
  xKey: keyof Row & string;
  series: ChartSeries<Key>[];
  read: (value: number) => string;
  label: string;
  id: string;
}): ReactNode {
  // The wrapper is what hides it: a table ignores `sr-only`'s 1 px width and
  // lays its columns out in full, widening the page on a phone (#364).
  return (
    <div className="sr-only">
      <table id={id}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {series.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={String(row[xKey])}>
              <th scope="row">{monthLabel(row[xKey], 'monthYearLong')}</th>
              {series.map((item) => {
                const value = row[item.key];
                return (
                  <td key={item.key}>{typeof value === 'number' ? read(value) : format.EMPTY}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
