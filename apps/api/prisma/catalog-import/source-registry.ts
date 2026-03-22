import { bajajIndiaSnapshot } from './sources/bajaj-india.snapshot';
import type { CatalogImportSource } from './types';
import { hondaCarsIndiaSnapshot } from './sources/honda-cars-india.snapshot';
import { hyundaiIndiaSnapshot } from './sources/hyundai-india.snapshot';
import { kiaIndiaSnapshot } from './sources/kia-india.snapshot';
import { mahindraIndiaSnapshot } from './sources/mahindra-india.snapshot';
import { marutiSuzukiIndiaSnapshot } from './sources/maruti-suzuki-india.snapshot';
import { royalEnfieldIndiaSnapshot } from './sources/royal-enfield-india.snapshot';
import { tataIndiaSnapshot } from './sources/tata-india.snapshot';
import { toyotaIndiaSnapshot } from './sources/toyota-india.snapshot';
import { tvsIndiaSnapshot } from './sources/tvs-india.snapshot';

export const catalogImportSources = {
  'bajaj-india': bajajIndiaSnapshot,
  'honda-cars-india': hondaCarsIndiaSnapshot,
  'hyundai-india': hyundaiIndiaSnapshot,
  'kia-india': kiaIndiaSnapshot,
  'mahindra-india': mahindraIndiaSnapshot,
  'maruti-suzuki-india': marutiSuzukiIndiaSnapshot,
  'royal-enfield-india': royalEnfieldIndiaSnapshot,
  'tata-india': tataIndiaSnapshot,
  'toyota-india': toyotaIndiaSnapshot,
  'tvs-india': tvsIndiaSnapshot,
} as const satisfies Record<string, CatalogImportSource>;

export type CatalogImportSourceKey = keyof typeof catalogImportSources;
