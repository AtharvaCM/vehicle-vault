import { bajajIndiaSnapshot } from './sources/bajaj-india.snapshot';
import { bydIndiaSnapshot } from './sources/byd-india.snapshot';
import { citroenIndiaSnapshot } from './sources/citroen-india.snapshot';
import { forceMotorsIndiaSnapshot } from './sources/force-motors-india.snapshot';
import type { CatalogImportSource } from './types';
import { heroIndiaSnapshot } from './sources/hero-india.snapshot';
import { hondaCarsIndiaSnapshot } from './sources/honda-cars-india.snapshot';
import { hondaIndiaSnapshot } from './sources/honda-india.snapshot';
import { hyundaiIndiaSnapshot } from './sources/hyundai-india.snapshot';
import { isuzuIndiaSnapshot } from './sources/isuzu-india.snapshot';
import { jeepIndiaSnapshot } from './sources/jeep-india.snapshot';
import { kiaIndiaSnapshot } from './sources/kia-india.snapshot';
import { mahindraIndiaSnapshot } from './sources/mahindra-india.snapshot';
import { marutiSuzukiIndiaSnapshot } from './sources/maruti-suzuki-india.snapshot';
import { mgIndiaSnapshot } from './sources/mg-india.snapshot';
import { nissanIndiaSnapshot } from './sources/nissan-india.snapshot';
import { renaultIndiaSnapshot } from './sources/renault-india.snapshot';
import { royalEnfieldIndiaSnapshot } from './sources/royal-enfield-india.snapshot';
import { skodaIndiaSnapshot } from './sources/skoda-india.snapshot';
import { tataIndiaSnapshot } from './sources/tata-india.snapshot';
import { toyotaIndiaSnapshot } from './sources/toyota-india.snapshot';
import { tvsIndiaSnapshot } from './sources/tvs-india.snapshot';
import { volkswagenIndiaSnapshot } from './sources/volkswagen-india.snapshot';
import { yamahaIndiaSnapshot } from './sources/yamaha-india.snapshot';

export const catalogImportSources = {
  'bajaj-india': bajajIndiaSnapshot,
  'byd-india': bydIndiaSnapshot,
  'citroen-india': citroenIndiaSnapshot,
  'force-motors-india': forceMotorsIndiaSnapshot,
  'hero-india': heroIndiaSnapshot,
  'honda-cars-india': hondaCarsIndiaSnapshot,
  'honda-india': hondaIndiaSnapshot,
  'hyundai-india': hyundaiIndiaSnapshot,
  'isuzu-india': isuzuIndiaSnapshot,
  'jeep-india': jeepIndiaSnapshot,
  'kia-india': kiaIndiaSnapshot,
  'mahindra-india': mahindraIndiaSnapshot,
  'maruti-suzuki-india': marutiSuzukiIndiaSnapshot,
  'mg-india': mgIndiaSnapshot,
  'nissan-india': nissanIndiaSnapshot,
  'renault-india': renaultIndiaSnapshot,
  'royal-enfield-india': royalEnfieldIndiaSnapshot,
  'skoda-india': skodaIndiaSnapshot,
  'tata-india': tataIndiaSnapshot,
  'toyota-india': toyotaIndiaSnapshot,
  'tvs-india': tvsIndiaSnapshot,
  'volkswagen-india': volkswagenIndiaSnapshot,
  'yamaha-india': yamahaIndiaSnapshot,
} as const satisfies Record<string, CatalogImportSource>;

export type CatalogImportSourceKey = keyof typeof catalogImportSources;
