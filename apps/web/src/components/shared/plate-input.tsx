import type { CSSProperties, ChangeEvent, FocusEvent } from 'react';

import { formatRegistrationInput, parseRegistration } from '@/lib/format';
import { cn } from '@/lib/utils';

type PlateInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
};

/**
 * `NumberPlate`'s L metrics (docs/design-language.md): drawn, not set from the
 * type scale, so sizes are exact px in inline styles rather than Tailwind
 * classes (matching `NumberPlate` itself, which the lint rule for the type
 * scale would otherwise flag as an arbitrary font size).
 */
const HEIGHT = 56;
const BORDER = 2.5;
const RADIUS = 6;
const STRIP = 22;
const FONT = 32;
const IND = { font: 8, bottom: 6 };

/**
 * The registration-number field, drawn as the physical plate it becomes: a
 * white body, dark border and the blue "IND" strip. Typing upper-cases as it
 * goes and, the instant the characters typed so far spell out a complete
 * Indian registration, groups it the way the plate prints it — state ·
 * district · series · number, or year · BH · number · series — via
 * `formatRegistrationInput`. A stored (compact) value is shown grouped the
 * same way; `VehicleCreateSchema` compacts it again and judges its validity
 * on submit.
 */
export function PlateInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'MH12AB1234',
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PlateInputProps) {
  const { groups } = parseRegistration(value);
  const hasPlate = groups.length > 0;
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  const plateStyle: CSSProperties = {
    height: HEIGHT,
    borderWidth: BORDER,
    borderRadius: RADIUS,
  };
  const letteringStyle: CSSProperties = {
    fontSize: FONT,
    letterSpacing: '0.08em',
    paddingInline: 16,
    fontStretch: '78%',
  };

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(formatRegistrationInput(event.target.value));
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-stretch overflow-hidden border-solid border-plate-ink bg-plate text-plate-ink focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        invalid && 'border-late',
        className,
      )}
      data-slot="plate-input"
      style={plateStyle}
    >
      <span
        aria-hidden="true"
        className="flex shrink-0 items-end justify-center bg-plate-strip font-sans font-semibold leading-none tracking-[0.04em] text-plate"
        style={{ width: STRIP, paddingBottom: IND.bottom, fontSize: IND.font }}
      >
        {hasPlate ? 'IND' : null}
      </span>
      <input
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        className="min-w-0 flex-1 bg-transparent font-display font-bold leading-none text-plate-ink placeholder:text-plate-ink/30 focus-visible:outline-hidden"
        id={id}
        inputMode="text"
        onBlur={onBlur}
        onChange={handleChange}
        placeholder={placeholder}
        spellCheck={false}
        style={letteringStyle}
        type="text"
        value={formatRegistrationInput(value)}
      />
    </span>
  );
}
