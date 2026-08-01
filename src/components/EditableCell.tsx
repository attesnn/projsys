"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./EditableCell.module.css";

interface EditableCellProps {
  value: string;
  onCommit: (value: string) => void;
  onHistory?: () => void;
  type?: "text" | "date" | "number" | "select";
  options?: { value: string; label: string }[];
  readOnly?: boolean;
  className?: string;
  title?: string;
  placeholder?: string;
  children?: ReactNode;
}

export function EditableCell({
  value,
  onCommit,
  onHistory,
  type = "text",
  options,
  readOnly,
  className,
  title,
  placeholder,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit(next = draft) {
    setEditing(false);
    if (next !== value) onCommit(next);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value);
      setEditing(false);
    } else if (e.key === "Tab") {
      commit();
    }
  }

  if (readOnly) {
    return (
      <div className={`${styles.cell} ${styles.readOnly} ${className ?? ""}`} title={title}>
        <span className={styles.value}>{value || "—"}</span>
        {onHistory && (
          <button
            type="button"
            className={styles.historyBtn}
            onClick={(e) => {
              e.stopPropagation();
              onHistory();
            }}
            aria-label="Show history"
            title="History"
          >
            ↻
          </button>
        )}
      </div>
    );
  }

  if (editing) {
    if (type === "select" && options) {
      return (
        <div className={`${styles.cell} ${styles.editing} ${className ?? ""}`}>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className={styles.input}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onCommit(e.target.value);
              setEditing(false);
            }}
            onBlur={() => commit()}
            onKeyDown={onKeyDown}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className={`${styles.cell} ${styles.editing} ${className ?? ""}`}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={styles.input}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  }

  const display =
    type === "select" && options
      ? options.find((o) => o.value === value)?.label ?? value
      : value;

  return (
    <div
      className={`${styles.cell} ${className ?? ""}`}
      title={title}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      tabIndex={0}
      role="gridcell"
    >
      <span className={styles.value} onClick={() => setEditing(true)}>
        {display || (
          <span className={styles.placeholder}>{placeholder ?? ""}</span>
        )}
      </span>
      {onHistory && (
        <button
          type="button"
          className={styles.historyBtn}
          onClick={(e) => {
            e.stopPropagation();
            onHistory();
          }}
          aria-label="Show history"
          title="History"
        >
          ↻
        </button>
      )}
    </div>
  );
}
