"use client";

import type { ChangeLogEntry } from "@/lib/types";
import styles from "./HistoryPopover.module.css";

interface HistoryPopoverProps {
  title: string;
  entries: ChangeLogEntry[];
  onClose: () => void;
}

export function HistoryPopover({ title, entries, onClose }: HistoryPopoverProps) {
  return (
    <div className={styles.panel} role="dialog" aria-label="Change history">
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>History</div>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          ×
        </button>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>No changes recorded for this cell yet.</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => (
            <li key={e.id} className={styles.item}>
              <time className={styles.time} dateTime={e.at}>
                {new Date(e.at).toLocaleString()}
              </time>
              <div className={styles.change}>
                <span className={styles.old}>{e.oldValue || "—"}</span>
                <span className={styles.arrow}>→</span>
                <span className={styles.new}>{e.newValue || "—"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
