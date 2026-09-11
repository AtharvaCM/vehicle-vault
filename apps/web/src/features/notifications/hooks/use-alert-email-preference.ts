import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { alertEmailPreferenceQueryOptions, setAlertEmailPreference } from '../api/email-preference';

export function useAlertEmailPreference() {
  return useQuery(alertEmailPreferenceQueryOptions());
}

export function useSetAlertEmailPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setAlertEmailPreference,
    onSuccess: (preference) => {
      // Written straight into the cache rather than invalidated: the response
      // is the new state, and a refetch would blank the card for a moment on
      // the one control whose whole job is to say where things stand.
      queryClient.setQueryData(queryKeys.notifications.emailPreference(), preference);
    },
  });
}
