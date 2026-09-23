import type { DehydratedState } from '@tanstack/react-query';

import { PRERENDER_STATE_ELEMENT_ID } from './prerendered-state';

const ROOT_ELEMENT = '<div id="root"></div>';

/**
 * The head tags `index.html` carries for the app as a whole. A prerendered page
 * replaces them with its own rather than carrying both.
 */
const APP_HEAD_TAGS = [
  /<title>[\s\S]*?<\/title>\s*/g,
  /<meta\s+name="(?:description|robots|twitter:[^"]+)"[^>]*>\s*/g,
  /<meta\s+property="og:[^"]+"[^>]*>\s*/g,
  /<link\s+rel="canonical"[^>]*>\s*/g,
];

export type DocumentParts = {
  headTags: string;
  appHtml: string;
  routerScript: string;
  queryState: DehydratedState;
};

/**
 * Pours one rendered page into the built `index.html`: its head tags in place
 * of the app's, its markup inside `#root`, and after it the data the browser
 * hydrates from. The template's own script and stylesheet tags stay as they
 * are, so the page boots the same bundle as every other route.
 */
export function composeDocument(template: string, parts: DocumentParts) {
  if (!template.includes(ROOT_ELEMENT) || !template.includes('</head>')) {
    throw new Error(`The build's index.html has no empty ${ROOT_ELEMENT} to render into.`);
  }

  let html = template;
  for (const pattern of APP_HEAD_TAGS) {
    html = html.replace(pattern, '');
  }

  return html
    .replace(/\s*<\/head>/, () => `\n    ${parts.headTags}\n  </head>`)
    .replace(
      ROOT_ELEMENT,
      () =>
        `<div id="root">${parts.appHtml}</div>\n` +
        `    <script type="application/json" id="${PRERENDER_STATE_ELEMENT_ID}">${serializeForScript(
          parts.queryState,
        )}</script>\n` +
        `    <script class="$tsr">${parts.routerScript}</script>`,
    );
}

/** JSON that cannot close its `<script>` element or break a JavaScript string. */
export function serializeForScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
