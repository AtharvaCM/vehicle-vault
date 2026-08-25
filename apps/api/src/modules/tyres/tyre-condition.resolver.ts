import { Injectable } from '@nestjs/common';
import {
  TREAD_DEPTH_LEGAL_MM,
  TREAD_DEPTH_REPLACE_MM,
  TREAD_DEPTH_WARN_MM,
  TYRE_AGE_REPLACE_YEARS,
  TYRE_AGE_WARN_YEARS,
  type TyreCondition,
  type TyreConditionLevel,
  type TyrePosition,
} from '@vehicle-vault/shared';

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

/** Worst first. Used to pick the level that decides a vehicle-wide verdict. */
const LEVEL_RANK: Record<TyreConditionLevel, number> = {
  illegal: 0,
  replace: 1,
  warn: 2,
  unknown: 3,
  healthy: 4,
};

export interface TyreInspectionInput {
  inspectedAt: Date;
  odometer: number;
  treadDepthMm: number | null;
}

export interface TyreConditionInput {
  id: string;
  position: TyrePosition;
  dotWeek: number | null;
  dotYear: number | null;
  fittedOdometer: number;
  expectedLifeKm: number | null;
  /** Newest first. */
  inspections: TyreInspectionInput[];
}

/**
 * Turns measurements into a verdict.
 *
 * Tread depth and manufacture age are independent limits — a tyre can be legal
 * on tread and still unsafe on age, which is the case a distance-based service
 * schedule structurally cannot see. Whichever is worse decides.
 */
@Injectable()
export class TyreConditionResolver {
  resolve(tyre: TyreConditionInput, vehicleOdometer: number, now = new Date()): TyreCondition {
    const latest = tyre.inspections.at(0) ?? null;
    const treadDepthMm = latest?.treadDepthMm ?? null;
    const ageYears = this.ageInYears(tyre, now);
    const kmOnTyre = Math.max(0, vehicleOdometer - tyre.fittedOdometer);

    const tread = this.gradeTread(treadDepthMm);
    const age = this.gradeAge(ageYears);
    const level = LEVEL_RANK[tread.level] <= LEVEL_RANK[age.level] ? tread : age;

    return {
      tyreId: tyre.id,
      position: tyre.position,
      level: level.level,
      reason: level.reason,
      summary: level.summary,
      treadDepthMm,
      ageYears,
      kmOnTyre,
      estimatedKmRemaining: this.estimateRemaining(tyre, vehicleOdometer),
      lastInspectedAt: latest?.inspectedAt.toISOString() ?? null,
    };
  }

  /** The worst corner decides the vehicle. Four healthy tyres and one bald one is not "healthy". */
  worstLevel(conditions: TyreCondition[]): TyreConditionLevel {
    if (conditions.length === 0) return 'unknown';
    return conditions.reduce<TyreConditionLevel>(
      (worst, condition) =>
        LEVEL_RANK[condition.level] < LEVEL_RANK[worst] ? condition.level : worst,
      'healthy',
    );
  }

  private gradeTread(treadDepthMm: number | null) {
    if (treadDepthMm == null) {
      return {
        level: 'unknown' as const,
        reason: 'none' as const,
        summary: 'No tread depth recorded yet.',
      };
    }

    const mm = `${treadDepthMm.toFixed(1)} mm tread`;

    if (treadDepthMm < TREAD_DEPTH_LEGAL_MM) {
      return {
        level: 'illegal' as const,
        reason: 'tread' as const,
        summary: `${mm} — below the ${TREAD_DEPTH_LEGAL_MM} mm legal minimum. Not roadworthy.`,
      };
    }
    if (treadDepthMm < TREAD_DEPTH_REPLACE_MM) {
      return {
        level: 'replace' as const,
        reason: 'tread' as const,
        summary: `${mm} — wet grip is significantly reduced below ${TREAD_DEPTH_REPLACE_MM} mm.`,
      };
    }
    if (treadDepthMm < TREAD_DEPTH_WARN_MM) {
      return {
        level: 'warn' as const,
        reason: 'tread' as const,
        summary: `${mm} — plan a replacement in the next few thousand kilometres.`,
      };
    }
    return { level: 'healthy' as const, reason: 'none' as const, summary: `${mm} remaining.` };
  }

  private gradeAge(ageYears: number | null) {
    if (ageYears == null) {
      return {
        level: 'unknown' as const,
        reason: 'none' as const,
        summary: 'No DOT code recorded, so tyre age is unknown.',
      };
    }

    const years = `${ageYears.toFixed(1)} years old`;

    if (ageYears >= TYRE_AGE_REPLACE_YEARS) {
      return {
        level: 'replace' as const,
        reason: 'age' as const,
        summary: `${years} — rubber degrades with age regardless of tread left.`,
      };
    }
    if (ageYears >= TYRE_AGE_WARN_YEARS) {
      return {
        level: 'warn' as const,
        reason: 'age' as const,
        summary: `${years} — inspect for cracking; most makers advise replacing by ${TYRE_AGE_REPLACE_YEARS} years.`,
      };
    }
    return { level: 'healthy' as const, reason: 'none' as const, summary: `${years}.` };
  }

  /**
   * DOT week/year identifies the week the tyre was built. Week 1 is treated as
   * the start of the year, which is precise enough against a multi-year limit.
   */
  private ageInYears(tyre: TyreConditionInput, now: Date): number | null {
    if (tyre.dotWeek == null || tyre.dotYear == null) return null;

    const manufactured = new Date(Date.UTC(tyre.dotYear, 0, 1));
    manufactured.setUTCDate(manufactured.getUTCDate() + (tyre.dotWeek - 1) * 7);

    return Math.max(0, (now.getTime() - manufactured.getTime()) / MS_PER_YEAR);
  }

  /**
   * Projects remaining life from the observed wear rate between the oldest and
   * newest readings, which is far more honest than a fixed "tyres last 40 000
   * km" figure — it reflects this driver on these roads.
   *
   * Needs two readings that actually differ in both distance and depth.
   */
  private estimateRemaining(
    tyre: TyreConditionInput,
    vehicleOdometer: number,
  ): number | null {
    const measured = tyre.inspections.filter((i) => i.treadDepthMm != null);
    if (measured.length < 2) return this.estimateFromExpectedLife(tyre, vehicleOdometer);

    const newest = measured.at(0)!;
    const oldest = measured.at(-1)!;
    const kmElapsed = newest.odometer - oldest.odometer;
    const wornMm = oldest.treadDepthMm! - newest.treadDepthMm!;

    if (kmElapsed <= 0 || wornMm <= 0) {
      return this.estimateFromExpectedLife(tyre, vehicleOdometer);
    }

    const mmPerKm = wornMm / kmElapsed;
    const usableMm = newest.treadDepthMm! - TREAD_DEPTH_REPLACE_MM;
    if (usableMm <= 0) return 0;

    // Discount the distance driven since that last reading.
    const sinceReading = Math.max(0, vehicleOdometer - newest.odometer);
    return Math.max(0, Math.round(usableMm / mmPerKm - sinceReading));
  }

  private estimateFromExpectedLife(
    tyre: TyreConditionInput,
    vehicleOdometer: number,
  ): number | null {
    if (tyre.expectedLifeKm == null) return null;
    const used = Math.max(0, vehicleOdometer - tyre.fittedOdometer);
    return Math.max(0, tyre.expectedLifeKm - used);
  }
}
