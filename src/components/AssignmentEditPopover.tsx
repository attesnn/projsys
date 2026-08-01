"use client";

import { EditableCell } from "./EditableCell";
import styles from "./AssignmentEditPopover.module.css";

export interface AssignmentEditValues {
  projectName: string;
  start: string;
  end: string;
}

interface AssignmentEditPopoverProps {
  title: string;
  values: AssignmentEditValues;
  onChange: (field: keyof AssignmentEditValues, value: string) => void;
  onClose: () => void;
  onDelete?: () => void;
  /** Fixed-position anchor (viewport coords). Falls back to centered panel. */
  anchor?: { top: number; left: number } | null;
}

export function AssignmentEditPopover({
  title,
  values,
  onChange,
  onClose,
  onDelete,
  anchor,
}: AssignmentEditPopoverProps) {
  const style = anchor
    ? {
        top: Math.min(anchor.top + 8, window.innerHeight - 220),
        left: Math.min(Math.max(8, anchor.left), window.innerWidth - 288),
      }
    : undefined;

  return (
    <div
      className={`${styles.panel} ${anchor ? styles.anchored : styles.centered}`}
      style={style}
      role="dialog"
      aria-label="Edit allocation"
    >
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Allocation</div>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          ×
        </button>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Project</span>
        <EditableCell
          value={values.projectName}
          onCommit={(v) => onChange("projectName", v)}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Start</span>
          <EditableCell
            value={values.start}
            type="date"
            onCommit={(v) => onChange("start", v)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>End</span>
          <EditableCell
            value={values.end}
            type="date"
            onCommit={(v) => onChange("end", v)}
          />
        </label>
      </div>

      {onDelete && (
        <button type="button" className={styles.delete} onClick={onDelete}>
          Remove allocation
        </button>
      )}
    </div>
  );
}
