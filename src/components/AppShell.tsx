"use client";

import { useEffect, useState } from "react";
import type { TabId } from "@/lib/types";
import { useStore } from "@/context/StoreContext";
import { isManager, isResourceRole, actingAsResource } from "@/lib/roles";
import { ProjectsTab } from "./ProjectsTab";
import { ResourcesTab } from "./ResourcesTab";
import { AvailableResourcesTab } from "./AvailableResourcesTab";
import { SkillsTab } from "./SkillsTab";
import { TasksTab } from "./TasksTab";
import { StakeholderSwitcher } from "./StakeholderSwitcher";
import styles from "./AppShell.module.css";

const MANAGER_TABS: { id: TabId; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "allocations", label: "Resource allocation" },
  { id: "available", label: "Available resources" },
  { id: "skills", label: "Skills" },
  { id: "tasks", label: "Tasks" },
];

const RESOURCE_TABS: { id: TabId; label: string }[] = [
  { id: "allocations", label: "My schedule" },
  { id: "projects", label: "My projects" },
  { id: "tasks", label: "My tasks" },
];

export function AppShell() {
  const [tab, setTab] = useState<TabId>("allocations");
  const { data, reset } = useStore();
  const manager = isManager(data);
  const resource = isResourceRole(data);
  const me = actingAsResource(data);
  const tabs = manager ? MANAGER_TABS : RESOURCE_TABS;
  const allowed = new Set(tabs.map((t) => t.id));

  useEffect(() => {
    if (!allowed.has(tab)) {
      setTab(tabs[0]?.id ?? "allocations");
    }
  }, [manager, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark}>Projsys</span>
          <span className={styles.sub}>
            {manager
              ? "Resource management"
              : me
                ? `Working as ${me.name}`
                : "Resource view"}
          </span>
        </div>
        <nav className={styles.tabs} aria-label="Main">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${tab === t.id ? styles.active : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <StakeholderSwitcher />
        {manager && (
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              if (
                window.confirm(
                  "Reset all data to the demo seed? This clears local changes."
                )
              ) {
                reset();
              }
            }}
            title="Reset demo data"
          >
            Reset data
          </button>
        )}
      </header>
      {resource && me && (
        <div className={styles.roleBanner}>
          Viewing only your own bookings and tasks as <strong>{me.name}</strong>
          . Assignment dates and other people are managed by the resource
          manager.
        </div>
      )}
      <main className={styles.main}>
        {tab === "projects" && <ProjectsTab />}
        {tab === "allocations" && <ResourcesTab />}
        {tab === "available" && manager && <AvailableResourcesTab />}
        {tab === "skills" && manager && <SkillsTab />}
        {tab === "tasks" && <TasksTab />}
      </main>
    </div>
  );
}
