"use client";

import { useEffect } from "react";
import styles from "./GuideDialog.module.css";

interface GuideDialogProps {
  onClose: () => void;
}

export function GuideDialog({ onClose }: GuideDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>How Projsys works</div>
            <h2 id="guide-title" className={styles.title}>
              Guide
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close guide"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3>Core model</h3>
            <p>
              A <strong>Project</strong> books people through{" "}
              <strong>Assignments</strong> (stints with start/end dates).{" "}
              <strong>Tasks</strong> hang off an assignment — so each task belongs
              to one project and one resource. Each person also has a{" "}
              <strong>Team</strong> for organizational grouping. Time off is a
              normal project named “Time off”.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tabs</h3>
            <ul>
              <li>
                <strong>Projects</strong> — project → assignment → task tree +
                Gantt; edit assignment dates here.
              </li>
              <li>
                <strong>Resource allocation</strong> — one row per person;
                expand to stints and tasks. Parent Start/End and Alloc/Free/Busy
                % are derived for the visible Gantt window.
              </li>
              <li>
                <strong>Available resources</strong> — people master; Available
                vs Booked for today.
              </li>
              <li>
                <strong>Teams</strong> — people grouped by team with task
                workload, plus a Gantt of rolled-up team bookings (expand for
                per-person bars). Alloc/Busy % follow the visible Gantt window.
              </li>
              <li>
                <strong>Skills</strong> — resource × skill matrix (levels 1–5).
              </li>
              <li>
                <strong>Tasks</strong> — flat editable task list.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3>Allocation metrics</h3>
            <p>
              Over the Gantt’s visible window (weekends ignored):{" "}
              <strong>Alloc %</strong> = weekdays with ≥1 work booking;{" "}
              <strong>Free %</strong> = weekdays with no booking;{" "}
              <strong>Busy %</strong> = weekdays with ≥2 overlapping work
              bookings. Time off blocks free capacity without raising Alloc %.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Conflicts</h3>
            <p>
              A conflict is two <strong>tasks</strong> on the{" "}
              <strong>same person</strong> for <strong>different projects</strong>{" "}
              whose date ranges overlap. Overlapping assignments alone are not
              treated as conflicts (they show up as Busy % instead).
            </p>
          </section>

          <section className={styles.section}>
            <h3>Gantt</h3>
            <p>
              Shared Week / Month / Quarter / Year scales. The chart fits the
              pane width; ←/→ nudge the window; the bottom horizontal scrollbar
              scrubs across the full timeline domain.
            </p>
          </section>

          <section className={styles.section}>
            <h3>View as (roles)</h3>
            <p>
              Demo persona switch only — not real auth.{" "}
              <strong>Resource manager</strong> sees all tabs and can edit
              freely. <strong>Resource</strong> is scoped to one person (My
              schedule / projects / tasks) and can edit own task fields and
              notes, not bookings or other people.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
