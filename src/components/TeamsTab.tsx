"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { analyzeResourceAllocation, formatAllocPct } from "@/lib/allocation";
import { assignmentsForResource, filteredSortedResources } from "@/lib/query";
import { formatDate } from "@/lib/dates";
import { FilterSortBar } from "./FilterSortBar";
import {
  GanttView,
  projectBarColor,
  type GanttBar,
  type GanttRow,
} from "./GanttView";
import styles from "./TeamsTab.module.css";

const COLS = [
  { id: "name", label: "Team / Resource", width: 220 },
  { id: "type", label: "Role", width: 130 },
  { id: "people", label: "People", width: 64 },
  { id: "tasks", label: "Tasks", width: 64 },
  { id: "active", label: "Active", width: 64 },
  { id: "todo", label: "Todo", width: 56 },
  { id: "inProgress", label: "In prog", width: 64 },
  { id: "done", label: "Done", width: 56 },
  { id: "alloc", label: "Alloc %", width: 64 },
  { id: "busy", label: "Busy %", width: 64 },
] as const;

function defaultWindow() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

export function TeamsTab() {
  const { data } = useStore();
  /** Empty = all teams collapsed (team-level Gantt first). */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [ganttWindow, setGanttWindow] = useState(defaultWindow);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);

  const onRangeChange = useCallback((range: { start: string; end: string }) => {
    setGanttWindow((prev) =>
      prev.start === range.start && prev.end === range.end ? prev : range
    );
  }, []);

  const teams = useMemo(() => {
    const resources = filteredSortedResources(data);
    const byTeam = new Map<string, typeof resources>();

    for (const resource of resources) {
      const key = resource.team.trim() || "Unassigned";
      const list = byTeam.get(key) ?? [];
      list.push(resource);
      byTeam.set(key, list);
    }

    return [...byTeam.entries()]
      .sort(([a], [b]) => {
        if (a === "Unassigned") return 1;
        if (b === "Unassigned") return -1;
        return a.localeCompare(b);
      })
      .map(([team, members]) => {
        const memberRows = members.map((resource) => {
          const assignments = assignmentsForResource(data, resource.id);
          const assignmentIds = new Set(assignments.map((a) => a.id));
          const tasks = data.tasks.filter((t) =>
            assignmentIds.has(t.assignmentId)
          );
          const todo = tasks.filter((t) => t.status === "Todo").length;
          const inProgress = tasks.filter(
            (t) => t.status === "In progress"
          ).length;
          const done = tasks.filter((t) => t.status === "Done").length;
          const activeTasks = todo + inProgress;
          const allocation = analyzeResourceAllocation(
            assignments,
            ganttWindow.start,
            ganttWindow.end
          );
          return {
            resource,
            assignments,
            taskCount: tasks.length,
            todo,
            inProgress,
            done,
            activeTasks,
            allocation,
          };
        });

        const taskCount = memberRows.reduce((s, r) => s + r.taskCount, 0);
        const activeTasks = memberRows.reduce((s, r) => s + r.activeTasks, 0);
        const allocSum = memberRows.reduce(
          (s, r) => s + r.allocation.allocPct,
          0
        );
        const busySum = memberRows.reduce(
          (s, r) => s + r.allocation.overloadPct,
          0
        );
        const n = memberRows.length || 1;
        const allAssignments = memberRows.flatMap((m) => m.assignments);

        return {
          team,
          members: memberRows.sort(
            (a, b) =>
              b.activeTasks - a.activeTasks ||
              a.resource.name.localeCompare(b.resource.name)
          ),
          allAssignments,
          people: memberRows.length,
          taskCount,
          activeTasks,
          todo: memberRows.reduce((s, m) => s + m.todo, 0),
          inProgress: memberRows.reduce((s, m) => s + m.inProgress, 0),
          done: memberRows.reduce((s, m) => s + m.done, 0),
          avgAllocPct: allocSum / n,
          avgBusyPct: busySum / n,
        };
      })
      .sort(
        (a, b) => b.activeTasks - a.activeTasks || a.team.localeCompare(b.team)
      );
  }, [data, ganttWindow]);

  const ganttRows = useMemo((): GanttRow[] => {
    const out: GanttRow[] = [];

    for (const group of teams) {
      const assignmentBars: GanttBar[] = group.allAssignments.map((a) => {
        const project = data.projects.find((p) => p.id === a.projectId);
        const projectIndex = data.projects.findIndex(
          (p) => p.id === a.projectId
        );
        const resource = data.resources.find((r) => r.id === a.resourceId);
        return {
          id: `team_${group.team}_${a.id}`,
          start: a.start,
          end: a.end,
          label: project?.name ?? "Project",
          sublabel: resource?.name,
          color: projectBarColor(a.projectId, projectIndex),
          kind: "assignment",
        };
      });

      out.push({
        id: `team_row_${group.team}`,
        label: group.team,
        sublabel: formatAllocPct(group.avgAllocPct),
        emphasis: true,
        bars: assignmentBars,
      });

      if (!expanded.has(group.team)) continue;

      for (const m of group.members) {
        const bars: GanttBar[] = m.assignments.map((a) => {
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
          };
        });

        out.push({
          id: `member_row_${m.resource.id}`,
          label: m.resource.name,
          sublabel: formatAllocPct(m.allocation.allocPct),
          bars,
        });
      }
    }

    return out;
  }, [teams, expanded, data.projects, data.resources]);

  function syncVertical(source: "grid" | "gantt") {
    const grid = bodyScrollRef.current;
    const gantt = ganttBodyRef.current;
    if (!grid || !gantt) return;
    if (source === "grid") gantt.scrollTop = grid.scrollTop;
    else grid.scrollTop = gantt.scrollTop;
  }

  function toggle(team: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(teams.map((t) => t.team)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  /** Teams only have one expandable level (team → people). */
  function collapseOneLevel() {
    setExpanded(new Set());
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
                className={`${styles.th} ${col.id !== "name" && col.id !== "type" ? styles.num : ""}`}
                style={{ width: col.width, minWidth: col.width }}
              >
                {col.label}
              </div>
            ))}
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
            {teams.length === 0 ? (
              <div className={styles.empty}>
                No resources match the current filters.
              </div>
            ) : (
              teams.map((group) => {
                const open = expanded.has(group.team);
                return (
                  <div key={`team_${group.team}`} className={styles.block}>
                    <div className={`${styles.tr} ${styles.teamRow}`}>
                      <div
                        className={styles.td}
                        style={{
                          width: COLS[0].width,
                          minWidth: COLS[0].width,
                        }}
                      >
                        <button
                          type="button"
                          className={styles.toggle}
                          onClick={() => toggle(group.team)}
                          aria-expanded={open}
                        >
                          {open ? "▼" : "▶"}
                        </button>
                        <span className={styles.teamName}>{group.team}</span>
                      </div>
                      <div
                        className={`${styles.td} ${styles.muted}`}
                        style={{
                          width: COLS[1].width,
                          minWidth: COLS[1].width,
                        }}
                      >
                        —
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[2].width,
                          minWidth: COLS[2].width,
                        }}
                      >
                        {group.people}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[3].width,
                          minWidth: COLS[3].width,
                        }}
                      >
                        {group.taskCount}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num} ${group.activeTasks > 0 ? styles.emphasis : ""}`}
                        style={{
                          width: COLS[4].width,
                          minWidth: COLS[4].width,
                        }}
                      >
                        {group.activeTasks}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[5].width,
                          minWidth: COLS[5].width,
                        }}
                      >
                        {group.todo}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[6].width,
                          minWidth: COLS[6].width,
                        }}
                      >
                        {group.inProgress}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[7].width,
                          minWidth: COLS[7].width,
                        }}
                      >
                        {group.done}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num}`}
                        style={{
                          width: COLS[8].width,
                          minWidth: COLS[8].width,
                        }}
                      >
                        {formatAllocPct(group.avgAllocPct)}
                      </div>
                      <div
                        className={`${styles.td} ${styles.num} ${group.avgBusyPct > 0 ? styles.busy : ""}`}
                        style={{
                          width: COLS[9].width,
                          minWidth: COLS[9].width,
                        }}
                      >
                        {formatAllocPct(group.avgBusyPct)}
                      </div>
                    </div>

                    {open &&
                      group.members.map((m) => (
                        <div
                          key={m.resource.id}
                          className={`${styles.tr} ${styles.memberRow}`}
                        >
                          <div
                            className={styles.td}
                            style={{
                              width: COLS[0].width,
                              minWidth: COLS[0].width,
                            }}
                          >
                            <span className={styles.toggleSpacer} />
                            <span className={styles.memberName}>
                              {m.resource.name}
                            </span>
                          </div>
                          <div
                            className={`${styles.td} ${styles.muted}`}
                            style={{
                              width: COLS[1].width,
                              minWidth: COLS[1].width,
                            }}
                          >
                            {m.resource.type}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num} ${styles.muted}`}
                            style={{
                              width: COLS[2].width,
                              minWidth: COLS[2].width,
                            }}
                          >
                            —
                          </div>
                          <div
                            className={`${styles.td} ${styles.num}`}
                            style={{
                              width: COLS[3].width,
                              minWidth: COLS[3].width,
                            }}
                          >
                            {m.taskCount}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num} ${m.activeTasks > 0 ? styles.emphasis : ""}`}
                            style={{
                              width: COLS[4].width,
                              minWidth: COLS[4].width,
                            }}
                          >
                            {m.activeTasks}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num}`}
                            style={{
                              width: COLS[5].width,
                              minWidth: COLS[5].width,
                            }}
                          >
                            {m.todo}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num}`}
                            style={{
                              width: COLS[6].width,
                              minWidth: COLS[6].width,
                            }}
                          >
                            {m.inProgress}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num}`}
                            style={{
                              width: COLS[7].width,
                              minWidth: COLS[7].width,
                            }}
                          >
                            {m.done}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num}`}
                            style={{
                              width: COLS[8].width,
                              minWidth: COLS[8].width,
                            }}
                          >
                            {formatAllocPct(m.allocation.allocPct)}
                          </div>
                          <div
                            className={`${styles.td} ${styles.num} ${m.allocation.overloadPct > 0 ? styles.busy : ""}`}
                            style={{
                              width: COLS[9].width,
                              minWidth: COLS[9].width,
                            }}
                          >
                            {formatAllocPct(m.allocation.overloadPct)}
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <GanttView
          title="Team allocation"
          bodyRef={ganttBodyRef}
          onBodyScroll={() => syncVertical("gantt")}
          onRangeChange={onRangeChange}
          rows={ganttRows}
        />
      </div>
    </div>
  );
}
