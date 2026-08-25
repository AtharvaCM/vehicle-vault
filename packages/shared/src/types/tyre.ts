import type { z } from 'zod';

import type {
  TyreCreateSchema,
  TyreInspectionCreateSchema,
  TyreInspectionSchema,
  TyreSchema,
  TyreUpdateSchema,
} from '../schemas';
import type { TyrePosition } from '../enums/tyre-position.enum';

export type CreateTyreInput = z.infer<typeof TyreCreateSchema>;
export type UpdateTyreInput = z.infer<typeof TyreUpdateSchema>;
export type Tyre = z.infer<typeof TyreSchema>;
export type CreateTyreInspectionInput = z.infer<typeof TyreInspectionCreateSchema>;
export type TyreInspection = z.infer<typeof TyreInspectionSchema>;

/**
 * Legal minimum tread depth in India. Below this the vehicle is not roadworthy,
 * which is a different class of statement from "due for service".
 */
export const TREAD_DEPTH_LEGAL_MM = 1.6;

/**
 * Wet braking distance degrades sharply well before the legal limit, so this is
 * the depth at which a replacement should actually be planned.
 */
export const TREAD_DEPTH_REPLACE_MM = 3;

/** First warning, leaving room to budget for a set rather than react to one. */
export const TREAD_DEPTH_WARN_MM = 4;

/** Rubber compounds harden with age; most makers advise replacement by this point. */
export const TYRE_AGE_REPLACE_YEARS = 6;

/** Age at which a tyre should be inspected more closely even if tread looks fine. */
export const TYRE_AGE_WARN_YEARS = 5;

/**
 * Ordered worst-first. `illegal` is deliberately distinct from `replace`: one is
 * a roadworthiness statement, the other a maintenance recommendation.
 */
export type TyreConditionLevel = 'illegal' | 'replace' | 'warn' | 'healthy' | 'unknown';

/** Why a tyre reached its condition level, so the UI can explain rather than just colour. */
export type TyreConditionReason = 'tread' | 'age' | 'wear-rate' | 'none';

export interface TyreCondition {
  tyreId: string;
  position: TyrePosition;
  level: TyreConditionLevel;
  reason: TyreConditionReason;
  /** Human-readable justification, e.g. "1.4 mm tread — below the 1.6 mm legal limit". */
  summary: string;
  /** Most recent measured tread depth, null when never inspected. */
  treadDepthMm: number | null;
  /** Age in years derived from the DOT code, null when the code is unknown. */
  ageYears: number | null;
  /** Distance covered on this tyre since it was fitted. */
  kmOnTyre: number | null;
  /** Projected remaining life from the observed wear rate; null without two readings. */
  estimatedKmRemaining: number | null;
  lastInspectedAt: string | null;
}

/** Per-vehicle rollup: the worst corner decides the vehicle-level verdict. */
export interface VehicleTyreCondition {
  vehicleId: string;
  overall: TyreConditionLevel;
  tyres: TyreCondition[];
}
