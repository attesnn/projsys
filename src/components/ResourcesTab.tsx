"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { analyzeResourceAllocation, formatAllocPct } from "@/lib/allocation";
import {
  addAssignmentForResource,
  addTaskToAssignment,
  deleteAssignment,
  deleteTask,
  updateResourceField,
  updateTaskField,
} from "@/lib/store";
import {
  assignmentsForResource,
  filteredSortedResources,
} from "@/lib/query";
import { findTaskConflictsForResource } from "@/lib/conflicts";
import type { TaskConflict } from "@/lib/conflicts";
import { formatDate } from "@/lib/dates";
import { actingAsResourceId, isManager, isResourceRole } from "@/lib/roles";
import { EditableCell } from "./EditableCell";
import { FilterSortBar } from "./FilterSortBar";
import { HistoryPopover } from "./HistoryPopover";
import { GanttView, projectBarColor, type GanttBar, type GanttRow } from "./GanttView";
import styles from "./ResourcesTab.module.css";

const COLS = [
  { id: "resourceName", label: "Resource", width: 200 },
  { id: "resourceType", label: "Role", width: 110 },
  { id: "team", label: "Team", width: 140 },
  { id: "skills", label: "Skills", width: 140 },
  { id: "projects", label: "Projects", width: 140 },
  { id: "start", label: "Start", width: 100 },
  { id: "end", label: "End", width: 100 },
  { id: "allocPct", label: "Alloc %", width: 70 },
  { id: "freePct", label: "Free %", width: 70 },
  { id: "loadPct", label: "Busy %", width: 70 },
  { id: "notes", label: "Notes", width: 150 },
] as const;

type ColId = (typeof COLS)[number]["id"];

const META_COLS_WIDTH = COLS.slice(1, 5).reduce((s, c) => s + c.width, 0);
const AFTER_END_WIDTH = COLS.slice(7).reduce((s, c) => s + c.width, 0);

function defaultWindow() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

interface HistoryTarget {
  entityId: string;
  field: string;
  label: string;
}

function againstLabelsForTask(
  conflicts: TaskConflict[],
  taskId: string
): string {
  const labels: string[] = [];
  for (const c of conflicts) {
    if (c.a.taskId === taskId) {
      labels.push(`${c.b.projectName}: ${c.b.title}`);
    } else if (c.b.taskId === taskId) {
      labels.push(`${c.a.projectName}: ${c.a.title}`);
    }
  }
  return [...new Set(labels)].join("; ");
}

