import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Vitest runs from apps/web; `import.meta.url` is not a file URL under jsdom.
const SOURCE_ROOT = join(process.cwd(), 'src');

/** One `<input type="file" ... />` element, as written in a .tsx source. */
type FileInput = {
  file: string;
  attributes: string;
};

function tsxFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFilesUnder(path);
    return entry.isFile() && path.endsWith('.tsx') ? [path] : [];
  });
}

function fileInputs(): FileInput[] {
  const inputs: FileInput[] = [];

  for (const path of tsxFilesUnder(SOURCE_ROOT)) {
    const source = readFileSync(path, 'utf8');
    // Up to the self-closing `/>`, not the first `>`: an inline arrow handler
    // (`onChange={(event) => ...}`) contains one and would cut the match short,
    // hiding that input from every rule below.
    // `<Input>` too: the shadcn wrapper spreads its props onto a native input,
    // and one of these uploads is written with it.
    for (const match of source.matchAll(/<[Ii]nput\b([\s\S]*?)\/>/g)) {
      const attributes = match[1] ?? '';
      if (!attributes.includes('type="file"')) continue;
      inputs.push({ file: path.slice(SOURCE_ROOT.length + 1), attributes });
    }
  }

  return inputs;
}

function accepts(input: FileInput): string {
  return /accept="([^"]*)"/.exec(input.attributes)?.[1] ?? '';
}

const takesAPicture = (input: FileInput) => accepts(input).includes('image');

/**
 * Log service puts the camera and the file picker side by side (#293): its
 * "Choose file" is there to open the picker, for a photo already on the phone
 * (a WhatsApp forward) or a PDF invoice, beside "Snap the bill", which opens
 * the camera. It is the one image input meant to skip the camera.
 */
const choosesAFileBesideTheCamera = (input: FileInput) =>
  input.file === join('features', 'maintenance', 'components', 'bill-capture.tsx') &&
  input.attributes.includes('data-testid="bill-file-input"');
const takesASpreadsheet = (input: FileInput) => accepts(input) === '.csv';

/**
 * On a phone, an input that takes a picture of a physical thing — a job card, a
 * receipt, a policy, a loan document — should open the camera rather than the
 * file picker. `capture="environment"` is the whole mechanism, and it is a lone
 * attribute that a refactor can drop without anything failing, so the rule is
 * asserted over the sources rather than per component: an input added later is
 * covered too. Desktop browsers ignore `capture` and still open a file picker.
 */
describe('camera capture on file inputs', () => {
  const inputs = fileInputs();

  it('finds the file inputs to check', () => {
    // A regex over sources is only as good as its matches: if a refactor moves
    // these behind a shared component, this count drops and the rule needs a
    // new home rather than silently passing over nothing.
    expect(inputs.length).toBeGreaterThanOrEqual(8);
  });

  it('opens the camera for every input that takes an image', () => {
    const missing = inputs
      .filter(takesAPicture)
      .filter((input) => !choosesAFileBesideTheCamera(input))
      .filter((input) => !input.attributes.includes('capture="environment"'))
      .map((input) => input.file);

    expect(missing).toEqual([]);
  });

  it('leaves the CSV imports on the ordinary file picker', () => {
    const wrong = inputs
      .filter(takesASpreadsheet)
      .filter((input) => input.attributes.includes('capture'))
      .map((input) => input.file);

    expect(wrong).toEqual([]);
  });

  it('covers each upload the product asks for by name', () => {
    const withCapture = inputs
      .filter((input) => input.attributes.includes('capture="environment"'))
      .map((input) => input.file);

    expect(withCapture).toEqual(
      expect.arrayContaining([
        // Job cards and receipts on a maintenance record.
        join('features', 'attachments', 'components', 'attachment-upload-form.tsx'),
        join('features', 'maintenance', 'components', 'bill-capture.tsx'),
        // Vehicle documents.
        join('features', 'vehicles', 'components', 'protection-tab.tsx'),
        // Claim attachments.
        join('features', 'claims', 'components', 'claim-attachments-section.tsx'),
        // Loan documents.
        join('features', 'loans', 'components', 'loan-attachments-section.tsx'),
        join('features', 'loans', 'components', 'loans-section.tsx'),
      ]),
    );
  });
});
