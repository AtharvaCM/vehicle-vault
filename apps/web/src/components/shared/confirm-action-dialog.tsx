import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ConfirmActionDialogProps = {
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => Promise<void> | void;
  triggerVariant?: React.ComponentProps<typeof Button>['variant'];
  triggerSize?: React.ComponentProps<typeof Button>['size'];
  triggerIcon?: ReactNode;
  className?: string;
  /**
   * Extra content rendered between the description and the footer — e.g. the
   * specific records an action affects. Kept out of `description` because
   * Radix renders that as a `<p>`, which can't hold block-level content.
   */
  children?: ReactNode;
};

export function ConfirmActionDialog({
  title,
  description,
  triggerLabel,
  confirmLabel,
  isPending = false,
  onConfirm,
  triggerVariant = 'secondary',
  triggerSize = 'sm',
  triggerIcon,
  className,
  children,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className={className} size={triggerSize} variant={triggerVariant}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isPending ? 'Working...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
