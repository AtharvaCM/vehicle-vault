import { EMPTY } from './empty';

export type RegistrationParts = {
  /** `standard`: state · district · series · number. `bh`: year · BH · number · series. */
  kind: 'standard' | 'bh' | 'unknown';
  /** The groups in the order the plate prints them. */
  groups: string[];
};

// MH12DM0002, DL3CAB1234, KA01EV2024, and an older MH121234 with no series.
const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
// Bharat series: 22BH1234AA (year of registration, BH, number, series).
const BHARAT = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

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

  const bharat = BHARAT.exec(compact);
  if (bharat) return { kind: 'bh', groups: bharat.slice(1) };

  const standard = STANDARD.exec(compact);
  if (standard) return { kind: 'standard', groups: standard.slice(1).filter(Boolean) };

  const tidied = typed.replace(/\s+/g, ' ');
  return { kind: 'unknown', groups: tidied ? [tidied] : [] };
}

/** "MH 12 DM 0002", "22 BH 1234 AA": a registration as its plate prints it. "—" when there is none. */
export function registration(value: string | null | undefined) {
  const { groups } = parseRegistration(value);

  return groups.length ? groups.join(' ') : EMPTY;
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
