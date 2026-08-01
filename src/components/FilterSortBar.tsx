"use client";

import { useStore } from "@/context/StoreContext";
import {
  clearFilters,
  setFilterProjectId,
  setFilterResourceId,
  setFilterResourceType,
  setSort,
  toggleSortDir,
} from "@/lib/store";
import { SORT_OPTIONS, type SortKey } from "@/lib/types";
import { isManager, isResourceRole } from "@/lib/roles";
import styles from "./FilterSortBar.module.css";

interface FilterSortBarProps {
  /** Compact mode for toolbars that already have primary actions */
  showClear?: boolean;
}

export function FilterSortBar({ showClear = true }: FilterSortBarProps) {
  const { data, setData } = useStore();
  const { filterProjectId, filterResourceId, filterResourceType, sortKey, sortDir } =
    data.ui;
  const manager = isManager(data);
  const asResource = isResourceRole(data);
  const active = Boolean(
    filterProjectId ||
      (!asResource && filterResourceId) ||
      (manager && filterResourceType)
  );
  const resourceTypes = [
    ...new Set(data.resources.map((r) => r.type).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span>Project</span>
        <select
          value={filterProjectId}
          onChange={(e) =>
            setData((prev) => setFilterProjectId(prev, e.target.value))
          }
        >
          <option value="">All projects</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {manager && (
        <label className={styles.field}>
          <span>Resource</span>
          <select
            value={filterResourceId}
            onChange={(e) =>
              setData((prev) => setFilterResourceId(prev, e.target.value))
            }
          >
            <option value="">All resources</option>
            {data.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {manager && (
        <label className={styles.field}>
          <span>Type</span>
          <select
            value={filterResourceType}
            onChange={(e) =>
              setData((prev) => setFilterResourceType(prev, e.target.value))
            }
          >
            <option value="">All types</option>
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={styles.field}>
        <span>Sort</span>
        <select
          value={sortKey}
          onChange={(e) =>
            setData((prev) => setSort(prev, e.target.value as SortKey))
          }
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.dirBtn}
        onClick={() => setData((prev) => toggleSortDir(prev))}
        title={sortDir === "asc" ? "Ascending" : "Descending"}
        aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
      >
        {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>

      {showClear && active && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => setData((prev) => clearFilters(prev))}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
