import type { AppData } from "./types";
import { createSeedData } from "./seed";
import { createId } from "./id";
import { DEFAULT_UI } from "./types";
import type {
  Assignment,
  ChangeLogEntry,
  EntityType,
  GanttScale,
  Project,
  Resource,
  ResourceSkill,
  Skill,
  SkillLevel,
  SortDir,
  SortKey,
  StakeholderRole,
  Task,
  TaskStatus,
} from "./types";
import { GANTT_SCALES, STAKEHOLDER_ROLES } from "./types";

export const STORAGE_KEY = "projsys_v1";

function normalizeUi(ui: Partial<AppData["ui"]> | undefined): AppData["ui"] {
  const sortKey = ui?.sortKey;
  const validSortKeys: SortKey[] = [
    "projectName",
    "projectNumber",
    "resourceName",
    "start",
    "end",
  ];
  const ganttScale = ui?.ganttScale;
  const stakeholderRole = ui?.stakeholderRole;
  return {
    filterProjectId: ui?.filterProjectId ?? "",
    filterResourceId: ui?.filterResourceId ?? "",
    filterResourceType: ui?.filterResourceType ?? "",
    sortKey:
      sortKey && validSortKeys.includes(sortKey as SortKey)
        ? (sortKey as SortKey)
        : DEFAULT_UI.sortKey,
    sortDir: ui?.sortDir ?? DEFAULT_UI.sortDir,
    ganttScale:
      ganttScale && (GANTT_SCALES as string[]).includes(ganttScale)
        ? ganttScale
        : DEFAULT_UI.ganttScale,
    stakeholderRole:
      stakeholderRole &&
      (STAKEHOLDER_ROLES as string[]).includes(stakeholderRole)
        ? stakeholderRole
        : DEFAULT_UI.stakeholderRole,
    actingAsResourceId: ui?.actingAsResourceId ?? "",
  };
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return createSeedData();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || parsed.version !== 1) return createSeedData();
    return {
      ...createSeedData(),
      ...parsed,
      tasks: (parsed.tasks ?? []).map(migrateTask),
      resources: (parsed.resources ?? []).map(migrateResource),
      assignments: (parsed.assignments ?? []).map(migrateAssignment),
      ui: normalizeUi(parsed.ui),
    };
  } catch {
    return createSeedData();
  }
}

/** Migrate legacy tasks that only had `due` into start/end. */
function migrateTask(task: Task & { due?: string }): Task {
  if (task.start && task.end) {
    return {
      id: task.id,
      assignmentId: task.assignmentId,
      title: task.title,
      status: task.status,
      start: task.start,
      end: task.end,
    };
  }
  const due = task.due ?? task.end ?? task.start ?? new Date().toISOString().slice(0, 10);
  return {
    id: task.id,
    assignmentId: task.assignmentId,
    title: task.title,
    status: task.status,
    start: task.start ?? due,
    end: task.end ?? due,
  };
}

function migrateResource(resource: Resource & { notes?: string }): Resource {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    notes: resource.notes ?? "",
  };
}

