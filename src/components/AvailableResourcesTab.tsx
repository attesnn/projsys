"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addResource,
  deleteResource,
  updateResourceField,
} from "@/lib/store";
import { createId } from "@/lib/id";
import { filteredSortedResources } from "@/lib/query";
import { EditableCell } from "./EditableCell";
import { FilterSortBar } from "./FilterSortBar";
import { HistoryPopover } from "./HistoryPopover";
import styles from "./AvailableResourcesTab.module.css";

interface HistoryTarget {
  resourceId: string;
  field: string;
  label: string;
}

const EMPTY_DRAFT = { name: "", type: "", team: "" };

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function AvailableResourcesTab() {
  const { data, setData, getHistory } = useStore();
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const today = todayIso();

  // Callback ref: fires exactly when the newly added row's DOM node mounts,
  // so we can reliably scroll it into view regardless of its sorted position.
  const scrollAddedRowIntoView = useCallback(
    (node: HTMLTableRowElement | null) => {
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    []
  );

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!lastAddedId) return;
    const timer = window.setTimeout(() => setLastAddedId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [lastAddedId]);

  const handleAddResource = () => {
    if (!draft.name.trim()) {
      nameInputRef.current?.focus();
      return;
    }
    const id = createId("res");
    setData((prev) => addResource(prev, { ...draft, id }));
    setLastAddedId(id);
    setDraft(EMPTY_DRAFT);
    nameInputRef.current?.focus();
  };

  const rows = useMemo(() => {
    return filteredSortedResources(data).map((resource) => {
      const skills = data.resourceSkills
        .filter((rs) => rs.resourceId === resource.id)
        .map((rs) => {
          const skill = data.skills.find((s) => s.id === rs.skillId);
          return skill ? `${skill.name} (${rs.level})` : null;
        })
        .filter(Boolean)
        .join(", ");

      const active = data.assignments.filter(
        (a) =>
          a.resourceId === resource.id &&
          a.start <= today &&
          a.end >= today &&
          (!data.ui.filterProjectId || a.projectId === data.ui.filterProjectId)
      );

      const projects = active
        .map((a) => data.projects.find((p) => p.id === a.projectId)?.name)
        .filter(Boolean)
        .join(", ");

      return {
        resource,
        skills,
        projects,
        status: active.length === 0 ? "Available" : "Booked",
      };
    });
  }, [data, today]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <FilterSortBar />
        <span className={styles.hint}>
          Availability is based on allocations covering today
        </span>
      </div>

      <form
        className={styles.addPanel}
        onSubmit={(e) => {
          e.preventDefault();
          handleAddResource();
        }}
      >
        <span className={styles.addLabel}>New resource</span>
        <input
          ref={nameInputRef}
          className={`${styles.input} ${styles.nameInput}`}
          value={draft.name}
          placeholder="Name"
          aria-label="New resource name"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <input
          className={styles.input}
          value={draft.type}
          placeholder="Role"
          aria-label="New resource role"
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
        />
        <input
          className={styles.input}
          value={draft.team}
          placeholder="Team"
          aria-label="New resource team"
          onChange={(e) => setDraft((d) => ({ ...d, team: e.target.value }))}
        />
        <button
          type="submit"
          className={styles.btn}
          disabled={!draft.name.trim()}
        >
          Add resource
        </button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Team</th>
              <th>Skills</th>
              <th>Active projects</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.resource.id}
                ref={
                  row.resource.id === lastAddedId
                    ? scrollAddedRowIntoView
                    : undefined
                }
                className={
                  row.resource.id === lastAddedId ? styles.added : undefined
                }
              >
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={row.resource.name}
                      onCommit={(v) =>
                        setData((prev) =>
                          updateResourceField(prev, row.resource.id, "name", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          resourceId: row.resource.id,
                          field: "name",
                          label: "Name",
                        })
                      }
                    />
                    {history?.resourceId === row.resource.id &&
                      history.field === "name" && (
                        <HistoryPopover
                          title={history.label}
                          entries={getHistory("resource", row.resource.id, "name")}
                          onClose={() => setHistory(null)}
                        />
                      )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={row.resource.type}
                      onCommit={(v) =>
                        setData((prev) =>
                          updateResourceField(prev, row.resource.id, "type", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          resourceId: row.resource.id,
                          field: "type",
                          label: "Role",
                        })
                      }
                    />
                    {history?.resourceId === row.resource.id &&
                      history.field === "type" && (
                        <HistoryPopover
                          title={history.label}
                          entries={getHistory("resource", row.resource.id, "type")}
                          onClose={() => setHistory(null)}
                        />
                      )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={row.resource.team}
                      placeholder="Team…"
                      onCommit={(v) =>
                        setData((prev) =>
                          updateResourceField(prev, row.resource.id, "team", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          resourceId: row.resource.id,
                          field: "team",
                          label: "Team",
                        })
                      }
                    />
                    {history?.resourceId === row.resource.id &&
                      history.field === "team" && (
                        <HistoryPopover
                          title={history.label}
                          entries={getHistory("resource", row.resource.id, "team")}
                          onClose={() => setHistory(null)}
                        />
                      )}
                  </div>
                </td>
                <td className={styles.muted}>
                  {row.skills || "—"}
                </td>
                <td className={styles.muted}>{row.projects || "—"}</td>
                <td>
                  <span
                    className={`${styles.badge} ${
                      row.status === "Available"
                        ? styles.available
                        : styles.booked
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className={styles.actions}>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${row.resource.name}? Their allocations and tasks will also be removed.`
                        )
                      ) {
                        setData((prev) =>
                          deleteResource(prev, row.resource.id)
                        );
                      }
                    }}
                    title="Delete resource"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className={styles.empty}>
            {data.resources.length === 0
              ? "No resources yet. Add one to begin."
              : "No resources match the current filters."}
          </p>
        )}
      </div>
    </div>
  );
}
