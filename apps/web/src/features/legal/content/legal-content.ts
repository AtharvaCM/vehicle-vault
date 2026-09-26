/**
 * The words on /privacy and /terms (#341): drafted to match what the app
 * actually stores and does, for the owner to approve before they go live.
 * Change a page here; the layout reads it as it is.
 */
export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDocument = {
  title: string;
  /** Shown under the title. */
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy',
  updated: 'Last updated 26 September 2026',
  intro:
    'Vehicle Vault keeps your vehicles’ service history, reminders and papers in one place. This page says what we collect to do that, where it goes, and what you can do about it. We don’t sell your data and we don’t show ads.',
  sections: [
    {
      heading: 'What we collect',
      paragraphs: [
        'Your account: your name and email address, and either a password (stored only as a one-way hash we can’t read) or the name, email and account id Google shares when you sign in with Google.',
        'What you add: your vehicles and their registration numbers, odometer readings, service records and costs, fuel fills, reminders, insurance and other papers (with their numbers and dates), loans, tyres and accessories.',
        'Files you upload: bills, photos and PDFs you attach to a record or a paper.',
        'Security records: an activity log of changes and sign-ins, with the device, browser and approximate location of each sign-in, so you can spot one that wasn’t you.',
        'If you turn on push alerts, the browser’s push subscription for that device.',
      ],
    },
    {
      heading: 'Analytics and error reports',
      paragraphs: [
        'We use Microsoft Clarity to see how visitors use the public pages (the home page, sign-in and the car and bike catalog), including session recordings. Everything inside your signed-in garage is masked from those recordings, so your vehicles, registration numbers and papers are not captured. Clarity sets its own cookies.',
        'When error reporting is on, a crash sends technical details (the page, the error, the browser) to help us fix it, not the contents of your records.',
      ],
    },
    {
      heading: 'Reading your bills',
      paragraphs: [
        'When you choose to scan a bill, receipt or paper, the file is sent to Google’s Gemini service to read its details (date, amount, workshop, policy number and so on) and fill in the form for you to check. Nothing is saved from a scan until you save it.',
      ],
    },
    {
      heading: 'Where it is kept',
      paragraphs: [
        'Your records are kept in a database on servers we run. Uploaded files are kept in Supabase storage. The web app is served by Vercel, and traffic passes through Cloudflare. These providers handle the data only to run the service for us.',
      ],
    },
    {
      heading: 'Who sees it',
      paragraphs: [
        'Only you, and anyone you share a vehicle with: they see that vehicle, as a viewer or an editor, until you remove them.',
        'We don’t sell or rent your data, and we don’t share it with advertisers. We would disclose it only where the law requires it.',
      ],
    },
    {
      heading: 'Emails and alerts',
      paragraphs: [
        'We email you to verify your address, to reset your password, when someone shares a vehicle with you, and, if you ask for them, reminder alerts. You choose which alerts you get in Settings → Notifications.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can download everything you’ve added as a JSON file at any time (Settings → Download your data).',
        'You can delete your account from Settings. It goes at once, with your vehicles, records and files; the activity log keeps no name or email once you’ve gone.',
        'Your sign-in is kept in your browser’s storage. Signing out clears it.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: ['Vehicle Vault is meant for adults. Please don’t use it if you are under 18.'],
    },
    {
      heading: 'Changes and questions',
      paragraphs: [
        'If this page changes in a way that matters, we’ll say so in the app before it takes effect. Questions, or a request about your data: write to us from the Contact page.',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms',
  updated: 'Last updated 26 September 2026',
  intro:
    'These terms cover your use of Vehicle Vault. By creating an account you agree to them. They are written to be read; if something is unclear, ask us from the Contact page.',
  sections: [
    {
      heading: 'Your account',
      paragraphs: [
        'Keep your password to yourself and tell us if you think someone else has used your account. You’re responsible for what happens in it, including what people you share a vehicle with do as editors.',
      ],
    },
    {
      heading: 'Your records are yours',
      paragraphs: [
        'You own what you add. You let us store it, back it up and process it to run the service for you, and nothing else. You can download it or delete it at any time.',
        'Only add what you have the right to add, and nothing unlawful.',
      ],
    },
    {
      heading: 'What the app tells you',
      paragraphs: [
        'Service intervals, reminders, running-cost estimates, fuel economy and catalog specifications are there to help, not to replace your owner’s manual, your insurer or your workshop. They can be wrong or out of date. Check anything that matters, especially a renewal date or a safety-related service.',
        'A reminder that doesn’t reach you (a blocked email, a phone with push turned off) isn’t a guarantee we can make. Keep your own note of dates the law cares about.',
      ],
    },
    {
      heading: 'Fair use',
      paragraphs: [
        'Don’t try to break, overload or get around the service’s limits, don’t scrape it, and don’t use it to reach other people’s data. We may suspend an account that does.',
      ],
    },
    {
      heading: 'The service itself',
      paragraphs: [
        'Vehicle Vault is free to use today. It is provided as it is, and we can’t promise it will always be available or free of mistakes. We may change or stop parts of it; if we ever stop the whole service, we’ll give notice and time to download your data.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'As far as the law allows, we aren’t liable for indirect losses, or for losses from relying on an estimate, a reminder or catalog data. Nothing here limits a liability the law doesn’t let us limit.',
      ],
    },
    {
      heading: 'Ending',
      paragraphs: [
        'You can stop using Vehicle Vault and delete your account whenever you like. We may close an account that breaks these terms, and will tell you why.',
      ],
    },
    {
      heading: 'Law and changes',
      paragraphs: [
        'These terms are governed by the laws of India. If they change in a way that matters, we’ll say so in the app before the change takes effect.',
      ],
    },
  ],
};