/** Drop legacy allocationPct from assignments. */
function migrateAssignment(
  assignment: Assignment & { allocationPct?: number }
): Assignment {
  return {
    id: assignment.id,
    projectId: assignment.projectId,
    resourceId: assignment.resourceId,
    start: assignment.start,
    end: assignment.end,
  };
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function appendLog(
  data: AppData,
  entityType: EntityType,
  entityId: string,
  field: string,
  oldValue: string,
  newValue: string
): AppData {
  if (oldValue === newValue) return data;
  const entry: ChangeLogEntry = {
    id: createId("log"),
    entityType,
    entityId,
    field,
    oldValue,
    newValue,
    at: new Date().toISOString(),
  };
  return { ...data, changeLog: [entry, ...data.changeLog] };
}

export function getHistoryFor(
  data: AppData,
  entityType: EntityType,
  entityId: string,
  field?: string
): ChangeLogEntry[] {
  return data.changeLog.filter(
    (e) =>
      e.entityType === entityType &&
      e.entityId === entityId &&
      (field === undefined || e.field === field)
  );
}

function ensureProject(
  data: AppData,
  name: string,
  number: string
): { data: AppData; projectId: string } {
  const existing = data.projects.find(
    (p) => p.name === name && p.number === number
  );
  if (existing) return { data, projectId: existing.id };

  const byNumber = data.projects.find((p) => p.number === number && number);
  if (byNumber) {
    let next = data;
    if (byNumber.name !== name) {
      next = appendLog(next, "project", byNumber.id, "name", byNumber.name, name);
      next = {
        ...next,
        projects: next.projects.map((p) =>
          p.id === byNumber.id ? { ...p, name } : p
        ),
      };
    }
    return { data: next, projectId: byNumber.id };
  }

  const byName = data.projects.find((p) => p.name === name && name);
  if (byName) {
    let next = data;
    if (byName.number !== number) {
      next = appendLog(
        next,
        "project",
        byName.id,
        "number",
        byName.number,
        number
      );
      next = {
        ...next,
        projects: next.projects.map((p) =>
          p.id === byName.id ? { ...p, number } : p
        ),
      };
    }
    return { data: next, projectId: byName.id };
  }

  const project: Project = {
    id: createId("proj"),
    name: name || "Untitled project",
    number: number || "",
  };
  return {
    data: { ...data, projects: [...data.projects, project] },
    projectId: project.id,
  };
}

function ensureResource(
  data: AppData,
  name: string,
  type: string
): { data: AppData; resourceId: string } {
  const existing = data.resources.find((r) => r.name === name);
  if (existing) {
    let next = data;
    if (existing.type !== type) {
      next = appendLog(
        next,
        "resource",
        existing.id,
        "type",
        existing.type,
        type
      );
      next = {
        ...next,
        resources: next.resources.map((r) =>
          r.id === existing.id ? { ...r, type } : r
        ),
      };
    }
    return { data: next, resourceId: existing.id };
  }

  const resource: Resource = {
    id: createId("res"),
    name: name || "Unnamed resource",
    type: type || "",
    notes: "",
  };
  return {
    data: { ...data, resources: [...data.resources, resource] },
    resourceId: resource.id,
  };
}

export type AssignmentField =
  | "projectName"
  | "projectNumber"
  | "resourceName"
  | "resourceType"
  | "start"
  | "end";

export function updateAssignmentField(
  data: AppData,
  assignmentId: string,
  field: AssignmentField,
  value: string
): AppData {
  const assignment = data.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return data;

  const project = data.projects.find((p) => p.id === assignment.projectId);
  const resource = data.resources.find((r) => r.id === assignment.resourceId);
  if (!project || !resource) return data;

  let next = data;

  switch (field) {
    case "projectName": {
      next = appendLog(
        next,
        "assignment",
        assignmentId,
        "projectName",
        project.name,
        value
      );
      const ensured = ensureProject(next, value, project.number);
      next = ensured.data;
      next = {
        ...next,
        assignments: next.assignments.map((a) =>
          a.id === assignmentId ? { ...a, projectId: ensured.projectId } : a
        ),
      };
      break;
    }
    case "projectNumber": {
      next = appendLog(
        next,
        "assignment",
        assignmentId,
        "projectNumber",
        project.number,
        value
      );
      const ensured = ensureProject(next, project.name, value);
      next = ensured.data;
      next = {
        ...next,
        assignments: next.assignments.map((a) =>
          a.id === assignmentId ? { ...a, projectId: ensured.projectId } : a
        ),
      };
      break;
    }
    case "resourceName": {
      next = appendLog(
        next,
        "assignment",
        assignmentId,
        "resourceName",
        resource.name,
        value
      );
      const ensured = ensureResource(next, value, resource.type);
      next = ensured.data;
      next = {
        ...next,
        assignments: next.assignments.map((a) =>
          a.id === assignmentId ? { ...a, resourceId: ensured.resourceId } : a
        ),
      };
      break;
    }
    case "resourceType": {
      next = appendLog(
        next,
        "assignment",
        assignmentId,
        "resourceType",
        resource.type,
        value
      );
      next = appendLog(next, "resource", resource.id, "type", resource.type, value);
      next = {
        ...next,
        resources: next.resources.map((r) =>
          r.id === resource.id ? { ...r, type: value } : r
        ),
      };
      break;
    }
    case "start":
    case "end": {
      const oldValue = assignment[field];
      next = appendLog(next, "assignment", assignmentId, field, oldValue, value);
      next = {
        ...next,
        assignments: next.assignments.map((a) =>
          a.id === assignmentId ? { ...a, [field]: value } : a
        ),
      };
      break;
    }
  }

  return next;
}

export function addAssignment(data: AppData): AppData {
  const project = data.projects[0] ?? {
    id: createId("proj"),
    name: "New project",
    number: "P-0000",
  };
  const resource = data.resources[0] ?? {
    id: createId("res"),
    name: "New resource",
    type: "Unassigned",
    notes: "",
  };

  let next = data;
  if (!data.projects[0]) {
    next = { ...next, projects: [...next.projects, project] };
  }
  if (!data.resources[0]) {
    next = { ...next, resources: [...next.resources, resource] };
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);
  const end = endDate.toISOString().slice(0, 10);

  const assignment: Assignment = {
    id: createId("asg"),
    projectId: project.id,
    resourceId: resource.id,
    start,
    end,
  };

  next = appendLog(next, "assignment", assignment.id, "_created", "", "true");
  return { ...next, assignments: [...next.assignments, assignment] };
}

export function deleteAssignment(data: AppData, assignmentId: string): AppData {
  let next = appendLog(data, "assignment", assignmentId, "_deleted", "true", "");
  next = {
    ...next,
    assignments: next.assignments.filter((a) => a.id !== assignmentId),
    tasks: next.tasks.filter((t) => t.assignmentId !== assignmentId),
  };
  return next;
}

export function setFilterProjectId(data: AppData, filterProjectId: string): AppData {
  return { ...data, ui: { ...data.ui, filterProjectId } };
}

export function setFilterResourceId(
  data: AppData,
  filterResourceId: string
): AppData {
  return { ...data, ui: { ...data.ui, filterResourceId } };
}

export function setFilterResourceType(
  data: AppData,
  filterResourceType: string
): AppData {
  return { ...data, ui: { ...data.ui, filterResourceType } };
}

export function setSort(
  data: AppData,
  sortKey: SortKey,
  sortDir?: SortDir
): AppData {
  return {
    ...data,
    ui: {
      ...data.ui,
      sortKey,
      sortDir: sortDir ?? data.ui.sortDir,
    },
  };
}

export function toggleSortDir(data: AppData): AppData {
  return {
    ...data,
    ui: {
      ...data.ui,
      sortDir: data.ui.sortDir === "asc" ? "desc" : "asc",
    },
  };
}

export function clearFilters(data: AppData): AppData {
  return {
    ...data,
    ui: {
      ...data.ui,
      filterProjectId: "",
      filterResourceId: "",
      filterResourceType: "",
    },
  };
}

export function setGanttScale(data: AppData, ganttScale: GanttScale): AppData {
  return { ...data, ui: { ...data.ui, ganttScale } };
}

export function setStakeholderRole(
  data: AppData,
  stakeholderRole: StakeholderRole,
  actingAsResourceId?: string
): AppData {
  const nextId =
    stakeholderRole === "resource"
      ? actingAsResourceId ||
        data.ui.actingAsResourceId ||
        data.resources[0]?.id ||
        ""
      : data.ui.actingAsResourceId;
  return {
    ...data,
    ui: {
      ...data.ui,
      stakeholderRole,
      actingAsResourceId: nextId,
    },
  };
}

export function setActingAsResourceId(
  data: AppData,
  actingAsResourceId: string
): AppData {
  return {
    ...data,
    ui: {
      ...data.ui,
      stakeholderRole: "resource",
      actingAsResourceId,
    },
  };
}

export function addResource(data: AppData): AppData {
  const resource: Resource = {
    id: createId("res"),
    name: "New resource",
    type: "Unassigned",
    notes: "",
  };
  let next = appendLog(data, "resource", resource.id, "_created", "", resource.name);
  return { ...next, resources: [...next.resources, resource] };
}

export function updateResourceField(
  data: AppData,
  resourceId: string,
  field: "name" | "type" | "notes",
  value: string
): AppData {
  const resource = data.resources.find((r) => r.id === resourceId);
  if (!resource) return data;
  const oldValue = resource[field];
  if (oldValue === value) return data;
  let next = appendLog(data, "resource", resourceId, field, oldValue, value);
  next = {
    ...next,
    resources: next.resources.map((r) =>
      r.id === resourceId ? { ...r, [field]: value } : r
    ),
  };
  return next;
}

export function deleteResource(data: AppData, resourceId: string): AppData {
  const assignmentIds = new Set(
    data.assignments
      .filter((a) => a.resourceId === resourceId)
      .map((a) => a.id)
  );
  let next = appendLog(data, "resource", resourceId, "_deleted", "true", "");
  next = {
    ...next,
    resources: next.resources.filter((r) => r.id !== resourceId),
    resourceSkills: next.resourceSkills.filter(
      (rs) => rs.resourceId !== resourceId
    ),
    assignments: next.assignments.filter((a) => a.resourceId !== resourceId),
    tasks: next.tasks.filter((t) => !assignmentIds.has(t.assignmentId)),
  };
  return next;
}

export function addAssignmentForResource(
  data: AppData,
  resourceId: string
): AppData {
  if (!data.resources.some((r) => r.id === resourceId)) return data;
  const project = data.projects[0] ?? {
    id: createId("proj"),
    name: "New project",
    number: "P-0000",
  };

  let next = data;
  if (!data.projects[0]) {
    next = { ...next, projects: [...next.projects, project] };
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const assignment: Assignment = {
    id: createId("asg"),
    projectId: project.id,
    resourceId,
    start: today.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };

  next = appendLog(next, "assignment", assignment.id, "_created", "", "true");
  return { ...next, assignments: [...next.assignments, assignment] };
}

export function updateResourceSkillLevel(
  data: AppData,
  resourceId: string,
  skillId: string,
  level: SkillLevel | ""
): AppData {
  const existing = data.resourceSkills.find(
    (rs) => rs.resourceId === resourceId && rs.skillId === skillId
  );

  if (!level) {
    if (!existing) return data;
    let next = appendLog(
      data,
      "resourceSkill",
      existing.id,
      "level",
      existing.level,
      ""
    );
    next = {
      ...next,
      resourceSkills: next.resourceSkills.filter((rs) => rs.id !== existing.id),
    };
    return next;
  }

  if (existing) {
    if (existing.level === level) return data;
    let next = appendLog(
      data,
      "resourceSkill",
      existing.id,
      "level",
      existing.level,
      level
    );
    next = {
      ...next,
      resourceSkills: next.resourceSkills.map((rs) =>
        rs.id === existing.id ? { ...rs, level } : rs
      ),
    };
    return next;
  }

  const rs: ResourceSkill = {
    id: createId("rs"),
    resourceId,
    skillId,
    level,
    notes: "",
  };
  let next = appendLog(data, "resourceSkill", rs.id, "level", "", level);
  return { ...next, resourceSkills: [...next.resourceSkills, rs] };
}

export function addSkill(data: AppData, name: string, category = "General"): AppData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  if (data.skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return data;
  }
  const skill: Skill = {
    id: createId("sk"),
    name: trimmed,
    category,
  };
  let next = appendLog(data, "skill", skill.id, "_created", "", trimmed);
  return { ...next, skills: [...next.skills, skill] };
}

export function removeSkill(data: AppData, skillId: string): AppData {
  let next = appendLog(data, "skill", skillId, "_deleted", "true", "");
  next = {
    ...next,
    skills: next.skills.filter((s) => s.id !== skillId),
    resourceSkills: next.resourceSkills.filter((rs) => rs.skillId !== skillId),
  };
  return next;
}

export function updateTaskField(
  data: AppData,
  taskId: string,
  field: "title" | "status" | "start" | "end",
  value: string
): AppData {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return data;
  const oldValue = String(task[field]);
  if (oldValue === value) return data;

  let next = appendLog(data, "task", taskId, field, oldValue, value);
  next = {
    ...next,
    tasks: next.tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (field === "status") return { ...t, status: value as TaskStatus };
      return { ...t, [field]: value };
    }),
  };
  return next;
}

