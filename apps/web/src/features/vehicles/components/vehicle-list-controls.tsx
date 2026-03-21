import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vehicleSortOptions, type VehicleSortOption } from '../types/vehicle-list-search';

type VehicleListControlsProps = {
  searchValue: string;
  sortBy: VehicleSortOption;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onSortChange: (value: VehicleSortOption) => void;
  onReset: () => void;
};

const sortLabels: Record<VehicleSortOption, string> = {
  'updated-desc': 'Recently updated',
  'registration-asc': 'Registration A-Z',
  'odometer-desc': 'Highest odometer',
  'year-desc': 'Newest year',
};

export function VehicleListControls({
  searchValue,
  sortBy,
  resultCount,
  totalCount,
  onSearchChange,
  onSortChange,
  onReset,
}: VehicleListControlsProps) {
  const hasFilters = searchValue.trim().length > 0 || sortBy !== 'updated-desc';

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px]">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Search
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by registration, make, model, or nickname"
                value={searchValue}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Sort
            </p>
            <Select onValueChange={(value) => onSortChange(value as VehicleSortOption)} value={sortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort vehicles" />
              </SelectTrigger>
              <SelectContent>
                {vehicleSortOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {sortLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
