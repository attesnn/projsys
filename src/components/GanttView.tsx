"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatDate,
  formatDayHeaderLabel,
  formatDayLabel,
  formatMonthYearLabel,
  formatWeekLabel,
  isWeekend,
  parseDate,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "@/lib/dates";
import { setGanttScale } from "@/lib/store";
import {
  GANTT_SCALES,
  TIME_OFF_PROJECT_ID,
  type GanttScale,
} from "@/lib/types";
import styles from "./GanttView.module.css";

const MIN_CONTENT_WIDTH = 320;

/** Full scrubbable timeline domain relative to today (matches ~seed horizon). */
const DOMAIN_PAST_DAYS = 60;
const DOMAIN_FUTURE_DAYS = 400;

/** Visible window length in days (rolling; year uses 12 calendar months instead). */
const WINDOW_DAYS: Record<Exclude<GanttScale, "year">, number> = {
  week: 7,
  month: 30,
  quarter: 91, // ~13 weeks
};

/** ←/→ step ≈ one tenth of the visible period. */
const NAV_STEP_DAYS: Record<Exclude<GanttScale, "year">, number> = {
  week: 1,
  month: 3,
  quarter: 9,
};

const SCALE_LABELS: Record<GanttScale, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

type ColumnWeekend = "none" | "full" | "bands";

interface TimelineColumn {
  key: string;
  start: Date;
  days: number;
  label: string;
  weekend: ColumnWeekend;
}

function domainBounds(today = new Date()) {
  const noon = new Date(today);
  noon.setHours(12, 0, 0, 0);
  return {
    domainStart: addDays(noon, -DOMAIN_PAST_DAYS),
    domainEnd: addDays(noon, DOMAIN_FUTURE_DAYS),
  };
}

function alignRangeStart(scale: GanttScale, d: Date): Date {
  switch (scale) {
    case "week":
      return startOfWeek(d);
    case "month":
      return startOfMonth(d);
    case "quarter":
      return startOfQuarter(d);
    case "year":
      return startOfYear(d);
  }
}

function rangeEndInclusive(scale: GanttScale, rangeStart: Date): Date {
  if (scale === "year") {
    return endOfMonth(addMonths(startOfMonth(rangeStart), 11));
  }
  return addDays(rangeStart, WINDOW_DAYS[scale] - 1);
}

function clampRangeStart(
  scale: GanttScale,
  candidate: Date,
  domainStart: Date,
  domainEnd: Date
): Date {
  const spanEnd = rangeEndInclusive(scale, candidate);
  const spanDays = daysBetween(candidate, spanEnd) + 1;
  const latestStart = addDays(domainEnd, -(spanDays - 1));
  if (candidate < domainStart) return domainStart;
  if (candidate > latestStart) return latestStart;
  return candidate;
}

function buildColumns(scale: GanttScale, rangeStart: Date, rangeEnd: Date): TimelineColumn[] {
  if (scale === "week" || scale === "month") {
    const cols: TimelineColumn[] = [];
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      cols.push({
        key: cursor.toISOString(),
        start: cursor,
        days: 1,
        label: scale === "week" ? formatDayHeaderLabel(cursor) : formatDayLabel(cursor),
        weekend: isWeekend(cursor) ? "full" : "none",
      });
      cursor = addDays(cursor, 1);
    }
    return cols;
  }

  if (scale === "quarter") {
    const cols: TimelineColumn[] = [];
    let weekStart = startOfWeek(rangeStart);
    while (weekStart <= rangeEnd) {
      const weekEnd = addDays(weekStart, 6);
      const colStart = weekStart < rangeStart ? rangeStart : weekStart;
      const colEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;
      const days = daysBetween(colStart, colEnd) + 1;
      if (days > 0) {
        cols.push({
          key: weekStart.toISOString(),
          start: colStart,
          days,
          label: formatWeekLabel(weekStart),
          weekend: "bands",
        });
      }
      weekStart = addDays(weekStart, 7);
    }
    return cols;
  }

  // year: 12 month columns from rangeStart's month (may span two calendar years)
  const cols: TimelineColumn[] = [];
  const month0 = startOfMonth(rangeStart);
  for (let m = 0; m < 12; m++) {
    const monthStart = addMonths(month0, m);
    const monthEnd = endOfMonth(monthStart);
    cols.push({
      key: monthStart.toISOString(),
      start: monthStart,
      days: daysBetween(monthStart, monthEnd) + 1,
      label: formatMonthYearLabel(monthStart),
      weekend: "none",
    });
  }
  return cols;
}

