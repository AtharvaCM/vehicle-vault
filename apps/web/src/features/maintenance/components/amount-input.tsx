import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The characters an amount is made of; everything else (commas, spaces, ₹) is dropped. */
const AMOUNT_CHAR = /[\d.]/;

/** What was typed, as a number: "1,31,624.5" is 131624.5. Nothing typed is undefined. */
export function parseAmount(text: string): number | undefined {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned || cleaned === '.') return undefined;

  const [whole = '', ...fraction] = cleaned.split('.');
  const value = Number(`${whole || '0'}.${fraction.join('')}`);

  return Number.isFinite(value) ? value : undefined;
}

/**
 * What was typed, grouped the Indian way as it is typed: "131624" reads
 * "1,31,624". A point and up to two digits after it are kept as typed, so
 * "1520." stays open for the paise.
 */
export function groupAmount(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const pointAt = cleaned.indexOf('.');
  const whole = (pointAt === -1 ? cleaned : cleaned.slice(0, pointAt)).replace(/^0+(?=\d)/, '');
  const grouped = whole ? format.number(Number(whole), { decimals: 0 }) : '';

  if (pointAt === -1) return grouped;

  const fraction = cleaned
    .slice(pointAt + 1)
    .replace(/\./g, '')
    .slice(0, 2);

  return `${grouped || '0'}.${fraction}`;
}

function amountText(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? format.number(value, { decimals: 2 })
    : '';
}

/** Where the caret goes after grouping: after the same count of digits and points as before. */
function caretAfter(text: string, amountChars: number) {
  if (amountChars === 0) return 0;

  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (AMOUNT_CHAR.test(text[index] ?? '')) seen += 1;
    if (seen === amountChars) return index + 1;
  }

  return text.length;
}

type AmountInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** ISO code of the amount; rupees show ₹ in front, anything else its code. */
  currencyCode?: string;
};

/**
 * A money field that groups the figure the Indian way while it is typed
 * (₹ 1,31,624), with the number pad on a phone. It holds a number, not the
 * text: an empty field is undefined, never 0.
 */
export function AmountInput({
  value,
  onValueChange,
  currencyCode = 'INR',
  className,
  ref,
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const [text, setText] = useState(() => amountText(value));
  const [shownValue, setShownValue] = useState(value);

  // A value set from outside (a reset, a bill, the line items) replaces the
  // text; one that only echoes what is being typed ("1520." is 1520) does not.
  if (!Object.is(shownValue, value)) {
    setShownValue(value);
    if (parseAmount(text) !== value) setText(amountText(value));
  }

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    if (document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [text]);

  const symbol = !currencyCode || currencyCode.toUpperCase() === 'INR' ? '₹' : currencyCode;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-field text-fg-3 md:text-body"
      >
        {symbol}
      </span>
      <Input
        {...props}
        autoComplete="off"
        className={cn(symbol.length > 1 ? 'pl-14' : 'pl-7', 'font-medium', className)}
        inputMode="decimal"
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          const typedBefore = raw.slice(0, caret).replace(/[^\d.]/g, '').length;
          const grouped = groupAmount(raw);

          pendingCaret.current = caretAfter(grouped, typedBefore);
          setText(grouped);
          onValueChange(parseAmount(grouped));
        }}
        ref={(element) => {
          inputRef.current = element;
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
        type="text"
        value={text}
      />
    </div>
  );
}
