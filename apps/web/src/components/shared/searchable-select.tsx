import { Check, ChevronsUpDown, PencilLine } from 'lucide-react';
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
  /**
   * Offers a last item that is always there, whatever the search: "Can't find
   * it? Enter "{query}" manually". A catalog is never complete, so a picker
   * that only knows its list must not be a dead end.
   */
  onManualEntry?: (query: string) => void;
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
  onManualEntry,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const typedQuery = query.trim();
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
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-controls={id ? `${id}-content` : undefined}
          aria-expanded={open}
          className="h-10 w-full justify-between rounded-xl border border-input bg-background px-3 py-2 text-ui font-normal text-left shadow-none hover:bg-background"
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
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        id={id ? `${id}-content` : undefined}
        onCloseAutoFocus={(event) => {
          // Focus goes back to the trigger only once the close animation ends.
          // By then the owner may be in the next picker already, and pulling
          // focus back would close that picker's list under their pointer.
          const focused = document.activeElement;
          if (focused && focused !== document.body) {
            event.preventDefault();
          }
        }}
      >
        <Command shouldFilter>
          <CommandInput onValueChange={setQuery} placeholder={searchPlaceholder} value={query} />
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
                    className={cn(
                      'h-4 w-4 text-fg',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {onManualEntry ? (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  onSelect={() => {
                    onManualEntry(typedQuery);
                    setOpen(false);
                    setQuery('');
                  }}
                  value="__manual-entry__"
                >
                  <PencilLine className="h-4 w-4 text-fg-3" />
                  <span className="truncate">
                    {typedQuery
                      ? `Can't find it? Enter "${typedQuery}" manually`
                      : "Can't find it? Enter it manually"}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { SearchableSelectOption };
