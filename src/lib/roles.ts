import type { AppData, StakeholderRole } from "./types";

export function isManager(data: AppData): boolean {
  return data.ui.stakeholderRole === "manager";
}

export function isResourceRole(data: AppData): boolean {
  return data.ui.stakeholderRole === "resource";
}

/** Resource id you are acting as (resource role only). */
export function actingAsResourceId(data: AppData): string {
  if (data.ui.stakeholderRole !== "resource") return "";
  const id = data.ui.actingAsResourceId;
  if (id && data.resources.some((r) => r.id === id)) return id;
  return data.resources[0]?.id ?? "";
}

export function actingAsResource(data: AppData) {
  const id = actingAsResourceId(data);
  return data.resources.find((r) => r.id === id) ?? null;
}

/**
 * Effective resource filter: in resource role, always the acting person;
 * otherwise the shared filterResourceId.
 */
export function effectiveResourceFilterId(data: AppData): string {
  if (isResourceRole(data)) return actingAsResourceId(data);
  return data.ui.filterResourceId;
}

export function roleLabel(role: StakeholderRole): string {
  return role === "manager" ? "Resource manager" : "Resource";
}
