import { Search } from 'lucide-react';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { formatReminderStatus } from '../utils/format-reminder-status';
import { formatReminderType } from '../utils/format-reminder-type';
import { reminderSortOptions, type ReminderSortOption } from '../types/reminder-list-search';

type ReminderListControlsProps = {
  searchValue: string;
  status: ReminderStatus | 'all';
  type: ReminderType | 'all';
  sortBy: ReminderSortOption;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ReminderStatus | 'all') => void;
  onTypeChange: (value: ReminderType | 'all') => void;
  onSortChange: (value: ReminderSortOption) => void;
  onReset: () => void;
};

const sortLabels: Record<ReminderSortOption, string> = {
  urgency: 'Most urgent first',
  'due-date-asc': 'Soonest due date',
  'due-date-desc': 'Latest due date',
  'updated-desc': 'Recently updated',
};

export function ReminderListControls({
  searchValue,
  status,
  type,
  sortBy,
  resultCount,
  totalCount,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onSortChange,
  onReset,
}: ReminderListControlsProps) {
  const hasFilters =
    searchValue.trim().length > 0 || status !== 'all' || type !== 'all' || sortBy !== 'urgency';

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_200px_200px_220px_auto] xl:items-end">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Search
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by title, vehicle, or notes"
              value={searchValue}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Status
          </p>
          <Select
            onValueChange={(value) => onStatusChange(value as ReminderStatus | 'all')}
            value={status}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.values(ReminderStatus).map((option) => (
                <SelectItem key={option} value={option}>
                  {formatReminderStatus(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Type
          </p>
          <Select
            onValueChange={(value) => onTypeChange(value as ReminderType | 'all')}
            value={type}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.values(ReminderType).map((option) => (
                <SelectItem key={option} value={option}>
                  {formatReminderType(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Sort
          </p>
          <Select
            onValueChange={(value) => onSortChange(value as ReminderSortOption)}
            value={sortBy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort reminders" />
            </SelectTrigger>
            <SelectContent>
              {reminderSortOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {sortLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 xl:flex-col xl:items-end">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{resultCount}</span> of{' '}
            {totalCount}
          </p>
          {hasFilters ? (
            <Button onClick={onReset} size="xs" type="button" variant="ghost">
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
