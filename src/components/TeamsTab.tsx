"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  analyzeResourceAllocation,
  formatAllocPct,
  overloadSpansInWindow,
} from "@/lib/allocation";
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

      const teamOverload = overloadSpansInWindow(
        group.allAssignments,
        ganttWindow.start,
        ganttWindow.end
      ).map((span, i) => ({
        id: `team_overload_${group.team}_${i}`,
        start: span.start,
        end: span.end,
        label: "Heavy",
        sublabel: "team load",
        kind: "overload" as const,
      }));

      out.push({
        id: `team_row_${group.team}`,
        label: group.team,
        sublabel: formatAllocPct(group.avgAllocPct),
        emphasis: true,
        bars: [...assignmentBars, ...teamOverload],
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
        const overloadBars = overloadSpansInWindow(
          m.assignments,
          ganttWindow.start,
          ganttWindow.end
        ).map((span, i) => ({
          id: `overload_${m.resource.id}_${i}`,
          start: span.start,
          end: span.end,
          label: "Heavy",
          sublabel: "double-booked",
          kind: "overload" as const,
        }));

        out.push({
          id: `member_row_${m.resource.id}`,
          label: m.resource.name,
          sublabel: formatAllocPct(m.allocation.allocPct),
          bars: [...bars, ...overloadBars],
        });
      }
    }

    return out;
  }, [teams, expanded, data.projects, data.resources, ganttWindow]);

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

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <FilterSortBar />
        <span className={styles.hint}>
          Team Gantt shows rolled-up bookings; Alloc/Busy % follow the visible
          window
        </span>
      </div>

      <div className={styles.split}>
        <div className={styles.gridPane}>
          <div className={styles.tableHeader}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.teamCol}>Team / Resource</th>
                  <th>Type</th>
                  <th className={styles.num}>People</th>
                  <th className={styles.num}>Tasks</th>
                  <th className={styles.num}>Active</th>
                  <th className={styles.num}>Todo</th>
                  <th className={styles.num}>In progress</th>
                  <th className={styles.num}>Done</th>
                  <th className={styles.num}>Alloc %</th>
                  <th className={styles.num}>Busy %</th>
                </tr>
              </thead>
            </table>
          </div>
          <div
            className={styles.tableBody}
            ref={bodyScrollRef}
            onScroll={() => syncVertical("grid")}
          >
            <table className={styles.table}>
              <tbody>
                {teams.map((group) => {
                  const open = expanded.has(group.team);
                  return (
                    <Fragment key={`team_${group.team}`}>
                      <tr className={styles.teamRow}>
                        <td className={styles.teamCol}>
                          <button
                            type="button"
                            className={styles.toggle}
                            onClick={() => toggle(group.team)}
                            aria-expanded={open}
                          >
                            {open ? "▼" : "▶"}
                          </button>
                          <span className={styles.teamName}>{group.team}</span>
                        </td>
                        <td className={styles.muted}>—</td>
                        <td className={styles.num}>{group.people}</td>
                        <td className={styles.num}>{group.taskCount}</td>
                        <td
                          className={`${styles.num} ${group.activeTasks > 0 ? styles.emphasis : ""}`}
                        >
                          {group.activeTasks}
                        </td>
                        <td className={styles.num}>
                          {group.members.reduce((s, m) => s + m.todo, 0)}
                        </td>
                        <td className={styles.num}>
                          {group.members.reduce((s, m) => s + m.inProgress, 0)}
                        </td>
                        <td className={styles.num}>
                          {group.members.reduce((s, m) => s + m.done, 0)}
                        </td>
                        <td className={styles.num}>
                          {formatAllocPct(group.avgAllocPct)}
                        </td>
                        <td
                          className={`${styles.num} ${group.avgBusyPct > 0 ? styles.busy : ""}`}
                        >
                          {formatAllocPct(group.avgBusyPct)}
                        </td>
                      </tr>
                      {open &&
                        group.members.map((m) => (
                          <tr key={m.resource.id} className={styles.memberRow}>
                            <td className={styles.teamCol}>
                              <span className={styles.toggleSpacer} />
                              <span>{m.resource.name}</span>
                            </td>
                            <td className={styles.muted}>{m.resource.type}</td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>{m.taskCount}</td>
                            <td
                              className={`${styles.num} ${m.activeTasks > 0 ? styles.emphasis : ""}`}
                            >
                              {m.activeTasks}
                            </td>
                            <td className={styles.num}>{m.todo}</td>
                            <td className={styles.num}>{m.inProgress}</td>
                            <td className={styles.num}>{m.done}</td>
                            <td className={styles.num}>
                              {formatAllocPct(m.allocation.allocPct)}
                            </td>
                            <td
                              className={`${styles.num} ${m.allocation.overloadPct > 0 ? styles.busy : ""}`}
                            >
                              {formatAllocPct(m.allocation.overloadPct)}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={10} className={styles.empty}>
                      No resources match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
