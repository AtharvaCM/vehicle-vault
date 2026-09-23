import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import { ArrowRight, BellRing, ScanLine, ShieldCheck, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

import protectionImage from '../assets/protection.webp';
import receiptImage from '../assets/receipt.webp';
import triageImage from '../assets/triage.webp';

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  image: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Each image is a real capture of the app against the demo seed, encoded to
 * WebP at 1400 px wide. Width and height are the files' own, so the browser
 * reserves the space before they load and nothing jumps.
 */
const FEATURES: Feature[] = [
  {
    icon: BellRing,
    title: 'Know what needs attention',
    body: 'Overdue renewals, today’s service and this week’s EMIs across every vehicle, most urgent first — one list to clear instead of dates to remember.',
    image: triageImage,
    width: 1400,
    height: 686,
    alt: 'The Needs attention list: an insurance renewal three days overdue, an oil change due today, a loan EMI due in two days, a wheel alignment check and an insurance policy expiring in five days.',
  },
  {
    icon: ScanLine,
    title: 'Scan a receipt, get a service record',
    body: 'Photograph a workshop invoice and the workshop, odometer, parts and GST land in a draft for you to check — no typing a job card in line by line.',
    image: receiptImage,
    width: 1400,
    height: 1134,
    alt: 'A scanned workshop invoice turned into a draft service record: workshop, invoice number, service date, 18,540 km, a ₹5,180 total at 94% confidence, and line items for labour, engine oil, two filters and GST.',
  },
  {
    icon: ShieldCheck,
    title: 'Every renewal in one place',
    body: 'Insurance, warranty, PUC and road tax with their dates, marked valid or expired at a glance, and a heads-up in the app before one runs out.',
    image: protectionImage,
    width: 1400,
    height: 1304,
    alt: 'The Protection tab: a manufacturer warranty marked expired, and a PUC certificate and road tax both marked valid, each with issue and expiry dates.',
  },
];

/**
 * The front door for anyone not signed in. Signed-in visitors never see it —
 * the index route sends them to the dashboard — so everything here is written
 * for a stranger deciding whether this is for them.
 */
export function LandingPage() {
  useDocumentTitle(`${APP_NAME} — service history, documents and reminders for your vehicle`);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
          {APP_NAME}
        </span>
        <Link
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
          to="/login"
        >
          Sign in
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-14">
          <p className="text-sm font-medium text-slate-600">For cars and two-wheelers in India</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            One record of your vehicle — its service history, its documents, and what’s due next.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Vehicle Vault keeps the servicing, insurance, PUC and upcoming work for every vehicle
            you own in one place, and tells you before something falls due.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/register">
                Create free account
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl space-y-16 px-4 pb-16 sm:space-y-24 sm:px-6 sm:pb-24"
        >
          <h2 className="sr-only" id="features-heading">
            What Vehicle Vault does
          </h2>
          {FEATURES.map((feature, index) => (
            <article
              className="grid items-center gap-6 lg:grid-cols-[2fr_3fr] lg:gap-12"
              key={feature.title}
            >
              <div className={index % 2 === 1 ? 'lg:order-2' : undefined}>
                <feature.icon aria-hidden="true" className="h-6 w-6 text-slate-700" />
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{feature.body}</p>
              </div>
              <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                <img
                  alt={feature.alt}
                  className="h-auto w-full"
                  decoding="async"
                  height={feature.height}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  src={feature.image}
                  width={feature.width}
                />
              </figure>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="catalog-heading"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950" id="catalog-heading">
            Look up a car or bike
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Its service schedule, a running-cost estimate and its specs, by make and model. No
            account needed.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline">
              <Link to="/cars">Browse cars</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/bikes">Browse bikes</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              Built for the daily commuter who wants reminders that just work, the enthusiast who
              tracks every part and rupee, and the family keeping several vehicles in order.
            </p>
            <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-950">
              Start with one vehicle.
            </h2>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Add your vehicle once, then log services and documents as they happen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/register">
                  Create free account
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600 sm:px-6">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
