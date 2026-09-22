import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import { fillFromAttachment } from '../api/fill-from-attachment';

export function useFillFromAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => fillFromAttachment(attachmentId),
    onSuccess: ({ record }, attachmentId) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      // A next-due it filled in makes a reminder on the vehicle.
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments.fillPlan(attachmentId) });
      queryClient.setQueryData(queryKeys.maintenance.detail(record.id), record);
    },
  });
}
