import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

/**
 * A password field with a show/hide toggle (#343), so a long password can be
 * checked before sending it. Forwards its ref for react-hook-form's `register`.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          className={cn('pr-12', className)}
          ref={ref}
          type={visible ? 'text' : 'password'}
          {...props}
        />
        <button
          aria-label="Show password"
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-fg-3 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    );
  },
);
