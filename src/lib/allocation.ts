import {
  addDays,
  formatDate,
  isWeekend,
  parseDate,
} from "./dates";
import { TIME_OFF_PROJECT_ID } from "./types";

export interface DateRange {
  start: string;
  end: string;
}

export interface AssignmentSpan {
  start: string;
  end: string;
  projectId: string;
}

export interface WorkdayAllocation {
  /** Mon–Fri days in the window */
  workdayCount: number;
  /** Weekdays with ≥1 non–time-off assignment */
  workDays: number;
  /** Weekdays with no assignment at all */
  freeDays: number;
  /** Weekdays covered only by time off (or time off + nothing else) */
  leaveDays: number;
  /** Weekdays with ≥2 concurrent work assignments */
  overloadDays: number;
  /** Max concurrent work assignments on any weekday */
  peakLoad: number;
  /** workDays / workdayCount × 100 */
  allocPct: number;
  /** freeDays / workdayCount × 100 */
  freePct: number;
  /** overloadDays / workdayCount × 100 */
  overloadPct: number;
}

function eachDateInclusive(start: Date, end: Date, fn: (d: Date) => void) {
  let cursor = start;
  while (cursor <= end) {
    fn(cursor);
    cursor = addDays(cursor, 1);
  }
}

function clampRange(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): DateRange | null {
  const s = start > windowStart ? start : windowStart;
  const e = end < windowEnd ? end : windowEnd;
  if (s > e) return null;
  return { start: s, end: e };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Workday allocation inside [windowStart, windowEnd] (inclusive).
 * Weekends are ignored in the denominator and all counters.
 * Time off blocks availability but does not count toward alloc %.
 */
export function analyzeResourceAllocation(
  assignments: AssignmentSpan[],
  windowStart: string,
  windowEnd: string
): WorkdayAllocation {
  if (windowStart > windowEnd) {
    return {
      workdayCount: 0,
      workDays: 0,
      freeDays: 0,
      leaveDays: 0,
      overloadDays: 0,
      peakLoad: 0,
      allocPct: 0,
      freePct: 0,
      overloadPct: 0,
    };
  }

  const winS = parseDate(windowStart);
  const winE = parseDate(windowEnd);

  let workdayCount = 0;
  let workDays = 0;
  let freeDays = 0;
  let leaveDays = 0;
  let overloadDays = 0;
  let peakLoad = 0;

  eachDateInclusive(winS, winE, (d) => {
    if (isWeekend(d)) return;
    workdayCount++;
    const iso = formatDate(d);
    let work = 0;
    let leave = 0;
    for (const a of assignments) {
      if (a.start <= iso && a.end >= iso) {
        if (a.projectId === TIME_OFF_PROJECT_ID) leave++;
        else work++;
      }
    }
    peakLoad = Math.max(peakLoad, work);
    if (work >= 2) overloadDays++;
    if (work >= 1) workDays++;
    else if (leave >= 1) leaveDays++;
    else freeDays++;
  });

  return {
    workdayCount,
    workDays,
    freeDays,
    leaveDays,
    overloadDays,
    peakLoad,
    allocPct: pct(workDays, workdayCount),
    freePct: pct(freeDays, workdayCount),
    overloadPct: pct(overloadDays, workdayCount),
  };
}

/** Contiguous calendar spans with no assignment (work or leave) in the window. */
export function freeGapsInWindow(
  assignments: AssignmentSpan[],
  windowStart: string,
  windowEnd: string
): DateRange[] {
  if (windowStart > windowEnd) return [];
  const winS = parseDate(windowStart);
  const winE = parseDate(windowEnd);
  const gaps: DateRange[] = [];
  let gapStart: Date | null = null;

  eachDateInclusive(winS, winE, (d) => {
    const iso = formatDate(d);
    const covered = assignments.some((a) => a.start <= iso && a.end >= iso);
    if (!covered) {
      if (!gapStart) gapStart = d;
    } else if (gapStart) {
      gaps.push({
        start: formatDate(gapStart),
        end: formatDate(addDays(d, -1)),
      });
      gapStart = null;
    }
  });

  if (gapStart) {
    gaps.push({ start: formatDate(gapStart), end: formatDate(winE) });
  }

  return gaps;
}

/** Contiguous calendar spans where ≥2 work assignments overlap. */
export function overloadSpansInWindow(
  assignments: AssignmentSpan[],
  windowStart: string,
  windowEnd: string
): DateRange[] {
  if (windowStart > windowEnd) return [];
  const winS = parseDate(windowStart);
  const winE = parseDate(windowEnd);
  const spans: DateRange[] = [];
  let spanStart: Date | null = null;

  eachDateInclusive(winS, winE, (d) => {
    const iso = formatDate(d);
    let work = 0;
    for (const a of assignments) {
      if (
        a.projectId !== TIME_OFF_PROJECT_ID &&
        a.start <= iso &&
        a.end >= iso
      ) {
        work++;
      }
    }
    if (work >= 2) {
      if (!spanStart) spanStart = d;
    } else if (spanStart) {
      spans.push({
        start: formatDate(spanStart),
        end: formatDate(addDays(d, -1)),
      });
      spanStart = null;
    }
  });

  if (spanStart) {
    spans.push({ start: formatDate(spanStart), end: formatDate(winE) });
  }

  return spans;
}

export function clipRangeToWindow(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): DateRange | null {
  return clampRange(start, end, windowStart, windowEnd);
}

export function formatAllocPct(n: number): string {
  return `${n}%`;
}
