import { useEffect } from 'react';
import { APP_NAME } from '@vehicle-vault/shared';

import { headTagSpecs, type HeadTagSpec, type PublicPageHead } from './public-page-head';
import {
  serializeStructuredData,
  STRUCTURED_DATA_ELEMENT_ID,
  type JsonLd,
} from './structured-data';

const APP_DESCRIPTION =
  'One record of your car or two-wheeler: service history, insurance and PUC, and what’s due next — with a heads-up before anything lapses. Built for India.';
const APP_TITLE = `${APP_NAME} — service history, documents and reminders for your vehicle`;

/**
 * The head `index.html` ships for every other page. Leaving a catalog page puts
 * these back, since a prerendered entry page never had them in its HTML. A spec
 * checks they still match `index.html`.
 */
export const APP_DEFAULT_HEAD: { title: string; tags: HeadTagSpec[] } = {
  title: APP_TITLE,
  tags: [
    { kind: 'name', key: 'description', value: APP_DESCRIPTION },
    { kind: 'property', key: 'og:title', value: APP_TITLE },
    { kind: 'property', key: 'og:description', value: APP_DESCRIPTION },
    { kind: 'property', key: 'og:type', value: 'website' },
    { kind: 'property', key: 'og:image', value: '/web-app-manifest-512x512.png' },
    { kind: 'name', key: 'twitter:card', value: 'summary' },
    { kind: 'name', key: 'twitter:title', value: APP_TITLE },
    { kind: 'name', key: 'twitter:description', value: APP_DESCRIPTION },
    { kind: 'name', key: 'twitter:image', value: '/web-app-manifest-512x512.png' },
  ],
};

/**
 * Keeps `<head>` right for a public catalog page on the client: the prerendered
 * HTML already carries these tags, and this puts them in place after an SPA
 * navigation to the page, then back to the app's defaults when it goes.
 */
export function usePublicPageHead(head: PublicPageHead) {
  const { title, description, canonicalUrl, imageUrl, robots } = head;
  // Compared as text: the object is rebuilt on every render.
  const structuredData = head.structuredData ? serializeStructuredData(head.structuredData) : null;

  useEffect(() => {
    applyPublicPageHead(document, {
      title,
      description,
      canonicalUrl,
      imageUrl,
      robots,
      structuredData: structuredData ? (JSON.parse(structuredData) as JsonLd) : null,
    });
    return () => restoreAppDefaultHead(document);
  }, [title, description, canonicalUrl, imageUrl, robots, structuredData]);
}

export function applyPublicPageHead(doc: Document, head: PublicPageHead) {
  doc.title = head.title;
  for (const tag of headTagSpecs(head)) {
    upsertTag(doc, tag);
  }
  setStructuredData(doc, head.structuredData);
}

export function restoreAppDefaultHead(doc: Document) {
  doc.title = APP_DEFAULT_HEAD.title;
  setStructuredData(doc, null);
  const defaults = new Set(APP_DEFAULT_HEAD.tags.map((tag) => `${tag.kind}:${tag.key}`));
  for (const tag of headTagSpecs(emptyHead)) {
    if (!defaults.has(`${tag.kind}:${tag.key}`)) findTag(doc, tag)?.remove();
  }
  for (const tag of APP_DEFAULT_HEAD.tags) {
    upsertTag(doc, tag);
  }
}

const emptyHead: PublicPageHead = {
  title: '',
  description: '',
  canonicalUrl: '',
  imageUrl: '',
  robots: 'noindex',
  structuredData: null,
};

/** Puts the page's one JSON-LD script in place (the prerendered one included), or takes it out. */
function setStructuredData(doc: Document, data: JsonLd | null) {
  let script = doc.getElementById(STRUCTURED_DATA_ELEMENT_ID);
  if (!data) {
    script?.remove();
    return;
  }
  if (!script) {
    script = doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.id = STRUCTURED_DATA_ELEMENT_ID;
    doc.head.appendChild(script);
  }
  script.textContent = serializeStructuredData(data);
}

function findTag(doc: Document, tag: HeadTagSpec) {
  const selector =
    tag.kind === 'link' ? `link[rel="${tag.key}"]` : `meta[${tag.kind}="${tag.key}"]`;
  return doc.head.querySelector(selector);
}

function upsertTag(doc: Document, tag: HeadTagSpec) {
  let element = findTag(doc, tag);
  if (!element) {
    element = doc.createElement(tag.kind === 'link' ? 'link' : 'meta');
    element.setAttribute(tag.kind === 'link' ? 'rel' : tag.kind, tag.key);
    doc.head.appendChild(element);
  }
  element.setAttribute(tag.kind === 'link' ? 'href' : 'content', tag.value);
}