function shiftRange(scale: GanttScale, rangeStart: Date, direction: -1 | 1): Date {
  if (scale === "year") {
    return startOfMonth(addMonths(rangeStart, direction * 2));
  }
  return addDays(rangeStart, direction * NAV_STEP_DAYS[scale]);
}

export interface GanttBar {
  id: string;
  start: string;
  end: string;
  label?: string;
  sublabel?: string;
  color?: string;
  milestone?: boolean;
  /** Free / open capacity marker (not an assignment) */
  kind?: "assignment" | "gap" | "overload";
}

export interface GanttRow {
  id: string;
  start?: string;
  end?: string;
  label?: string;
  sublabel?: string;
  color?: string;
  /** Single-day marker (optional) */
  milestone?: boolean;
  /** Stronger bar for project rollup */
  emphasis?: boolean;
  /** Multiple bars on one row (e.g. resource with several allocations) */
  bars?: GanttBar[];
}

interface GanttViewProps {
  rows: GanttRow[];
  bodyRef: RefObject<HTMLDivElement | null>;
  onBodyScroll: () => void;
  title?: string;
  /** Hide the top toolbar (when parent already has one spanning both panes) */
  hideToolbar?: boolean;
  /** Click an allocation/task bar (bar.id). Conflict/rollup bars may also fire. */
  onBarClick?: (
    barId: string,
    anchor: { top: number; left: number } | null
  ) => void;
  selectedBarId?: string | null;
  /** Fires when the visible timeline window changes (scale, nav, scrollbar). */
  onRangeChange?: (range: { start: string; end: string }) => void;
}

