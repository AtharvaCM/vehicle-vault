import { StrictMode, type ReactNode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { QueryClient, dehydrate, type DehydratedState, type QueryKey } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { attachRouterServerSsrUtils } from '@tanstack/react-router/ssr/server';

import { AppProviders } from '@/app/providers';
import { router as appRouter } from '@/app/router';

export type SeededQuery = {
  queryKey: QueryKey;
  data: unknown;
};

export type RenderedApp = {
  /** The markup that goes inside `<div id="root">`. */
  appHtml: string;
  /**
   * TanStack Router's hydration bootstrap: an inline script that leaves the
   * matched routes on `window.$_TSR` for `hydrate(router)` in the browser.
   */
  routerScript: string;
  /** The seeded query cache, for the browser to load before it hydrates. */
  queryState: DehydratedState;
};

/**
 * Renders the real app — the same providers and route tree `main.tsx` renders —
 * at `url`, with the query cache already holding what the page reads. Pages
 * fetch through TanStack Query, and a query never fetches during a server
 * render, so this makes no network calls: the caller supplies the data.
 *
 * Fails, rather than writing a broken page, if the URL does not match a route
 * cleanly or anything throws while rendering.
 */
export async function renderAppAtUrl(url: string, queries: SeededQuery[]): Promise<RenderedApp> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, query.data);
  }

  const router = createRouter({
    ...appRouter.options,
    history: createMemoryHistory({ initialEntries: [url] }),
    isServer: true,
    context: { ...appRouter.options.context, queryClient },
  });
  attachRouterServerSsrUtils({ router, manifest: undefined });
  const ssr = router.serverSsr!;

  try {
    await router.load();
    if (router.state.statusCode !== 200) {
      throw new Error(`${url} rendered with status ${router.state.statusCode}`);
    }
    const leaf = router.state.matches.at(-1);
    if (!leaf || leaf.status !== 'success' || leaf.globalNotFound) {
      throw new Error(`${url} did not match a page (${leaf?.status ?? 'no match'})`);
    }

    await ssr.dehydrate();
    if (!ssr.isSerializationFinished()) {
      await new Promise<void>((resolve) => ssr.onSerializationFinished(resolve));
    }

    const appHtml = await renderToHtml(
      <StrictMode>
        <AppProviders queryClient={queryClient} router={router} />
      </StrictMode>,
    );

    const routerScript = ssr.takeBufferedScripts()?.children ?? '';
    ssr.setRenderFinished();
    if (!routerScript) {
      throw new Error(`${url} produced no router hydration data`);
    }

    return {
      appHtml,
      routerScript,
      queryState: dehydrate(queryClient),
    };
  } finally {
    ssr.cleanup();
    queryClient.clear();
  }
}

/**
 * Waits for every lazy route chunk and Suspense boundary, so the markup is the
 * finished page rather than its loading fallbacks.
 */
async function renderToHtml(element: ReactNode) {
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(element, {
    // One inline document, no out-of-order boundaries patched in by script.
    progressiveChunkSize: Number.POSITIVE_INFINITY,
    onError(error) {
      errors.push(error);
    },
  });

  let html = '';
  for await (const chunk of prelude) {
    html += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  }

  if (errors.length > 0) {
    throw errors[0] instanceof Error ? errors[0] : new Error(String(errors[0]));
  }
  return html;
}
