"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addProject,
  addTaskToAssignment,
  deleteAssignment,
  deleteTask,
  updateAssignmentField,
  updateProjectField,
  updateTaskField,
} from "@/lib/store";
import {
  filterAssignmentsForProject,
  filteredSortedProjects,
} from "@/lib/query";
import { TASK_STATUSES } from "@/lib/types";
import { isManager } from "@/lib/roles";
import { AssignmentEditPopover } from "./AssignmentEditPopover";
import { EditableCell } from "./EditableCell";
import { FilterSortBar } from "./FilterSortBar";
import { GanttView, projectBarColor, type GanttRow } from "./GanttView";
import styles from "./ProjectsTab.module.css";

interface EditingAssignment {
  id: string;
  anchor: { top: number; left: number } | null;
}

export function ProjectsTab() {
  const { data, setData } = useStore();
  const manager = isManager(data);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedAssignments, setCollapsedAssignments] = useState<Set<string>>(
    () => new Set()
  );
  const [editing, setEditing] = useState<EditingAssignment | null>(null);

  const tree = useMemo(() => {
    return filteredSortedProjects(data).map((project) => {
      const projectIndex = data.projects.findIndex((p) => p.id === project.id);
      const assignments = filterAssignmentsForProject(data, project.id).map(
        (assignment) => {
          const resource = data.resources.find(
            (r) => r.id === assignment.resourceId
          );
          const tasks = data.tasks.filter(
            (t) => t.assignmentId === assignment.id
          );
          return { assignment, resource, tasks };
        }
      );
      return { project, assignments, projectIndex };
    });
  }, [data]);

  const editingAssignment = editing
    ? data.assignments.find((a) => a.id === editing.id)
    : undefined;
  const editingProject = editingAssignment
    ? data.projects.find((p) => p.id === editingAssignment.projectId)
    : undefined;

  const ganttRows = useMemo(() => {
    const rows: GanttRow[] = [];

    for (const { project, assignments, projectIndex } of tree) {
      const color = projectBarColor(project.id, projectIndex);
      const starts = assignments.map((a) => a.assignment.start);
      const ends = assignments.map((a) => a.assignment.end);
      const projectStart =
        starts.length > 0
          ? starts.reduce((a, b) => (a < b ? a : b))
          : undefined;
      const projectEnd =
        ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : undefined;

      rows.push({
        id: `proj_${project.id}`,
        start: projectStart,
        end: projectEnd,
        label: project.name,
        color,
        emphasis: true,
      });

      if (collapsedProjects.has(project.id)) continue;

      if (assignments.length === 0) {
        rows.push({ id: `empty_proj_${project.id}` });
        continue;
      }

      for (const { assignment, resource, tasks } of assignments) {
        rows.push({
          id: `asg_${assignment.id}`,
          bars: [
            {
              id: assignment.id,
              start: assignment.start,
              end: assignment.end,
              label: resource?.name ?? "Resource",
              color,
            },
          ],
        });

        if (collapsedAssignments.has(assignment.id)) continue;

        if (tasks.length === 0) {
          rows.push({ id: `empty_asg_${assignment.id}` });
          continue;
        }

        for (const task of tasks) {
          rows.push({
            id: `task_${task.id}`,
            start: task.start,
            end: task.end,
            label: task.title,
            color,
          });
        }
      }
    }

    return rows;
  }, [tree, collapsedProjects, collapsedAssignments]);

  function syncVertical(source: "tree" | "gantt") {
    const treeEl = treeScrollRef.current;
    const ganttEl = ganttBodyRef.current;
    if (!treeEl || !ganttEl) return;
    if (source === "tree") ganttEl.scrollTop = treeEl.scrollTop;
    else treeEl.scrollTop = ganttEl.scrollTop;
  }

  function toggleProject(id: string) {
    setCollapsedProjects((prev) => {
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
    setCollapsedProjects(new Set());
    setCollapsedAssignments(new Set());
  }

  function collapseAll() {
    setCollapsedProjects(new Set(data.projects.map((p) => p.id)));
    setCollapsedAssignments(new Set(data.assignments.map((a) => a.id)));
  }

  /** Collapse deepest open level first (tasks under stints, then projects). */
  function collapseOneLevel() {
    const openAssignmentIds: string[] = [];
    for (const { project, assignments } of tree) {
      if (collapsedProjects.has(project.id)) continue;
      for (const { assignment } of assignments) {
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
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      for (const { project } of tree) next.add(project.id);
      return next;
    });
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <FilterSortBar />
      </div>
      <div className={styles.split}>
        <div className={styles.treePane}>
          <div className={styles.toolbar}>
            {manager && (
              <button
                type="button"
                className={styles.btn}
                onClick={() => setData((prev) => addProject(prev))}
              >
                Add project
              </button>
            )}
            <button type="button" className={styles.ghost} onClick={expandAll}>
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
            <button type="button" className={styles.ghost} onClick={collapseAll}>
              Collapse all
            </button>
          </div>

          <div className={styles.treeHeader}>Hierarchy</div>

          <div
            className={styles.list}
            ref={treeScrollRef}
            onScroll={() => syncVertical("tree")}
          >
            {tree.length === 0 && (
              <p className={styles.empty}>
                {data.projects.length === 0
                  ? "No projects yet. Add one to begin."
                  : "No projects match the current filters."}
              </p>
            )}

            {tree.map(({ project, assignments }) => {
              const projectOpen = !collapsedProjects.has(project.id);
              const taskCount = assignments.reduce(
                (n, a) => n + a.tasks.length,
                0
              );

              return (
                <section key={project.id} className={styles.project}>
                  <div className={`${styles.row} ${styles.projectRow}`}>
                    <button
                      type="button"
                      className={styles.toggle}
                      onClick={() => toggleProject(project.id)}
                      aria-expanded={projectOpen}
                      aria-label={
                        projectOpen ? "Collapse project" : "Expand project"
                      }
                    >
                      {projectOpen ? "▼" : "▶"}
                    </button>
                    <div className={styles.projectFields}>
                      <EditableCell
                        value={project.name}
                        readOnly={!manager}
                        title={
                          manager
                            ? undefined
                            : "Project details are managed by the resource manager"
                        }
                        onCommit={(v) =>
                          setData((prev) =>
                            updateProjectField(prev, project.id, "name", v)
                          )
                        }
                        className={styles.projectName}
                      />
                      <EditableCell
                        value={project.number}
                        readOnly={!manager}
                        title={
                          manager
                            ? undefined
                            : "Project details are managed by the resource manager"
                        }
                        onCommit={(v) =>
                          setData((prev) =>
                            updateProjectField(prev, project.id, "number", v)
                          )
                        }
                        className={styles.projectNumber}
                      />
                    </div>
                    <span className={styles.meta}>
                      {assignments.length} resource
                      {assignments.length === 1 ? "" : "s"} · {taskCount} task
                      {taskCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  {projectOpen && (
                    <div className={styles.children}>
                      {assignments.length === 0 && (
                        <div className={`${styles.row} ${styles.emptyChild}`}>
                          No resources assigned
                        </div>
                      )}

                      {assignments.map(({ assignment, resource, tasks }) => {
                        const asgOpen = !collapsedAssignments.has(
                          assignment.id
                        );
                        return (
                          <div
                            key={assignment.id}
                            className={styles.assignment}
                          >
                            <div
                              className={`${styles.row} ${styles.assignmentRow} ${editing?.id === assignment.id ? styles.editingAssignment : ""}`}
                            >
                              <button
                                type="button"
                                className={styles.toggle}
                                onClick={() =>
                                  toggleAssignment(assignment.id)
                                }
                                aria-expanded={asgOpen}
                                aria-label={
                                  asgOpen
                                    ? "Collapse resource"
                                    : "Expand resource"
                                }
                              >
                                {asgOpen ? "▼" : "▶"}
                              </button>
                              <div className={styles.assignmentInfo}>
                                <span className={styles.resourceName}>
                                  {resource?.name ?? "Unknown resource"}
                                </span>
                                <span className={styles.dim}>
                                  {resource?.type ?? ""}
                                </span>
                                <div className={styles.dateEdit}>
                                  <EditableCell
                                    value={assignment.start}
                                    type="date"
                                    readOnly={!manager}
                                    title={
                                      manager
                                        ? undefined
                                        : "Assignment dates are set by the resource manager"
                                    }
                                    onCommit={(v) =>
                                      setData((prev) =>
                                        updateAssignmentField(
                                          prev,
                                          assignment.id,
                                          "start",
                                          v
                                        )
                                      )
                                    }
                                  />
                                </div>
                                <div className={styles.dateEdit}>
                                  <EditableCell
                                    value={assignment.end}
                                    type="date"
                                    readOnly={!manager}
                                    title={
                                      manager
                                        ? undefined
                                        : "Assignment dates are set by the resource manager"
                                    }
                                    onCommit={(v) =>
                                      setData((prev) =>
                                        updateAssignmentField(
                                          prev,
                                          assignment.id,
                                          "end",
                                          v
                                        )
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              {manager && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.ghost}
                                    onClick={() =>
                                      setData((prev) =>
                                        addTaskToAssignment(prev, assignment.id)
                                      )
                                    }
                                  >
                                    Add task
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    onClick={() => {
                                      setData((prev) =>
                                        deleteAssignment(prev, assignment.id)
                                      );
                                      if (editing?.id === assignment.id) {
                                        setEditing(null);
                                      }
                                    }}
                                    title="Remove allocation"
                                  >
                                    ×
                                  </button>
                                </>
                              )}
                            </div>

                            {asgOpen && (
                              <div className={styles.tasks}>
                                {tasks.length === 0 && (
                                  <div
                                    className={`${styles.row} ${styles.emptyChild} ${styles.emptyTask}`}
                                  >
                                    No tasks
                                  </div>
                                )}
                                {tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className={`${styles.row} ${styles.taskRow}`}
                                  >
                                    <span
                                      className={styles.taskBullet}
                                      aria-hidden
                                    >
                                      ·
                                    </span>
                                    <div className={styles.taskTitle}>
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
                                      />
                                    </div>
                                    <div className={styles.taskStatus}>
                                      <EditableCell
                                        value={task.status}
                                        type="select"
                                        options={TASK_STATUSES.map((s) => ({
                                          value: s,
                                          label: s,
                                        }))}
                                        onCommit={(v) =>
                                          setData((prev) =>
                                            updateTaskField(
                                              prev,
                                              task.id,
                                              "status",
                                              v
                                            )
                                          )
                                        }
                                      />
                                    </div>
                                    <div className={styles.taskDue}>
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
                                      />
                                    </div>
                                    <div className={styles.taskDue}>
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
                                      />
                                    </div>
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
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <GanttView
          title="Schedule"
          hideToolbar
          bodyRef={ganttBodyRef}
          onBodyScroll={() => syncVertical("gantt")}
          rows={ganttRows}
          selectedBarId={manager ? editing?.id : null}
          onBarClick={
            manager
              ? (barId, anchor) => {
                  if (!data.assignments.some((a) => a.id === barId)) return;
                  setEditing({ id: barId, anchor });
                }
              : undefined
          }
        />
      </div>

      {manager && editing && editingAssignment && (
        <AssignmentEditPopover
          title={`${editingProject?.name ?? "Project"} · allocation`}
          anchor={editing.anchor}
          values={{
            projectName: editingProject?.name ?? "",
            start: editingAssignment.start,
            end: editingAssignment.end,
          }}
          onChange={(field, value) => {
            const storeField =
              field === "projectName" ? "projectName" : field;
            setData((prev) =>
              updateAssignmentField(prev, editing.id, storeField, value)
            );
          }}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setData((prev) => deleteAssignment(prev, editing.id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
