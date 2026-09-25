import { BHARAT_REGISTRATION, STANDARD_REGISTRATION } from '@vehicle-vault/shared';

import { EMPTY } from './empty';

export type RegistrationParts = {
  /** `standard`: state · district · series · number. `bh`: year · BH · number · series. */
  kind: 'standard' | 'bh' | 'unknown';
  /** The groups in the order the plate prints them. */
  groups: string[];
};

/**
 * An Indian registration split into the groups a plate prints, whatever
 * spacing or case it was typed in: "mh12dm0002" and "MH-12-DM-0002" both give
 * MH · 12 · DM · 0002. Anything that is not a recognisable plate (a temporary
 * number, a foreign one) keeps what was typed, upper-cased with its spaces
 * tidied, as a single group.
 */
export function parseRegistration(value: string | null | undefined): RegistrationParts {
  const typed = (value ?? '').trim().toUpperCase();
  const compact = typed.replace(/[^A-Z0-9]/g, '');

  const bharat = BHARAT_REGISTRATION.exec(compact);
  if (bharat) return { kind: 'bh', groups: bharat.slice(1) };

  const standard = STANDARD_REGISTRATION.exec(compact);
  if (standard) return { kind: 'standard', groups: standard.slice(1).filter(Boolean) };

  const tidied = typed.replace(/\s+/g, ' ');
  return { kind: 'unknown', groups: tidied ? [tidied] : [] };
}

/** "MH 12 DM 0002", "22 BH 1234 AA": a registration as its plate prints it. "—" when there is none. */
export function registration(value: string | null | undefined) {
  const { groups } = parseRegistration(value);

  return groups.length ? groups.join(' ') : EMPTY;
}

/** The longest recognised plate, `[A-Z]{2}\d{2}[A-Z]{3}\d{4}`: nothing typed past it is kept. */
const MAX_COMPACT_LENGTH = 11;

/**
 * Live formatting for the plate input: upper-cased as it is typed, and
 * grouped the moment the characters typed so far spell out a complete Indian
 * registration — "mh12dm0002" becomes "MH 12 DM 0002" the instant the last
 * digit lands. Before that it is shown plain, with no forced spacing, so a
 * plate still being typed (or something the format will never recognise)
 * never gets grouped wrong partway through.
 */
export function formatRegistrationInput(raw: string): string {
  const compact = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_COMPACT_LENGTH);
  const { kind, groups } = parseRegistration(compact);

  return kind === 'unknown' ? compact : groups.join(' ');
}

/**
 * The registration as a screen reader should say it: each character on its
 * own, groups separated by a pause ("M H, 1 2, D M, 0 0 0 2"), the way a
 * plate is read out. Left as written, "MH" is read as a word and "0002" as
 * "two".
 */
export function spokenRegistration(value: string | null | undefined) {
  const { kind, groups } = parseRegistration(value);
  if (kind === 'unknown') return groups.join(' ');

  return groups.map((group) => group.split('').join(' ')).join(', ');
}
