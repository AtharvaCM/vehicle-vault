import { useMutation } from '@tanstack/react-query';

import { getAccountExport } from '../api/get-account-export';
import { downloadJsonFile } from '../utils/download-json-file';

export function useDownloadAccountExport() {
  return useMutation({
    mutationFn: async () => {
      const response = await getAccountExport();
      const fileName = response.meta?.fileName ?? 'vehicle-vault-export.json';

      downloadJsonFile(fileName, response.data);

      return response;
    },
  });
}
