"use client";

import { useStore } from "@/context/StoreContext";
import {
  setActingAsResourceId,
  setStakeholderRole,
} from "@/lib/store";
import { actingAsResourceId, isResourceRole } from "@/lib/roles";
import type { StakeholderRole } from "@/lib/types";
import styles from "./StakeholderSwitcher.module.css";

export function StakeholderSwitcher() {
  const { data, setData } = useStore();
  const role = data.ui.stakeholderRole;
  const asId = actingAsResourceId(data);
  const asResource = isResourceRole(data);

  return (
    <div className={styles.wrap} role="group" aria-label="Stakeholder view">
      <label className={styles.field}>
        <span className={styles.label}>View as</span>
        <select
          className={styles.select}
          value={role}
          onChange={(e) => {
            const next = e.target.value as StakeholderRole;
            setData((prev) => setStakeholderRole(prev, next));
          }}
        >
          <option value="manager">Resource manager</option>
          <option value="resource">Resource (self)</option>
        </select>
      </label>
      {asResource && (
        <label className={styles.field}>
          <span className={styles.label}>I am</span>
          <select
            className={styles.select}
            value={asId}
            onChange={(e) =>
              setData((prev) => setActingAsResourceId(prev, e.target.value))
            }
          >
            {data.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
