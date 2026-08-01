"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  addSkill,
  removeSkill,
  updateResourceSkillLevel,
} from "@/lib/store";
import type { SkillLevel } from "@/lib/types";
import { SKILL_LEVELS } from "@/lib/types";
import { HistoryPopover } from "./HistoryPopover";
import styles from "./SkillsTab.module.css";

interface HistoryTarget {
  resourceSkillId: string;
  label: string;
}

export function SkillsTab() {
  const { data, setData, getHistory } = useStore();
  const [newSkill, setNewSkill] = useState("");
  const [history, setHistory] = useState<HistoryTarget | null>(null);

  function onAddSkill() {
    setData((prev) => addSkill(prev, newSkill));
    setNewSkill("");
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <form
          className={styles.addForm}
          onSubmit={(e) => {
            e.preventDefault();
            onAddSkill();
          }}
        >
          <input
            className={styles.input}
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add skill name…"
          />
          <button type="submit" className={styles.btn}>
            Add skill
          </button>
        </form>
        <span className={styles.hint}>Levels 1–5 · empty clears the skill for that resource</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.stickyCol}>Resource</th>
              <th className={styles.typeCol}>Type</th>
              {data.skills.map((skill) => (
                <th key={skill.id} className={styles.skillHead}>
                  <div className={styles.skillHeadInner}>
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      className={styles.removeSkill}
                      title={`Remove ${skill.name}`}
                      onClick={() => setData((prev) => removeSkill(prev, skill.id))}
                    >
                      ×
                    </button>
                  </div>
                  <div className={styles.category}>{skill.category}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.resources.map((resource) => (
              <tr key={resource.id}>
                <td className={styles.stickyCol}>{resource.name}</td>
                <td className={styles.typeCol}>{resource.type}</td>
                {data.skills.map((skill) => {
                  const rs = data.resourceSkills.find(
                    (x) =>
                      x.resourceId === resource.id && x.skillId === skill.id
                  );
                  const level = rs?.level ?? "";
                  return (
                    <td key={skill.id} className={styles.levelCell}>
                      <div className={styles.cellInner}>
                        <select
                          className={styles.select}
                          value={level}
                          onChange={(e) =>
                            setData((prev) =>
                              updateResourceSkillLevel(
                                prev,
                                resource.id,
                                skill.id,
                                e.target.value as SkillLevel | ""
                              )
                            )
                          }
                        >
                          <option value="">—</option>
                          {SKILL_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                        {rs && (
                          <button
                            type="button"
                            className={styles.historyBtn}
                            onClick={() =>
                              setHistory({
                                resourceSkillId: rs.id,
                                label: `${resource.name} · ${skill.name}`,
                              })
                            }
                            title="History"
                          >
                            ↻
                          </button>
                        )}
                        {history &&
                          history.resourceSkillId === rs?.id &&
                          rs && (
                          <HistoryPopover
                            title={history.label}
                            entries={getHistory("resourceSkill", rs.id, "level")}
                            onClose={() => setHistory(null)}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data.resources.length === 0 && (
          <p className={styles.empty}>No resources yet. Add assignments on the Resources tab.</p>
        )}
      </div>
    </div>
  );
}
