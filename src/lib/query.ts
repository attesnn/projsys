import type { AppData, Assignment, Project, SortDir, SortKey } from "./types";
import { effectiveResourceFilterId } from "./roles";

function cmp(a: string | number, b: string | number, dir: SortDir): number {
  if (a < b) return dir === "asc" ? -1 : 1;
  if (a > b) return dir === "asc" ? 1 : -1;
  return 0;
}

export function assignmentSortValue(
  data: AppData,
  assignment: Assignment,
  key: SortKey
): string | number {
  const project = data.projects.find((p) => p.id === assignment.projectId);
  const resource = data.resources.find((r) => r.id === assignment.resourceId);
  switch (key) {
    case "projectName":
      return (project?.name ?? "").toLowerCase();
    case "projectNumber":
      return (project?.number ?? "").toLowerCase();
    case "resourceName":
      return (resource?.name ?? "").toLowerCase();
    case "start":
      return assignment.start;
    case "end":
      return assignment.end;
  }
}

export function filterAssignments(
  data: AppData,
  assignments: Assignment[] = data.assignments
): Assignment[] {
  const { filterProjectId, filterResourceType } = data.ui;
  const filterResourceId = effectiveResourceFilterId(data);
  return assignments.filter((a) => {
    if (filterProjectId && a.projectId !== filterProjectId) return false;
    if (filterResourceId && a.resourceId !== filterResourceId) return false;
    if (filterResourceType) {
      const resource = data.resources.find((r) => r.id === a.resourceId);
      if (!resource || resource.type !== filterResourceType) return false;
    }
    return true;
  });
}

export function sortAssignments(
  data: AppData,
  assignments: Assignment[]
): Assignment[] {
  const { sortKey, sortDir } = data.ui;
  return [...assignments].sort((a, b) =>
    cmp(
      assignmentSortValue(data, a, sortKey),
      assignmentSortValue(data, b, sortKey),
      sortDir
    )
  );
}

export function filteredSortedAssignments(data: AppData): Assignment[] {
  return sortAssignments(data, filterAssignments(data));
}

function projectSortValue(
  data: AppData,
  project: Project,
  key: SortKey
): string | number {
  const asgs = data.assignments.filter((a) => a.projectId === project.id);
  switch (key) {
    case "projectName":
      return project.name.toLowerCase();
    case "projectNumber":
      return project.number.toLowerCase();
    case "resourceName": {
      const names = asgs
        .map(
          (a) =>
            data.resources.find((r) => r.id === a.resourceId)?.name ?? ""
        )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return (names[0] ?? "").toLowerCase();
    }
    case "start":
      return asgs.map((a) => a.start).sort()[0] ?? "9999-99-99";
    case "end":
      return (
        asgs
          .map((a) => a.end)
          .sort()
          .at(-1) ?? ""
      );
  }
}

export function filteredSortedProjects(data: AppData): Project[] {
  const { filterProjectId, filterResourceType, sortKey, sortDir } = data.ui;
  const filterResourceId = effectiveResourceFilterId(data);

  let projects = data.projects;
  if (filterProjectId) {
    projects = projects.filter((p) => p.id === filterProjectId);
  }
  if (filterResourceId) {
    const projectIds = new Set(
      data.assignments
        .filter((a) => a.resourceId === filterResourceId)
        .map((a) => a.projectId)
    );
    projects = projects.filter((p) => projectIds.has(p.id));
  }
  if (filterResourceType) {
    const typeResourceIds = new Set(
      data.resources
        .filter((r) => r.type === filterResourceType)
        .map((r) => r.id)
    );
    const projectIds = new Set(
      data.assignments
        .filter((a) => typeResourceIds.has(a.resourceId))
        .map((a) => a.projectId)
    );
    projects = projects.filter((p) => projectIds.has(p.id));
  }

  return [...projects].sort((a, b) =>
    cmp(
      projectSortValue(data, a, sortKey),
      projectSortValue(data, b, sortKey),
      sortDir
    )
  );
}

export function filterAssignmentsForProject(
  data: AppData,
  projectId: string
): Assignment[] {
  return sortAssignments(
    data,
    filterAssignments(
      data,
      data.assignments.filter((a) => a.projectId === projectId)
    )
  );
}

function resourceSortValue(
  data: AppData,
  resourceId: string,
  key: SortKey
): string | number {
  const resource = data.resources.find((r) => r.id === resourceId);
  const asgs = filterAssignments(
    data,
    data.assignments.filter((a) => a.resourceId === resourceId)
  );
  switch (key) {
    case "resourceName":
      return (resource?.name ?? "").toLowerCase();
    case "projectName": {
      const names = asgs
        .map((a) => data.projects.find((p) => p.id === a.projectId)?.name ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return (names[0] ?? "").toLowerCase();
    }
    case "projectNumber": {
      const nums = asgs
        .map(
          (a) => data.projects.find((p) => p.id === a.projectId)?.number ?? ""
        )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return (nums[0] ?? "").toLowerCase();
    }
    case "start":
      return asgs.map((a) => a.start).sort()[0] ?? "9999-99-99";
    case "end":
      return asgs.map((a) => a.end).sort().at(-1) ?? "";
  }
}

/** Resources as the baseline unit, filtered by shared project/resource/type filters. */
export function filteredSortedResources(data: AppData) {
  const { filterProjectId, filterResourceType, sortKey, sortDir } = data.ui;
  const filterResourceId = effectiveResourceFilterId(data);

  let resources = data.resources;
  if (filterResourceId) {
    resources = resources.filter((r) => r.id === filterResourceId);
  }
  if (filterResourceType) {
    resources = resources.filter((r) => r.type === filterResourceType);
  }
  if (filterProjectId) {
    const ids = new Set(
      data.assignments
        .filter((a) => a.projectId === filterProjectId)
        .map((a) => a.resourceId)
    );
    resources = resources.filter((r) => ids.has(r.id));
  }

  return [...resources].sort((a, b) =>
    cmp(
      resourceSortValue(data, a.id, sortKey),
      resourceSortValue(data, b.id, sortKey),
      sortDir
    )
  );
}

export function assignmentsForResource(
  data: AppData,
  resourceId: string
): Assignment[] {
  return sortAssignments(
    data,
    filterAssignments(
      data,
      data.assignments.filter((a) => a.resourceId === resourceId)
    )
  );
}
