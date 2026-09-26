import { createRoute } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const PrivacyPage = createLazyPage(
  () =>
    import('@/features/legal/pages/privacy-page').then((module) => ({
      default: module.PrivacyPage,
    })),
  { title: 'Loading privacy', description: 'Loading how Vehicle Vault handles your data.' },
);

const TermsPage = createLazyPage(
  () =>
    import('@/features/legal/pages/terms-page').then((module) => ({ default: module.TermsPage })),
  { title: 'Loading terms', description: 'Loading the terms of use.' },
);

const ContactPage = createLazyPage(
  () =>
    import('@/features/legal/pages/contact-page').then((module) => ({
      default: module.ContactPage,
    })),
  { title: 'Loading contact', description: 'Loading the contact form.' },
);

/** Public for everyone, signed in or not (#341). */
export const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'privacy',
  component: PrivacyPage,
});

export const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'terms',
  component: TermsPage,
});

export const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'contact',
  component: ContactPage,
});
