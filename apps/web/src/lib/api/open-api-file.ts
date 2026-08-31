import { apiClient } from './api-client';

const OBJECT_URL_LIFETIME_MS = 60_000;

/**
 * File endpoints sit behind the bearer-token guard, so a plain anchor cannot
 * reach them. Fetch through the API client and hand the browser a blob URL.
 *
 * The tab is opened synchronously so the click still counts as a user gesture;
 * popup blockers reject a `window.open` that happens after the fetch resolves.
 */
export async function openApiFileInNewTab(path: string) {
  const tab = window.open('', '_blank');

  try {
    const blob = await apiClient.getBlob(path);
    const objectUrl = URL.createObjectURL(blob);

    if (tab) {
      tab.location.href = objectUrl;
    } else {
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
