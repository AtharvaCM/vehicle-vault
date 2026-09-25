import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import { ArrowRight, Check } from 'lucide-react';

import { PublicFrame } from '@/components/public/public-frame';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

import papersImage from '../assets/papers.webp';
import receiptImage from '../assets/receipt.webp';
import triageImage from '../assets/triage.webp';
import { AttentionPreview } from '../components/attention-preview';
import { FindYourVehicle } from '../components/find-your-vehicle';

type Feature = {
  title: string;
  body: string;
  image: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Each image is a phone-width crop of the app (390 px at 2×) against seeded
 * data, encoded to WebP. Width and height are the files' own, so the browser
 * reserves the space before they load and nothing jumps.
 */
const FEATURES: Feature[] = [
  {
    title: 'Know what needs attention',
    body: 'Overdue renewals, today’s service and this week’s EMIs across every vehicle, most urgent first: one list to clear instead of dates to remember.',
    image: triageImage,
    width: 780,
    height: 1040,
    alt: 'Home’s Needs attention list: an insurance policy three days late, an oil change due today and a loan EMI due in two days.',
  },
  {
    title: 'Scan a receipt, get a service record',
    body: 'Photograph a workshop bill and the workshop, date, odometer and total land in the form for you to check, with the photo kept as the receipt.',
    image: receiptImage,
    width: 780,
    height: 1040,
    alt: 'A service form filled in from a photographed bill: date, odometer and a ₹5,180 total, each marked from bill.',
  },
  {
    title: 'Every paper, ready to show',
    body: 'Insurance, PUC and road tax with their dates and a photo of each, marked valid or late, and kept on your phone to show at a checkpoint, even offline.',
    image: papersImage,
    width: 780,
    height: 1040,
    alt: 'Show papers for a Hyundai Creta: the insurance policy marked valid until May 2027, with tabs for PUC and road tax.',
  },
];

const TRUST = ['Free', 'Private documents', 'Share with family'] as const;

const PERSONAS = [
  {
    title: 'For the commuter',
    body: 'A heads-up before the PUC or insurance lapses, and nothing to remember in between.',
  },
  {
    title: 'For the enthusiast',
    body: 'Every part, rupee and kilometre logged, with fuel economy and running cost worked out.',
  },
  {
    title: 'For the family',
    body: 'Every vehicle in one garage, shared with the people who drive them, view-only or with edit.',
  },
] as const;

/**
 * The front door for anyone not signed in (#342). Signed-in visitors never see
 * it (the index route sends them to Home), so everything here is written for a
 * stranger deciding whether this is for them. Sign in lives in the header only.
 */
export function LandingPage() {
  useDocumentTitle(`${APP_NAME}: service history, documents and reminders for your vehicle`);

  return (
    <PublicFrame width="wide">
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:pb-16">
          <div>
            <p className="text-ui font-medium text-fg-2">For cars and two-wheelers in India</p>
            <h1 className="mt-3 font-display text-title font-semibold tracking-tight text-fg sm:text-display">
              Every service, document and renewal for your vehicle, in one place.
            </h1>
            <p className="mt-4 max-w-xl text-lead text-fg-2">
              A heads-up before the PUC, insurance or an EMI falls due, and the whole service
              history when you need it.
            </p>
            <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild className="w-full sm:w-auto" size="lg">
                <Link to="/register">
                  Create free account
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <a
                className="inline-flex items-center gap-1.5 text-ui font-semibold text-fg hover:text-fg-2"
                href="#find-your-vehicle"
              >
                Browse cars & bikes
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </div>
            <ul aria-label="Why Vehicle Vault" className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
              {TRUST.map((item) => (
                <li className="inline-flex items-center gap-1.5 text-ui text-fg-2" key={item}>
                  <Check aria-hidden="true" className="size-4 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <AttentionPreview />
        </section>

        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <FindYourVehicle />
        </div>

        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl space-y-16 px-4 pb-16 sm:space-y-24 sm:px-6 sm:pb-24"
        >
          <h2 className="sr-only" id="features-heading">
            What Vehicle Vault does
          </h2>
          {FEATURES.map((feature, index) => (
            <article
              className="grid items-start gap-6 md:grid-cols-2 md:items-center md:gap-12"
              data-testid="landing-feature"
              key={feature.title}
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <h3 className="font-display text-heading font-semibold tracking-tight text-fg">
                  {feature.title}
                </h3>
                <p className="mt-3 text-lead text-fg-2">{feature.body}</p>
              </div>
              <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface shadow-sm">
                <img
                  alt={feature.alt}
                  className="h-auto w-full"
                  decoding="async"
                  height={feature.height}
                  loading="lazy"
                  src={feature.image}
                  width={feature.width}
                />
              </figure>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="personas-heading"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <h2
            className="font-display text-title font-semibold tracking-tight text-fg"
            id="personas-heading"
          >
            Built for how you use your vehicle
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {PERSONAS.map((persona) => (
              <li className="rounded-card border border-line bg-surface p-5" key={persona.title}>
                <h3 className="font-semibold text-fg">{persona.title}</h3>
                <p className="mt-2 text-ui text-fg-2">{persona.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="font-display text-title font-semibold tracking-tight text-fg">
              Start with one vehicle.
            </h2>
            <p className="mt-2 text-lead text-fg-2">
              Add it once, then log services and papers as they happen.
            </p>
            <Button asChild className="mt-6 w-full sm:w-auto" size="lg">
              <Link to="/register">
                Create free account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </PublicFrame>
  );
}