export function addTask(data: AppData): AppData {
  const assignment = data.assignments[0];
  if (!assignment) return data;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);

  const task: Task = {
    id: createId("task"),
    assignmentId: assignment.id,
    title: "New task",
    status: "Todo",
    start: today.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };

  let next = appendLog(data, "task", task.id, "_created", "", task.title);
  return { ...next, tasks: [...next.tasks, task] };
}

export function deleteTask(data: AppData, taskId: string): AppData {
  let next = appendLog(data, "task", taskId, "_deleted", "true", "");
  next = { ...next, tasks: next.tasks.filter((t) => t.id !== taskId) };
  return next;
}

export function updateTaskAssignment(
  data: AppData,
  taskId: string,
  assignmentId: string
): AppData {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.assignmentId === assignmentId) return data;
  let next = appendLog(
    data,
    "task",
    taskId,
    "assignmentId",
    task.assignmentId,
    assignmentId
  );
  next = {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === taskId ? { ...t, assignmentId } : t
    ),
  };
  return next;
}

export function updateProjectField(
  data: AppData,
  projectId: string,
  field: "name" | "number",
  value: string
): AppData {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return data;
  const oldValue = project[field];
  if (oldValue === value) return data;
  let next = appendLog(data, "project", projectId, field, oldValue, value);
  next = {
    ...next,
    projects: next.projects.map((p) =>
      p.id === projectId ? { ...p, [field]: value } : p
    ),
  };
  return next;
}

export function addProject(data: AppData): AppData {
  const project: Project = {
    id: createId("proj"),
    name: "New project",
    number: `P-${String(data.projects.length + 1000).padStart(4, "0")}`,
  };
  let next = appendLog(data, "project", project.id, "_created", "", project.name);
  return { ...next, projects: [...next.projects, project] };
}

export function addTaskToAssignment(
  data: AppData,
  assignmentId: string
): AppData {
  if (!data.assignments.some((a) => a.id === assignmentId)) return data;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);

  const task: Task = {
    id: createId("task"),
    assignmentId,
    title: "New task",
    status: "Todo",
    start: today.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };

  let next = appendLog(data, "task", task.id, "_created", "", task.title);
  return { ...next, tasks: [...next.tasks, task] };
}

export function resetToSeed(): AppData {
  const seed = createSeedData();
  saveAppData(seed);
  return seed;
}
