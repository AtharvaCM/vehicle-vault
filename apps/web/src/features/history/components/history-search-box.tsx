import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { normalizeHistorySearchText } from '../types/history-search';

/** How long typing pauses before the search is sent: one request per word, not per key. */
export const HISTORY_SEARCH_DEBOUNCE_MS = 300;

type HistorySearchBoxProps = {
  /** The search in the URL. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
};

/**
 * The History search box. What is typed shows at once and reaches the URL
 * (and the API) after a pause. The URL value wins when it changes from
 * elsewhere, such as Clear filters, but not when it is only the typed text
 * trimmed, so a space typed between two words is not taken back.
 */
export function HistorySearchBox({
  value,
  onChange,
  placeholder = 'Search work, workshop, notes or station',
  className,
}: HistorySearchBoxProps) {
  const [text, setText] = useState(value ?? '');
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setText((current) => (normalizeHistorySearchText(current) === value ? current : (value ?? '')));
  }, [value]);

  useEffect(() => {
    const next = normalizeHistorySearchText(text);
    if (next === value) return;
    const timer = window.setTimeout(() => onChangeRef.current(next), HISTORY_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, value]);

  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3"
      />
      <Input
        aria-label="Search history"
        className="pl-9"
        onChange={(event) => setText(event.currentTarget.value)}
        placeholder={placeholder}
        type="search"
        value={text}
      />
    </div>
  );
}
