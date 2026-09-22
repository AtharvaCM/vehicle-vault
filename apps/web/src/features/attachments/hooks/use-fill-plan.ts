import { useQuery } from '@tanstack/react-query';

import { fillPlanQueryOptions } from '../api/get-fill-plan';

/** What "Fill in from photo" would add to the record; asks only once the file has been read. */
export function useFillPlan(attachmentId: string, { enabled }: { enabled: boolean }) {
  return useQuery({ ...fillPlanQueryOptions(attachmentId), enabled });
}
