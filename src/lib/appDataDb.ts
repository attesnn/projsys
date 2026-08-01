import type {
  AppData,
  AppUiState,
  EntityType,
  ResourceSkill,
  SkillLevel,
  Task,
  TaskStatus,
} from "@/lib/types";
import { DEFAULT_UI } from "@/lib/types";
import { createSeedData } from "@/lib/seed";
import { prisma } from "@/lib/db";

const UI_ID = "default";

function toAppUi(row: {
  filterProjectId: string;
  filterResourceId: string;
  filterResourceType: string;
  filterResourceTeam: string;
  sortKey: string;
  sortDir: string;
  ganttScale: string;
  stakeholderRole: string;
  actingAsResourceId: string;
} | null): AppUiState {
  if (!row) return { ...DEFAULT_UI };
  return {
    filterProjectId: row.filterProjectId,
    filterResourceId: row.filterResourceId,
    filterResourceType: row.filterResourceType,
    filterResourceTeam: row.filterResourceTeam ?? "",
    sortKey: (row.sortKey as AppUiState["sortKey"]) || DEFAULT_UI.sortKey,
    sortDir: (row.sortDir as AppUiState["sortDir"]) || DEFAULT_UI.sortDir,
    ganttScale: (row.ganttScale as AppUiState["ganttScale"]) || DEFAULT_UI.ganttScale,
    stakeholderRole:
      (row.stakeholderRole as AppUiState["stakeholderRole"]) ||
      DEFAULT_UI.stakeholderRole,
    actingAsResourceId: row.actingAsResourceId,
  };
}

export async function loadAppDataFromDb(): Promise<AppData> {
  const [
    projects,
    resources,
    skills,
    resourceSkills,
    assignments,
    tasks,
    changeLog,
    uiRow,
  ] = await Promise.all([
    prisma.project.findMany(),
    prisma.resource.findMany(),
    prisma.skill.findMany(),
    prisma.resourceSkill.findMany(),
    prisma.assignment.findMany(),
    prisma.task.findMany(),
    prisma.changeLogEntry.findMany(),
    prisma.uiState.findUnique({ where: { id: UI_ID } }),
  ]);

  return {
    version: 1,
    projects,
    resources,
    skills,
    resourceSkills: resourceSkills.map(
      (rs): ResourceSkill => ({
        ...rs,
        level: rs.level as SkillLevel,
      })
    ),
    assignments,
    tasks: tasks.map(
      (t): Task => ({
        ...t,
        status: t.status as TaskStatus,
      })
    ),
    changeLog: changeLog.map((e) => ({
      ...e,
      entityType: e.entityType as EntityType,
    })),
    ui: toAppUi(uiRow),
  };
}

export async function saveAppDataToDb(data: AppData): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany();
    await tx.changeLogEntry.deleteMany();
    await tx.assignment.deleteMany();
    await tx.resourceSkill.deleteMany();
    await tx.project.deleteMany();
    await tx.resource.deleteMany();
    await tx.skill.deleteMany();
    await tx.uiState.deleteMany();

    if (data.projects.length) {
      await tx.project.createMany({ data: data.projects });
    }
    if (data.resources.length) {
      await tx.resource.createMany({ data: data.resources });
    }
    if (data.skills.length) {
      await tx.skill.createMany({ data: data.skills });
    }
    if (data.resourceSkills.length) {
      await tx.resourceSkill.createMany({ data: data.resourceSkills });
    }
    if (data.assignments.length) {
      await tx.assignment.createMany({ data: data.assignments });
    }
    if (data.tasks.length) {
      await tx.task.createMany({ data: data.tasks });
    }
    if (data.changeLog.length) {
      await tx.changeLogEntry.createMany({ data: data.changeLog });
    }

    await tx.uiState.create({
      data: {
        id: UI_ID,
        filterProjectId: data.ui.filterProjectId,
        filterResourceId: data.ui.filterResourceId,
        filterResourceType: data.ui.filterResourceType,
        filterResourceTeam: data.ui.filterResourceTeam,
        sortKey: data.ui.sortKey,
        sortDir: data.ui.sortDir,
        ganttScale: data.ui.ganttScale,
        stakeholderRole: data.ui.stakeholderRole,
        actingAsResourceId: data.ui.actingAsResourceId,
      },
    });
  });
}

export async function isAppDataEmpty(): Promise<boolean> {
  const count = await prisma.project.count();
  return count === 0;
}

export async function ensureSeededAppData(): Promise<AppData> {
  if (await isAppDataEmpty()) {
    const seed = createSeedData();
    await saveAppDataToDb(seed);
    return seed;
  }
  return loadAppDataFromDb();
}

export async function resetAppDataInDb(): Promise<AppData> {
  const seed = createSeedData();
  await saveAppDataToDb(seed);
  return seed;
}
