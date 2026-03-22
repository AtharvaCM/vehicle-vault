import type { CatalogImportSource } from './types';
import { hondaCarsIndiaSnapshot } from './sources/honda-cars-india.snapshot';
import { hyundaiIndiaSnapshot } from './sources/hyundai-india.snapshot';
import { mahindraIndiaSnapshot } from './sources/mahindra-india.snapshot';
import { marutiSuzukiIndiaSnapshot } from './sources/maruti-suzuki-india.snapshot';
import { royalEnfieldIndiaSnapshot } from './sources/royal-enfield-india.snapshot';
import { tataIndiaSnapshot } from './sources/tata-india.snapshot';

export const catalogImportSources = {
  'honda-cars-india': hondaCarsIndiaSnapshot,
  'hyundai-india': hyundaiIndiaSnapshot,
  'mahindra-india': mahindraIndiaSnapshot,
  'maruti-suzuki-india': marutiSuzukiIndiaSnapshot,
  'royal-enfield-india': royalEnfieldIndiaSnapshot,
  'tata-india': tataIndiaSnapshot,
} as const satisfies Record<string, CatalogImportSource>;

export type CatalogImportSourceKey = keyof typeof catalogImportSources;
