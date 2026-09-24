/**
 * Lint rules that keep the design system (docs/design-language.md) from
 * eroding: each one reads the class strings in a file, wherever they sit
 * (className, cn(), cva(), a constant), and reports the first offending class.
 * Severity is set per path in design-system-paths.js.
 */

const PALETTE_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITIES =
  'bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|divide|from|via|to|fill|stroke|placeholder|decoration|accent|caret|shadow';

/** A class with its variants (`hover:`, `sm:`, `data-[state=open]:`) and `!` stripped. */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    else if (ch === ':' && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!|!$/g, '');
}

const PALETTE_CLASS = new RegExp(
  `^-?(?:${COLOR_UTILITIES})-(?:(?:${PALETTE_FAMILIES})-(?:50|[1-9]00|950)|white|black)(?:/\\S+)?$`,
);
const ARBITRARY_FONT_SIZE = /^text-\[(?:length:)?[\d.]+(?:px|rem|em)\]$/;

function classTokens(text) {
  return text.split(/\s+/).filter(Boolean);
}

/** Calls `check(tokens, node)` for every string literal and template chunk in the file. */
function forEachClassString(context, check) {
  return {
    Literal(node) {
      if (typeof node.value === 'string') check(classTokens(node.value), node);
    },
    TemplateElement(node) {
      check(classTokens(node.value.cooked ?? node.value.raw), node);
    },
  };
}

function tokenRule({ description, message, matches }) {
  return {
    meta: { type: 'suggestion', docs: { description }, schema: [], messages: { found: message } },
    create(context) {
      return forEachClassString(context, (tokens, node) => {
        const found = tokens.find((token) => matches(utilityOf(token)));
        if (found) context.report({ node, messageId: 'found', data: { className: found } });
      });
    },
  };
}

export const rules = {
  'no-palette-colors': tokenRule({
    description: 'Colours come from the semantic tokens, not the Tailwind palette.',
    message:
      '`{{className}}` is a palette colour. Use a semantic token (text-fg-2, bg-surface, border-line, text-late, …); see docs/design-language.md.',
    matches: (utility) => PALETTE_CLASS.test(utility),
  }),
  'no-arbitrary-font-size': tokenRule({
    description: 'Font sizes come from the type scale.',
    message:
      '`{{className}}` is an arbitrary font size. Use the scale: text-caption, text-small, text-body, text-lead, text-heading, text-title, text-display.',
    matches: (utility) => ARBITRARY_FONT_SIZE.test(utility),
  }),
  'no-transition-all': tokenRule({
    description: 'Transitions name what they animate.',
    message:
      '`{{className}}` animates every property, layout included. Use transition-colors or transition-opacity.',
    matches: (utility) => utility === 'transition-all',
  }),
  'no-micro-labels': tokenRule({
    description: 'No uppercase labels: sentence case everywhere.',
    message:
      '`{{className}}` sets text in capitals. The design language is sentence case: write the string that way (map data-driven words to labels); figures get their label from the Figure component.',
    matches: (utility) => utility === 'uppercase',
  }),
};

export default { meta: { name: 'vehicle-vault-design-system' }, rules };
