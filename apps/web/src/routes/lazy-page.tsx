import { Suspense, lazy, type ComponentType, type JSX } from 'react';

import { LoadingState } from '@/components/shared/loading-state';

type LazyPageModule<P> = {
  default: ComponentType<P>;
};

type LazyPageImporter<P> = () => Promise<LazyPageModule<P>>;

type LazyPageOptions = {
  description?: string;
  title?: string;
};

export function createLazyPage<P extends Record<string, unknown>>(
  importer: LazyPageImporter<P>,
  options?: LazyPageOptions,
): (props: P) => JSX.Element {
  const LazyComponent = lazy(importer);
  const title = options?.title ?? 'Loading page';
  const description = options?.description ?? 'Preparing the next view.';

  function LazyPageComponent(props: P): JSX.Element {
    return (
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
            <LoadingState description={description} title={title} />
          </div>
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    );
  }

  return LazyPageComponent;
}
