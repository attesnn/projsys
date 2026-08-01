import type { AppData, Task } from "./types";

export interface ConflictTaskRef {
  taskId: string;
  title: string;
  start: string;
  end: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  assignmentId: string;
}

export interface TaskConflict {
  id: string;
  overlapStart: string;
  overlapEnd: string;
  a: ConflictTaskRef;
  b: ConflictTaskRef;
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function overlapRange(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): { start: string; end: string } {
  return {
    start: aStart > bStart ? aStart : bStart,
    end: aEnd < bEnd ? aEnd : bEnd,
  };
}

function taskRef(
  data: AppData,
  task: Task,
  projectId: string
): ConflictTaskRef {
  const project = data.projects.find((p) => p.id === projectId);
  return {
    taskId: task.id,
    title: task.title,
    start: task.start,
    end: task.end,
    projectId,
    projectName: project?.name ?? "Unknown project",
    projectNumber: project?.number ?? "",
    assignmentId: task.assignmentId,
  };
}

/** Tasks on different projects for the same resource with overlapping dates. */
export function findTaskConflictsForResource(
  data: AppData,
  resourceId: string
): TaskConflict[] {
  const entries = data.assignments
    .filter((a) => a.resourceId === resourceId)
    .flatMap((assignment) =>
      data.tasks
        .filter((t) => t.assignmentId === assignment.id)
        .map((task) => ({ task, projectId: assignment.projectId }))
    );

  const conflicts: TaskConflict[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const left = entries[i];
      const right = entries[j];
      if (left.projectId === right.projectId) continue;
      if (
        !rangesOverlap(
          left.task.start,
          left.task.end,
          right.task.start,
          right.task.end
        )
      ) {
        continue;
      }

      const overlap = overlapRange(
        left.task.start,
        left.task.end,
        right.task.start,
        right.task.end
      );

      conflicts.push({
        id: `${left.task.id}__${right.task.id}`,
        overlapStart: overlap.start,
        overlapEnd: overlap.end,
        a: taskRef(data, left.task, left.projectId),
        b: taskRef(data, right.task, right.projectId),
      });
    }
  }

  return conflicts.sort((x, y) =>
    x.overlapStart.localeCompare(y.overlapStart)
  );
}

export function resourceHasConflicts(
  data: AppData,
  resourceId: string
): boolean {
  return findTaskConflictsForResource(data, resourceId).length > 0;
}

export interface ConflictProjectGroup {
  projectId: string;
  projectName: string;
  projectNumber: string;
  tasks: {
    task: ConflictTaskRef;
    against: Array<{
      overlapStart: string;
      overlapEnd: string;
      other: ConflictTaskRef;
    }>;
  }[];
}

/** Group conflicts into project → conflicting tasks for hierarchical UI. */
export function groupConflictsByProject(
  conflicts: TaskConflict[]
): ConflictProjectGroup[] {
  const byProject = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      projectNumber: string;
      tasks: Map<
        string,
        {
          task: ConflictTaskRef;
          against: Array<{
            overlapStart: string;
            overlapEnd: string;
            other: ConflictTaskRef;
          }>;
        }
      >;
    }
  >();

  function ensureProject(ref: ConflictTaskRef) {
    let group = byProject.get(ref.projectId);
    if (!group) {
      group = {
        projectId: ref.projectId,
        projectName: ref.projectName,
        projectNumber: ref.projectNumber,
        tasks: new Map(),
      };
      byProject.set(ref.projectId, group);
    }
    return group;
  }

  function ensureTask(
    group: ReturnType<typeof ensureProject>,
    ref: ConflictTaskRef
  ) {
    let entry = group.tasks.get(ref.taskId);
    if (!entry) {
      entry = { task: ref, against: [] };
      group.tasks.set(ref.taskId, entry);
    }
    return entry;
  }

  for (const conflict of conflicts) {
    const groupA = ensureProject(conflict.a);
    const groupB = ensureProject(conflict.b);
    ensureTask(groupA, conflict.a).against.push({
      overlapStart: conflict.overlapStart,
      overlapEnd: conflict.overlapEnd,
      other: conflict.b,
    });
    ensureTask(groupB, conflict.b).against.push({
      overlapStart: conflict.overlapStart,
      overlapEnd: conflict.overlapEnd,
      other: conflict.a,
    });
  }

  return [...byProject.values()]
    .map((g) => ({
      projectId: g.projectId,
      projectName: g.projectName,
      projectNumber: g.projectNumber,
      tasks: [...g.tasks.values()].sort((a, b) =>
        a.task.start.localeCompare(b.task.start)
      ),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName));
}
