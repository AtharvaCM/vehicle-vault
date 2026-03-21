import { Search } from 'lucide-react';
import { MaintenanceCategory } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

export type MaintenanceSortOption =
  | 'service-date-desc'
  | 'service-date-asc'
  | 'cost-desc'
  | 'odometer-desc';

type MaintenanceListControlsProps = {
  searchValue: string;
  category: MaintenanceCategory | 'all';
  sortBy: MaintenanceSortOption;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: MaintenanceCategory | 'all') => void;
  onSortChange: (value: MaintenanceSortOption) => void;
  onReset: () => void;
};

const sortLabels: Record<MaintenanceSortOption, string> = {
  'service-date-desc': 'Newest service',
  'service-date-asc': 'Oldest service',
  'cost-desc': 'Highest cost',
  'odometer-desc': 'Highest odometer',
};

export function MaintenanceListControls({
  searchValue,
  category,
  sortBy,
  resultCount,
  totalCount,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onReset,
}: MaintenanceListControlsProps) {
  const hasFilters = searchValue.trim().length > 0 || category !== 'all' || sortBy !== 'service-date-desc';

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto] lg:items-end">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Search
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by workshop, notes, or category"
              value={searchValue}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Category
          </p>
          <Select
            onValueChange={(value) => onCategoryChange(value as MaintenanceCategory | 'all')}
            value={category}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.values(MaintenanceCategory).map((option) => (
                <SelectItem key={option} value={option}>
                  {formatMaintenanceCategory(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Sort
          </p>
          <Select onValueChange={(value) => onSortChange(value as MaintenanceSortOption)} value={sortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort records" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{resultCount}</span> of {totalCount}
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