export function GanttView({
  rows,
  bodyRef,
  onBodyScroll,
  title = "Timeline",
  hideToolbar = false,
  onBarClick,
  selectedBarId,
  onRangeChange,
}: GanttViewProps) {
  const { data, setData } = useStore();
  const scale = data.ui.ganttScale;
  const headerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const syncingHScroll = useRef(false);
  const [contentWidth, setContentWidth] = useState(MIN_CONTENT_WIDTH);
  const { domainStart, domainEnd } = useMemo(() => domainBounds(), []);
  const [rangeStart, setRangeStart] = useState(() =>
    clampRangeStart(
      scale,
      alignRangeStart(scale, new Date()),
      domainBounds().domainStart,
      domainBounds().domainEnd
    )
  );

  function moveTo(next: Date) {
    setRangeStart(clampRangeStart(scale, next, domainStart, domainEnd));
  }

  useEffect(() => {
    setRangeStart((prev) =>
      clampRangeStart(scale, alignRangeStart(scale, prev), domainStart, domainEnd)
    );
  }, [scale, domainStart, domainEnd]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(MIN_CONTENT_WIDTH, Math.floor(el.clientWidth));
      setContentWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rangeEnd = useMemo(
    () => rangeEndInclusive(scale, rangeStart),
    [scale, rangeStart]
  );

  useEffect(() => {
    onRangeChange?.({
      start: formatDate(rangeStart),
      end: formatDate(rangeEnd),
    });
  }, [rangeStart, rangeEnd, onRangeChange]);

  const spanDays = useMemo(
    () => Math.max(1, daysBetween(rangeStart, rangeEnd) + 1),
    [rangeStart, rangeEnd]
  );

  const columns = useMemo(
    () => buildColumns(scale, rangeStart, rangeEnd),
    [scale, rangeStart, rangeEnd]
  );

  const domainDays = daysBetween(domainStart, domainEnd) + 1;
  const sliderMax = Math.max(0, domainDays - spanDays);
  const sliderValue = Math.min(
    sliderMax,
    Math.max(0, daysBetween(domainStart, rangeStart))
  );

  /** Inner width so the native thumb ≈ visible window / domain. */
  const hScrollInnerWidth =
    sliderMax > 0
      ? Math.max(
          contentWidth + 1,
          Math.round(contentWidth * (domainDays / spanDays))
        )
      : contentWidth;

  useEffect(() => {
    const el = hScrollRef.current;
    if (!el || sliderMax <= 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const target = (sliderValue / sliderMax) * maxScroll;
    if (Math.abs(el.scrollLeft - target) <= 1) return;
    syncingHScroll.current = true;
    el.scrollLeft = target;
    requestAnimationFrame(() => {
      syncingHScroll.current = false;
    });
  }, [sliderValue, sliderMax, hScrollInnerWidth, scale]);

  function handleHScroll() {
    const el = hScrollRef.current;
    if (!el || syncingHScroll.current || sliderMax <= 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const offset = Math.round((el.scrollLeft / maxScroll) * sliderMax);
    const next = addDays(domainStart, offset);
    moveTo(scale === "year" ? startOfMonth(next) : next);
  }

  const totalWidth = contentWidth;
  const pxPerDay = totalWidth / spanDays;

  function barStyle(start: string, end: string, milestone?: boolean) {
    const s = parseDate(start);
    const e = parseDate(end);
    const leftDays = daysBetween(rangeStart, s);
    const duration = milestone ? 1 : Math.max(1, daysBetween(s, e) + 1);
    const left = leftDays * pxPerDay;
    const width = milestone ? 10 : duration * pxPerDay;

    if (e < rangeStart || s > rangeEnd) {
      return { display: "none" as const };
    }

    const clampedLeft = Math.max(0, left);
    const overflowLeft = Math.min(0, left);
    const clampedWidth = Math.max(
      milestone ? 8 : 4,
      Math.min(totalWidth - clampedLeft, width + overflowLeft)
    );

    return {
      left: `${clampedLeft}px`,
      width: `${clampedWidth}px`,
    };
  }

  function handleBodyScroll() {
    if (bodyRef.current && headerRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    onBodyScroll();
  }

  function renderWeekendBands(col: TimelineColumn) {
    if (col.weekend === "bands" && col.days === 7) {
      return (
        <>
          <span className={`${styles.weekendBand} ${styles.weekendSat}`} />
          <span className={`${styles.weekendBand} ${styles.weekendSun}`} />
        </>
      );
    }
    return null;
  }

  const scaleControl = (
    <div className={styles.scale} role="group" aria-label="Timeline scale">
      {GANTT_SCALES.map((s) => (
        <button
          key={s}
          type="button"
          className={`${styles.scaleBtn} ${scale === s ? styles.scaleBtnActive : ""}`}
          onClick={() => setData((prev) => setGanttScale(prev, s))}
        >
          {SCALE_LABELS[s]}
        </button>
      ))}
    </div>
  );

  const nav = (
    <div className={styles.nav}>
      {scaleControl}
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => moveTo(shiftRange(scale, rangeStart, -1))}
      >
        ←
      </button>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => moveTo(alignRangeStart(scale, new Date()))}
      >
        Today
      </button>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => moveTo(shiftRange(scale, rangeStart, 1))}
      >
        →
      </button>
    </div>
  );

  return (
    <div className={styles.root} ref={measureRef}>
      {!hideToolbar && (
        <div className={styles.toolbar}>
          <span className={styles.label}>{title}</span>
          {nav}
        </div>
      )}
      {hideToolbar && <div className={styles.toolbarNavOnly}>{nav}</div>}

      <div className={styles.headerScroll} ref={headerRef}>
        <div className={styles.weekRow} style={{ width: totalWidth }}>
          {columns.map((col) => (
            <div
              key={col.key}
              className={`${styles.week} ${col.weekend === "full" ? styles.weekendCol : ""}`}
              style={{
                width: col.days * pxPerDay,
                minWidth: col.days * pxPerDay,
              }}
            >
              {renderWeekendBands(col)}
              <span className={styles.weekLabel}>{col.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.body} ref={bodyRef} onScroll={handleBodyScroll}>
        <div style={{ width: totalWidth, minWidth: totalWidth }}>
          {rows.map((row) => {
            const segments: GanttBar[] =
              row.bars && row.bars.length > 0
                ? row.bars
                : row.start
                  ? [
                      {
                        id: row.id,
                        start: row.start,
                        end: row.end ?? row.start,
                        label: row.label,
                        sublabel: row.sublabel,
                        color: row.color,
                        milestone: row.milestone,
                      },
                    ]
                  : [];

            return (
              <div
                key={row.id}
                className={`${styles.row} ${row.emphasis ? styles.emphasisRow : ""}`}
              >
                <div className={styles.gridLines}>
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className={`${styles.gridCol} ${col.weekend === "full" ? styles.weekendCol : ""}`}
                      style={{
                        width: col.days * pxPerDay,
                        minWidth: col.days * pxPerDay,
                      }}
                    >
                      {renderWeekendBands(col)}
                    </div>
                  ))}
                </div>
                {segments.map((bar) => {
                  const style = barStyle(bar.start, bar.end, bar.milestone);
                  const isMeta = bar.kind === "gap" || bar.kind === "overload";
                  const clickable = Boolean(onBarClick) && !isMeta;
                  const selected = selectedBarId === bar.id;
                  const kindClass =
                    bar.kind === "gap"
                      ? styles.gapBar
                      : bar.kind === "overload"
                        ? styles.overloadBar
                        : "";
                  return (
                    <div
                      key={bar.id}
                      className={`${styles.bar} ${bar.milestone ? styles.milestone : ""} ${row.emphasis ? styles.emphasisBar : ""} ${clickable ? styles.clickable : ""} ${selected ? styles.selected : ""} ${kindClass}`}
                      style={{
                        ...style,
                        ...(isMeta
                          ? {}
                          : {
                              background:
                                bar.color ?? row.color ?? "var(--bar-1)",
                            }),
                      }}
                      title={`${bar.label ?? row.label ?? ""}${bar.start ? ` · ${bar.start}` : ""}${!bar.milestone ? ` → ${bar.end}` : ""}${bar.sublabel ? ` · ${bar.sublabel}` : ""}${clickable ? " · click to edit" : ""}`}
                      onClick={
                        clickable
                          ? (e) => {
                              e.stopPropagation();
                              onBarClick?.(bar.id, {
                                top: e.clientY,
                                left: e.clientX,
                              });
                            }
                          : undefined
                      }
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onBarClick?.(bar.id, null);
                              }
                            }
                          : undefined
                      }
                    >
                      {!bar.milestone && (
                        <span className={styles.barLabel}>
                          {bar.label ?? row.label}
                          {bar.sublabel && (
                            <span className={styles.pct}>{bar.sublabel}</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className={styles.empty}>No timeline data</div>
          )}
        </div>
      </div>

      <div
        className={styles.hScrollBar}
        ref={hScrollRef}
        onScroll={handleHScroll}
        title={`${formatDate(rangeStart)} → ${formatDate(rangeEnd)}`}
        aria-label="Timeline horizontal scroll"
        role="scrollbar"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={sliderMax}
        aria-valuenow={sliderValue}
      >
        <div
          className={styles.hScrollInner}
          style={{ width: hScrollInnerWidth }}
        />
      </div>
    </div>
  );
}

export const GANTT_COLORS = [
  "var(--bar-1)",
  "var(--bar-2)",
  "var(--bar-3)",
  "var(--bar-4)",
  "var(--bar-5)",
];

export const TIME_OFF_BAR_COLOR = "var(--bar-off)";

export function projectBarColor(
  projectId: string,
  projectIndex: number
): string {
  if (projectId === TIME_OFF_PROJECT_ID) return TIME_OFF_BAR_COLOR;
  return GANTT_COLORS[
    (projectIndex >= 0 ? projectIndex : 0) % GANTT_COLORS.length
  ];
}
