"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addTask,
  deleteTask,
  updateTaskAssignment,
  updateTaskField,
} from "@/lib/store";
import { filteredSortedAssignments } from "@/lib/query";
import { TASK_STATUSES } from "@/lib/types";
import { isManager } from "@/lib/roles";
import { EditableCell } from "./EditableCell";
import { FilterSortBar } from "./FilterSortBar";
import { HistoryPopover } from "./HistoryPopover";
import styles from "./TasksTab.module.css";

interface HistoryTarget {
  taskId: string;
  field: string;
  label: string;
}

export function TasksTab() {
  const { data, setData, getHistory } = useStore();
  const manager = isManager(data);
  const [history, setHistory] = useState<HistoryTarget | null>(null);

  const rows = useMemo(() => {
    const assignmentIds = new Set(
      filteredSortedAssignments(data).map((a) => a.id)
    );
    const { sortKey, sortDir } = data.ui;

    const mapped = data.tasks
      .map((task) => {
        const assignment = data.assignments.find(
          (a) => a.id === task.assignmentId
        );
        const project = assignment
          ? data.projects.find((p) => p.id === assignment.projectId)
          : undefined;
        const resource = assignment
          ? data.resources.find((r) => r.id === assignment.resourceId)
          : undefined;
        return { task, assignment, project, resource };
      })
      .filter((row) => row.assignment && assignmentIds.has(row.assignment.id));

    return [...mapped].sort((a, b) => {
      const av = (() => {
        switch (sortKey) {
          case "projectName":
            return (a.project?.name ?? "").toLowerCase();
          case "projectNumber":
            return (a.project?.number ?? "").toLowerCase();
          case "resourceName":
            return (a.resource?.name ?? "").toLowerCase();
          case "start":
            return a.task.start;
          case "end":
            return a.task.end;
        }
      })();
      const bv = (() => {
        switch (sortKey) {
          case "projectName":
            return (b.project?.name ?? "").toLowerCase();
          case "projectNumber":
            return (b.project?.number ?? "").toLowerCase();
          case "resourceName":
            return (b.resource?.name ?? "").toLowerCase();
          case "start":
            return b.task.start;
          case "end":
            return b.task.end;
        }
      })();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return a.task.title.localeCompare(b.task.title);
    });
  }, [data]);

  const filteredAssignments = useMemo(
    () => filteredSortedAssignments(data),
    [data]
  );

  const projectOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const a of filteredAssignments) {
      if (seen.has(a.projectId)) continue;
      seen.add(a.projectId);
      const project = data.projects.find((p) => p.id === a.projectId);
      options.push({
        value: a.projectId,
        label: project?.name ?? "Project",
      });
    }
    return options;
  }, [filteredAssignments, data.projects]);

  function resourceOptionsFor(projectId: string) {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const a of filteredAssignments) {
      if (a.projectId !== projectId || seen.has(a.resourceId)) continue;
      seen.add(a.resourceId);
      const resource = data.resources.find((r) => r.id === a.resourceId);
      options.push({
        value: a.resourceId,
        label: resource?.name ?? "Resource",
      });
    }
    return options;
  }

  function assignmentIdFor(projectId: string, resourceId: string): string | null {
    return (
      filteredAssignments.find(
        (a) => a.projectId === projectId && a.resourceId === resourceId
      )?.id ?? null
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {manager && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => setData((prev) => addTask(prev))}
            disabled={data.assignments.length === 0}
          >
            Add task
          </button>
        )}
        <FilterSortBar />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Resource</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, assignment }) => (
              <tr key={task.id}>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={task.title}
                      onCommit={(v) =>
                        setData((prev) =>
                          updateTaskField(prev, task.id, "title", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          taskId: task.id,
                          field: "title",
                          label: "Task title",
                        })
                      }
                    />
                    {history?.taskId === task.id && history.field === "title" && (
                      <HistoryPopover
                        title={history.label}
                        entries={getHistory("task", task.id, "title")}
                        onClose={() => setHistory(null)}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    {manager ? (
                      <EditableCell
                        value={assignment?.projectId ?? ""}
                        type="select"
                        options={projectOptions}
                        onCommit={(projectId) => {
                          const resourceId = assignment?.resourceId ?? "";
                          const nextId =
                            assignmentIdFor(projectId, resourceId) ??
                            filteredAssignments.find(
                              (a) => a.projectId === projectId
                            )?.id;
                          if (nextId) {
                            setData((prev) =>
                              updateTaskAssignment(prev, task.id, nextId)
                            );
                          }
                        }}
                        onHistory={() =>
                          setHistory({
                            taskId: task.id,
                            field: "assignmentId",
                            label: "Assignment",
                          })
                        }
                      />
                    ) : (
                      <EditableCell
                        value={
                          data.projects.find(
                            (p) => p.id === assignment?.projectId
                          )?.name ?? ""
                        }
                        readOnly
                        onCommit={() => undefined}
                      />
                    )}
                    {history?.taskId === task.id &&
                      history.field === "assignmentId" && (
                        <HistoryPopover
                          title={history.label}
                          entries={getHistory("task", task.id, "assignmentId")}
                          onClose={() => setHistory(null)}
                        />
                      )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    {manager ? (
                      <EditableCell
                        value={assignment?.resourceId ?? ""}
                        type="select"
                        options={resourceOptionsFor(assignment?.projectId ?? "")}
                        onCommit={(resourceId) => {
                          const projectId = assignment?.projectId ?? "";
                          const nextId = assignmentIdFor(projectId, resourceId);
                          if (nextId) {
                            setData((prev) =>
                              updateTaskAssignment(prev, task.id, nextId)
                            );
                          }
                        }}
                        onHistory={() =>
                          setHistory({
                            taskId: task.id,
                            field: "assignmentId",
                            label: "Assignment",
                          })
                        }
                      />
                    ) : (
                      <EditableCell
                        value={
                          data.resources.find(
                            (r) => r.id === assignment?.resourceId
                          )?.name ?? ""
                        }
                        readOnly
                        onCommit={() => undefined}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={task.status}
                      type="select"
                      options={TASK_STATUSES.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      onCommit={(v) =>
                        setData((prev) =>
                          updateTaskField(prev, task.id, "status", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          taskId: task.id,
                          field: "status",
                          label: "Status",
                        })
                      }
                    />
                    {history?.taskId === task.id && history.field === "status" && (
                      <HistoryPopover
                        title={history.label}
                        entries={getHistory("task", task.id, "status")}
                        onClose={() => setHistory(null)}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={task.start}
                      type="date"
                      onCommit={(v) =>
                        setData((prev) =>
                          updateTaskField(prev, task.id, "start", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          taskId: task.id,
                          field: "start",
                          label: "Start date",
                        })
                      }
                    />
                    {history?.taskId === task.id && history.field === "start" && (
                      <HistoryPopover
                        title={history.label}
                        entries={getHistory("task", task.id, "start")}
                        onClose={() => setHistory(null)}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.cellWrap}>
                    <EditableCell
                      value={task.end}
                      type="date"
                      onCommit={(v) =>
                        setData((prev) =>
                          updateTaskField(prev, task.id, "end", v)
                        )
                      }
                      onHistory={() =>
                        setHistory({
                          taskId: task.id,
                          field: "end",
                          label: "End date",
                        })
                      }
                    />
                    {history?.taskId === task.id && history.field === "end" && (
                      <HistoryPopover
                        title={history.label}
                        entries={getHistory("task", task.id, "end")}
                        onClose={() => setHistory(null)}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.actions}>
                  {manager && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() =>
                        setData((prev) => deleteTask(prev, task.id))
                      }
                      title="Delete task"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className={styles.empty}>
            {data.tasks.length === 0
              ? "No tasks yet."
              : "No tasks match the current filters."}
          </p>
        )}
      </div>
    </div>
  );
}
