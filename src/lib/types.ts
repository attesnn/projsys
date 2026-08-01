export type SkillLevel = "1" | "2" | "3" | "4" | "5";

export type TaskStatus = "Todo" | "In progress" | "Done";

export type EntityType =
  | "project"
  | "resource"
  | "assignment"
  | "skill"
  | "resourceSkill"
  | "task";

export interface Project {
  id: string;
  name: string;
  number: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  /** Organizational team (e.g. Quay & Civil). */
  team: string;
  notes: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface ResourceSkill {
  id: string;
  resourceId: string;
  skillId: string;
  level: SkillLevel;
  notes: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  resourceId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface Task {
  id: string;
  assignmentId: string;
  title: string;
  status: TaskStatus;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface ChangeLogEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  at: string; // ISO timestamp
}

export type SortKey =
  | "projectName"
  | "projectNumber"
  | "resourceName"
  | "start"
  | "end";

export type SortDir = "asc" | "desc";

export type GanttScale = "week" | "month" | "quarter" | "year";

export const GANTT_SCALES: GanttScale[] = ["week", "month", "quarter", "year"];

/** Demo stakeholder persona — not real auth. */
export type StakeholderRole = "manager" | "resource";

export const STAKEHOLDER_ROLES: StakeholderRole[] = ["manager", "resource"];

export interface AppUiState {
  filterProjectId: string;
  filterResourceId: string;
  filterResourceType: string;
  filterResourceTeam: string;
  sortKey: SortKey;
  sortDir: SortDir;
  ganttScale: GanttScale;
  /** Who you are "acting as" in the demo. */
  stakeholderRole: StakeholderRole;
  /** When role is resource, which person you are. "" = unset. */
  actingAsResourceId: string;
}

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "projectName", label: "Project name" },
  { value: "projectNumber", label: "Project #" },
  { value: "resourceName", label: "Resource name" },
  { value: "start", label: "Start date" },
  { value: "end", label: "End date" },
];

export const DEFAULT_UI: AppUiState = {
  filterProjectId: "",
  filterResourceId: "",
  filterResourceType: "",
  filterResourceTeam: "",
  sortKey: "projectName",
  sortDir: "asc",
  ganttScale: "month",
  stakeholderRole: "manager",
  actingAsResourceId: "",
};

export interface AppData {
  version: 1;
  projects: Project[];
  resources: Resource[];
  skills: Skill[];
  resourceSkills: ResourceSkill[];
  assignments: Assignment[];
  tasks: Task[];
  changeLog: ChangeLogEntry[];
  ui: AppUiState;
}

export type TabId =
  | "projects"
  | "allocations"
  | "available"
  | "teams"
  | "skills"
  | "tasks";

export const SKILL_LEVELS: SkillLevel[] = ["1", "2", "3", "4", "5"];

export const TASK_STATUSES: TaskStatus[] = ["Todo", "In progress", "Done"];

/** Special project used for leave / time-off stints in seed and Gantt coloring. */
export const TIME_OFF_PROJECT_ID = "proj_timeoff";