export function ResourcesTab() {
  const { data, setData, getHistory } = useStore();
  const manager = isManager(data);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedAssignments, setCollapsedAssignments] = useState<Set<string>>(
    () => new Set()
  );
  const [ganttWindow, setGanttWindow] = useState(defaultWindow);
  const onRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setGanttWindow((prev) =>
        prev.start === range.start && prev.end === range.end ? prev : range
      );
    },
    []
  );

  // In resource self-view, auto-expand the single person so their stints show.
  useEffect(() => {
    if (!isResourceRole(data)) return;
    const id = actingAsResourceId(data);
    if (!id) return;
    setExpandedResources((prev) => {
      if (prev.has(id) && prev.size === 1) return prev;
      return new Set([id]);
    });
  }, [data.ui.stakeholderRole, data.ui.actingAsResourceId, data.resources]);

  const rows = useMemo(() => {
    return filteredSortedResources(data).map((resource) => {
      const assignments = [...assignmentsForResource(data, resource.id)].sort(
        (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
      );
      const conflicts = findTaskConflictsForResource(data, resource.id);
      const conflictTaskIds = new Set<string>();
      for (const c of conflicts) {
        conflictTaskIds.add(c.a.taskId);
        conflictTaskIds.add(c.b.taskId);
      }

      const skills = data.resourceSkills
        .filter((rs) => rs.resourceId === resource.id)
        .map((rs) => {
          const skill = data.skills.find((s) => s.id === rs.skillId);
          return skill ? `${skill.name} (${rs.level})` : null;
        })
        .filter(Boolean)
        .join(", ");

      const projects = assignments
        .map((a) => data.projects.find((p) => p.id === a.projectId)?.name)
        .filter(Boolean)
        .join(", ");

      const starts = assignments.map((a) => a.start).sort();
      const ends = assignments.map((a) => a.end).sort();

      const assignmentRows = assignments.map((assignment) => {
        const project = data.projects.find((p) => p.id === assignment.projectId);
        const tasks = data.tasks
          .filter((t) => t.assignmentId === assignment.id)
          .sort((a, b) => a.start.localeCompare(b.start));
        return { assignment, project, tasks };
      });

      const allocation = analyzeResourceAllocation(
        assignments,
        ganttWindow.start,
        ganttWindow.end
      );

      return {
        resource,
        skills,
        projects,
        start: starts[0] ?? "",
        end: ends.at(-1) ?? "",
        assignments,
        assignmentRows,
        conflicts,
        conflictTaskIds,
        allocation,
      };
    });
  }, [data, ganttWindow]);

  const ganttRows = useMemo((): GanttRow[] => {
    const out: GanttRow[] = [];

    for (const row of rows) {
      // Assignments (stints) that hold a conflicting task — underline these on
      // the top-level resource row so conflicts read at a glance, unexpanded.
      const conflictAssignmentIds = new Set<string>();
      for (const { assignment, tasks } of row.assignmentRows) {
        if (tasks.some((t) => row.conflictTaskIds.has(t.id))) {
          conflictAssignmentIds.add(assignment.id);
        }
      }

      const assignmentBars: GanttBar[] = row.assignments.map((a) => {
        const project = data.projects.find((p) => p.id === a.projectId);
        const projectIndex = data.projects.findIndex(
          (p) => p.id === a.projectId
        );
        return {
          id: a.id,
          start: a.start,
          end: a.end,
          label: project?.name ?? "Project",
          color: projectBarColor(a.projectId, projectIndex),
          kind: "assignment",
          conflict: conflictAssignmentIds.has(a.id),
        };
      });

      out.push({
        id: row.resource.id,
        label: row.resource.name,
        sublabel: formatAllocPct(row.allocation.allocPct),
        bars: assignmentBars,
      });

      if (!expandedResources.has(row.resource.id)) continue;

      for (const { assignment, project, tasks } of row.assignmentRows) {
        const projectIndex = data.projects.findIndex(
          (p) => p.id === assignment.projectId
        );
        const color = projectBarColor(assignment.projectId, projectIndex);

        out.push({
          id: `asg_row_${assignment.id}`,
          start: assignment.start,
          end: assignment.end,
          label: project?.name ?? "Project",
          color,
          emphasis: true,
          variant: "project",
        });

        if (collapsedAssignments.has(assignment.id)) continue;

        if (tasks.length === 0) {
          out.push({ id: `empty_asg_${assignment.id}` });
          continue;
        }

        for (const task of tasks) {
          const inConflict = row.conflictTaskIds.has(task.id);
          out.push({
            id: `task_row_${task.id}`,
            start: task.start,
            end: task.end,
            label: task.title,
            color,
            variant: "task",
            conflict: inConflict,
          });
        }
      }
    }

    return out;
  }, [rows, data.projects, expandedResources, collapsedAssignments]);

  function syncVertical(source: "grid" | "gantt") {
    const grid = bodyScrollRef.current;
    const gantt = ganttBodyRef.current;
    if (!grid || !gantt) return;
    if (source === "grid") gantt.scrollTop = grid.scrollTop;
    else grid.scrollTop = gantt.scrollTop;
  }

  function toggleResource(id: string) {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAssignment(id: string) {
    setCollapsedAssignments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedResources(new Set(rows.map((r) => r.resource.id)));
    setCollapsedAssignments(new Set());
  }

  function collapseAll() {
    setExpandedResources(new Set());
    setCollapsedAssignments(
      new Set(data.assignments.map((a) => a.id))
    );
  }

  /** Collapse deepest open level first (tasks under stints, then resources). */
  function collapseOneLevel() {
    const openAssignmentIds: string[] = [];
    for (const row of rows) {
      if (!expandedResources.has(row.resource.id)) continue;
      for (const { assignment } of row.assignmentRows) {
        if (!collapsedAssignments.has(assignment.id)) {
          openAssignmentIds.push(assignment.id);
        }
      }
    }
    if (openAssignmentIds.length > 0) {
      setCollapsedAssignments((prev) => {
        const next = new Set(prev);
        for (const id of openAssignmentIds) next.add(id);
        return next;
      });
      return;
    }
    setExpandedResources(new Set());
  }

  function cellValue(row: (typeof rows)[number], colId: ColId): string {
    switch (colId) {
      case "resourceName":
        return row.resource.name;
      case "resourceType":
        return row.resource.type;
      case "team":
        return row.resource.team;
      case "skills":
        return row.skills;
      case "projects":
        return row.projects;
      case "start":
        return row.start;
      case "end":
        return row.end;
      case "allocPct":
        return formatAllocPct(row.allocation.allocPct);
      case "freePct":
        return formatAllocPct(row.allocation.freePct);
      case "loadPct":
        return formatAllocPct(row.allocation.overloadPct);
      case "notes":
        return row.resource.notes;
    }
  }

  function renderResourceCell(row: (typeof rows)[number], colId: ColId) {
    const value = cellValue(row, colId);
    const hasConflicts = row.conflicts.length > 0;
    const canExpand = row.assignments.length > 0;
    const expanded = expandedResources.has(row.resource.id);

    if (colId === "resourceName") {
      return (
        <div className={styles.nameCell}>
          {canExpand ? (
            <button
              type="button"
              className={`${styles.toggle} ${hasConflicts ? styles.conflictToggle : ""}`}
              onClick={() => toggleResource(row.resource.id)}
              aria-expanded={expanded}
              title={
                expanded
                  ? "Hide project stints & tasks"
                  : hasConflicts
                    ? `Show project stints (${row.conflicts.length} conflict${row.conflicts.length === 1 ? "" : "s"})`
                    : "Show project stints & tasks"
              }
            >
              {expanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className={styles.toggleSpacer} />
          )}
          <div className={styles.cellWrap}>
            <EditableCell
              value={value}
              readOnly={!manager}
              title={
                manager ? undefined : "Name is managed by the resource manager"
              }
              onCommit={(v) =>
                setData((prev) =>
                  updateResourceField(prev, row.resource.id, "name", v)
                )
              }
              onHistory={
                manager
                  ? () =>
                      setHistory({
                        entityId: row.resource.id,
                        field: "name",
                        label: "Resource name",
                      })
                  : undefined
              }
            />
            {history?.entityId === row.resource.id &&
              history.field === "name" && (
                <HistoryPopover
                  title={history.label}
                  entries={getHistory("resource", row.resource.id, "name")}
                  onClose={() => setHistory(null)}
                />
              )}
          </div>
          {hasConflicts && (
            <span className={styles.conflictCount}>
              {row.conflicts.length}
            </span>
          )}
        </div>
      );
    }

    if (colId === "resourceType" || colId === "team" || colId === "notes") {
      const field =
        colId === "resourceType" ? "type" : colId === "team" ? "team" : "notes";
      const label =
        colId === "resourceType" ? "Role" : colId === "team" ? "Team" : "Notes";
      const managerLocked =
        (colId === "resourceType" || colId === "team") && !manager;
      return (
        <div className={styles.cellWrap}>
          <EditableCell
            value={value}
            readOnly={managerLocked}
            title={
              managerLocked
                ? `${label} is managed by the resource manager`
                : undefined
            }
            placeholder={
              colId === "notes"
                ? "Add note…"
                : colId === "team"
                  ? "Team…"
                  : undefined
            }
            onCommit={(v) =>
              setData((prev) =>
                updateResourceField(prev, row.resource.id, field, v)
              )
            }
            onHistory={() =>
              setHistory({
                entityId: row.resource.id,
                field,
                label,
              })
            }
          />
          {history?.entityId === row.resource.id && history.field === field && (
            <HistoryPopover
              title={history.label}
              entries={getHistory("resource", row.resource.id, field)}
              onClose={() => setHistory(null)}
            />
          )}
        </div>
      );
    }

    if (colId === "allocPct" || colId === "freePct" || colId === "loadPct") {
      const a = row.allocation;
      const title =
        colId === "allocPct"
          ? `Workdays booked in visible window (weekends ignored): ${a.workDays}/${a.workdayCount}`
          : colId === "freePct"
            ? `Open workdays with no booking (weekends ignored): ${a.freeDays}/${a.workdayCount}`
            : `Workdays with overlapping project bookings: ${a.overloadDays}/${a.workdayCount} (peak ${a.peakLoad}×)`;
      const tone =
        colId === "freePct" && a.freePct >= 20
          ? styles.freeTone
          : colId === "loadPct" && a.overloadPct > 0
            ? styles.busyTone
            : colId === "allocPct" && a.allocPct >= 85
              ? styles.busyTone
              : "";
      return (
        <span className={`${styles.metricCell} ${tone}`} title={title}>
          {value}
        </span>
      );
    }

    return (
      <EditableCell
        value={value}
        readOnly
        title={
          colId === "skills"
            ? "Edit skills on the Skills tab"
            : "Summary — expand to edit task dates"
        }
        onCommit={() => undefined}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <FilterSortBar />
      </div>
      <div className={styles.split}>
        <div className={styles.gridPane}>
          <div className={styles.toolbar}>
            <div className={styles.treeActions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={expandAll}
              >
                Expand all
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={collapseOneLevel}
                title="Collapse the deepest expanded level"
              >
                Collapse one level
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={collapseAll}
              >
                Collapse all
              </button>
            </div>
          </div>

          <div className={styles.gridHeader} ref={headerScrollRef}>
            {COLS.map((col) => (
              <div
                key={col.id}
                className={styles.th}
                style={{ width: col.width, minWidth: col.width }}
              >
                {col.label}
              </div>
            ))}
            <div className={styles.thActions} />
          </div>

          <div
            className={styles.gridBody}
            ref={bodyScrollRef}
            onScroll={() => {
              if (headerScrollRef.current && bodyScrollRef.current) {
                headerScrollRef.current.scrollLeft =
                  bodyScrollRef.current.scrollLeft;
              }
              syncVertical("grid");
            }}
          >
            {rows.length === 0 ? (
              <div className={styles.empty}>
                {data.resources.length === 0
                  ? "No resources yet. Add people on Available resources."
                  : "No resources match the current filters."}
              </div>
            ) : (
              rows.map((row) => {
                const expanded = expandedResources.has(row.resource.id);

                return (
                  <div key={row.resource.id} className={styles.resourceBlock}>
                    <div
                      className={`${styles.tr} ${row.conflicts.length > 0 ? styles.conflictRow : ""}`}
                    >
                      {COLS.map((col) => (
                        <div
                          key={col.id}
                          className={styles.td}
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {renderResourceCell(row, col.id)}
                        </div>
                      ))}
                      <div className={styles.tdActions}>
                        {manager && (
                          <button
                            type="button"
                            className={styles.addAllocBtn}
                            onClick={() => {
                              setData((prev) =>
                                addAssignmentForResource(prev, row.resource.id)
                              );
                              setExpandedResources((prev) =>
                                new Set(prev).add(row.resource.id)
                              );
                            }}
                            title="Add project stint"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded &&
                      row.assignmentRows.map(
                        ({ assignment, project, tasks }) => {
                          const asgOpen = !collapsedAssignments.has(
                            assignment.id
                          );
                          const projectName = project?.name ?? "Project";

                          return (
                            <div
                              key={assignment.id}
                              className={styles.assignmentBranch}
                            >
                              <div
                                className={`${styles.tr} ${styles.assignmentRow}`}
                              >
                                <div
                                  className={`${styles.td} ${styles.hierarchyCell}`}
                                  style={{
                                    width: COLS[0].width,
                                    minWidth: COLS[0].width,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className={styles.toggle}
                                    onClick={() =>
                                      toggleAssignment(assignment.id)
                                    }
                                    aria-expanded={asgOpen}
                                    title={
                                      asgOpen
                                        ? "Hide tasks"
                                        : "Show tasks"
                                    }
                                  >
                                    {asgOpen ? "▼" : "▶"}
                                  </button>
                                  <div className={styles.projectLabel}>
                                    <span className={styles.projectName}>
                                      {projectName}
                                    </span>
                                    {project?.number && (
                                      <span className={styles.projectNumber}>
                                        {project.number}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div
                                  className={`${styles.td} ${styles.metaCell}`}
                                  style={{
                                    width: META_COLS_WIDTH,
                                    minWidth: META_COLS_WIDTH,
                                  }}
                                >
                                  <span className={styles.stintMeta}>
                                    {tasks.length} task
                                    {tasks.length === 1 ? "" : "s"}
                                  </span>
                                </div>
                                <div
                                  className={styles.td}
                                  style={{
                                    width: COLS[4].width,
                                    minWidth: COLS[4].width,
                                  }}
                                >
                                  <EditableCell
                                    value={assignment.start}
                                    readOnly
                                    title="Project stint dates are not edited here — edit task dates below"
                                    onCommit={() => undefined}
                                  />
                                </div>
                                <div
                                  className={styles.td}
                                  style={{
                                    width: COLS[5].width,
                                    minWidth: COLS[5].width,
                                  }}
                                >
                                  <EditableCell
                                    value={assignment.end}
                                    readOnly
                                    title="Project stint dates are not edited here — edit task dates below"
                                    onCommit={() => undefined}
                                  />
                                </div>
                                <div
                                  className={styles.td}
                                  style={{
                                    width: AFTER_END_WIDTH,
                                    minWidth: AFTER_END_WIDTH,
                                  }}
                                />
                                <div className={styles.tdActions}>
                                  {manager && (
                                    <>
                                      <button
                                        type="button"
                                        className={styles.addAllocBtn}
                                        onClick={() =>
                                          setData((prev) =>
                                            addTaskToAssignment(
                                              prev,
                                              assignment.id
                                            )
                                          )
                                        }
                                        title="Add task"
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.deleteBtn}
                                        onClick={() =>
                                          setData((prev) =>
                                            deleteAssignment(
                                              prev,
                                              assignment.id
                                            )
                                          )
                                        }
                                        title="Remove project stint"
                                      >
                                        ×
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {asgOpen && tasks.length === 0 && (
                                <div
                                  className={`${styles.tr} ${styles.emptyTaskRow}`}
                                >
                                  <div
                                    className={`${styles.td} ${styles.metaCell} ${styles.taskIndent}`}
                                    style={{
                                      width: COLS.reduce(
                                        (s, c) => s + c.width,
                                        0
                                      ),
                                      minWidth: COLS.reduce(
                                        (s, c) => s + c.width,
                                        0
                                      ),
                                    }}
                                  >
                                    <span className={styles.emptyHint}>
                                      No tasks — add one to schedule this stint
                                    </span>
                                  </div>
                                  <div className={styles.tdActions} />
                                </div>
                              )}

                              {asgOpen &&
                                tasks.map((task) => {
                                  const inConflict = row.conflictTaskIds.has(
                                    task.id
                                  );
                                  const against = inConflict
                                    ? againstLabelsForTask(
                                        row.conflicts,
                                        task.id
                                      )
                                    : "";

                                  return (
                                    <div
                                      key={task.id}
                                      className={`${styles.tr} ${styles.taskRow} ${inConflict ? styles.taskConflictRow : ""}`}
                                    >
                                      <div
                                        className={`${styles.td} ${styles.hierarchyCell} ${styles.taskIndent}`}
                                        style={{
                                          width: COLS[0].width,
                                          minWidth: COLS[0].width,
                                        }}
                                      >
                                        <span className={styles.taskBullet}>
                                          ·
                                        </span>
                                        <div className={styles.cellWrap}>
                                          <EditableCell
                                            value={task.title}
                                            onCommit={(v) =>
                                              setData((prev) =>
                                                updateTaskField(
                                                  prev,
                                                  task.id,
                                                  "title",
                                                  v
                                                )
                                              )
                                            }
                                            onHistory={() =>
                                              setHistory({
                                                entityId: task.id,
                                                field: "title",
                                                label: "Task title",
                                              })
                                            }
                                          />
                                          {history?.entityId === task.id &&
                                            history.field === "title" && (
                                              <HistoryPopover
                                                title={history.label}
                                                entries={getHistory(
                                                  "task",
                                                  task.id,
                                                  "title"
                                                )}
                                                onClose={() =>
                                                  setHistory(null)
                                                }
                                              />
                                            )}
                                        </div>
                                      </div>
                                      <div
                                        className={`${styles.td} ${styles.metaCell}`}
                                        style={{
                                          width: META_COLS_WIDTH,
                                          minWidth: META_COLS_WIDTH,
                                        }}
                                      >
                                        {inConflict ? (
                                          <span className={styles.against}>
                                            conflicts with {against}
                                          </span>
                                        ) : (
                                          <span className={styles.taskStatus}>
                                            {task.status}
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={styles.td}
                                        style={{
                                          width: COLS[4].width,
                                          minWidth: COLS[4].width,
                                        }}
                                      >
                                        <div className={styles.cellWrap}>
                                          <EditableCell
                                            value={task.start}
                                            type="date"
                                            onCommit={(v) =>
                                              setData((prev) =>
                                                updateTaskField(
                                                  prev,
                                                  task.id,
                                                  "start",
                                                  v
                                                )
                                              )
                                            }
                                            onHistory={() =>
                                              setHistory({
                                                entityId: task.id,
                                                field: "start",
                                                label: "Task start",
                                              })
                                            }
                                          />
                                          {history?.entityId === task.id &&
                                            history.field === "start" && (
                                              <HistoryPopover
                                                title={history.label}
                                                entries={getHistory(
                                                  "task",
                                                  task.id,
                                                  "start"
                                                )}
                                                onClose={() =>
                                                  setHistory(null)
                                                }
                                              />
                                            )}
                                        </div>
                                      </div>
                                      <div
                                        className={styles.td}
                                        style={{
                                          width: COLS[5].width,
                                          minWidth: COLS[5].width,
                                        }}
                                      >
                                        <div className={styles.cellWrap}>
                                          <EditableCell
                                            value={task.end}
                                            type="date"
                                            onCommit={(v) =>
                                              setData((prev) =>
                                                updateTaskField(
                                                  prev,
                                                  task.id,
                                                  "end",
                                                  v
                                                )
                                              )
                                            }
                                            onHistory={() =>
                                              setHistory({
                                                entityId: task.id,
                                                field: "end",
                                                label: "Task end",
                                              })
                                            }
                                          />
                                          {history?.entityId === task.id &&
                                            history.field === "end" && (
                                              <HistoryPopover
                                                title={history.label}
                                                entries={getHistory(
                                                  "task",
                                                  task.id,
                                                  "end"
                                                )}
                                                onClose={() =>
                                                  setHistory(null)
                                                }
                                              />
                                            )}
                                        </div>
                                      </div>
                                      <div
                                        className={styles.td}
                                        style={{
                                          width: AFTER_END_WIDTH,
                                          minWidth: AFTER_END_WIDTH,
                                        }}
                                      />
                                      <div className={styles.tdActions}>
                                        {manager && (
                                          <button
                                            type="button"
                                            className={styles.deleteBtn}
                                            onClick={() =>
                                              setData((prev) =>
                                                deleteTask(prev, task.id)
                                              )
                                            }
                                            title="Delete task"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        }
                      )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <GanttView
          title="Availability"
          bodyRef={ganttBodyRef}
          onBodyScroll={() => syncVertical("gantt")}
          onRangeChange={onRangeChange}
          rows={ganttRows}
        />
      </div>
    </div>
  );
}
