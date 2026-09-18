import { getEnv } from '@/lib/env/env';

const SCRIPT_ID = 'microsoft-clarity';

type ClarityWindow = Window & {
  clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
};

/**
 * Microsoft Clarity, only where a project id is configured. Without one nothing
 * is injected and no request leaves the browser — the same opt-in as error
 * reporting.
 *
 * Clarity records sessions, and the signed-in app shows registration numbers,
 * policy numbers and scanned documents. So the app shell carries
 * `data-clarity-mask`, masking everything inside it; what stays visible is the
 * public funnel — landing, sign-in, registration — where the drop-off question
 * lives. The project's own masking mode should be Strict as well.
 *
 * The standard snippet, minus the string-built script tag: a stub queues calls
 * until the tag loads.
 */
export function initClarity(projectId = getEnv().clarityProjectId) {
  if (!projectId || document.getElementById(SCRIPT_ID)) {
    return;
  }

  const target = window as ClarityWindow;
  target.clarity =
    target.clarity ??
    Object.assign(
      (...args: unknown[]) => {
        (target.clarity!.q = target.clarity!.q ?? []).push(args);
      },
      { q: [] as unknown[][] },
    );

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  document.head.appendChild(script);
}
