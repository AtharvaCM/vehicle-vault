import { Link } from '@tanstack/react-router';

import { PublicFrame } from '@/components/public/public-frame';
import { useDocumentTitle } from '@/hooks/use-document-title';

import type { LegalDocument } from '../content/legal-content';

/** /privacy and /terms: one readable column in the public frame, sections in order. */
export function LegalPage({ document: doc }: { document: LegalDocument }) {
  useDocumentTitle(`${doc.title} | Vehicle Vault`);

  return (
    <PublicFrame>
      <article
        className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12"
        data-testid="legal-page"
      >
        <header className="space-y-2">
          <h1 className="font-display text-title font-semibold tracking-tight text-fg sm:text-display">
            {doc.title}
          </h1>
          <p className="text-small text-fg-3">{doc.updated}</p>
          <p className="text-body leading-7 text-fg-2">{doc.intro}</p>
        </header>
        {doc.sections.map((section) => (
          <section className="space-y-3" key={section.heading}>
            <h2 className="text-lead font-semibold tracking-tight text-fg">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p className="text-body leading-7 text-fg-2" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="border-t border-line-subtle pt-6 text-ui text-fg-2">
          Questions?{' '}
          <Link
            className="font-semibold text-brand underline-offset-4 hover:underline"
            to="/contact"
          >
            Write to us
          </Link>
          .
        </p>
      </article>
    </PublicFrame>
  );
}
