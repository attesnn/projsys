"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addResource,
  deleteResource,
  updateResourceField,
} from "@/lib/store";
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

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function AvailableResourcesTab() {
  const { data, setData, getHistory } = useStore();
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const today = todayIso();

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
        <button
          type="button"
          className={styles.btn}
          onClick={() => setData((prev) => addResource(prev))}
        >
          Add resource
        </button>
        <FilterSortBar />
        <span className={styles.hint}>
          Availability is based on allocations covering today
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Team</th>
              <th>Skills</th>
              <th>Active projects</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.resource.id}>
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
                          label: "Type",
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
