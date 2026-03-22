import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string[];
};

type SearchableSelectProps = {
  disabled?: boolean;
  emptyMessage?: string;
  id?: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
};

export function SearchableSelect({
  disabled = false,
  emptyMessage = 'No results found.',
  id,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search...',
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const stableOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        searchValue: [option.label, ...(option.keywords ?? [])].join(' '),
      })),
    [options],
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-controls={id ? `${id}-content` : undefined}
          aria-expanded={open}
          className="h-10 w-full justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal text-left shadow-none hover:bg-background"
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" id={id ? `${id}-content` : undefined}>
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {stableOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  value={option.searchValue}
                >
                  <Check
                    className={cn('h-4 w-4 text-slate-900', value === option.value ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { SearchableSelectOption };
