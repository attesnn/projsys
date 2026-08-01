"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, EntityType } from "@/lib/types";
import { getHistoryFor } from "@/lib/store";

interface StoreContextValue {
  data: AppData;
  ready: boolean;
  setData: (updater: AppData | ((prev: AppData) => AppData)) => void;
  reset: () => void;
  getHistory: (
    entityType: EntityType,
    entityId: string,
    field?: string
  ) => ReturnType<typeof getHistoryFor>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 300;

async function fetchAppData(): Promise<AppData> {
  const res = await fetch("/api/app-data");
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
  return res.json() as Promise<AppData>;
}

async function putAppData(data: AppData): Promise<void> {
  const res = await fetch("/api/app-data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save data (${res.status})`);
}

async function postReset(): Promise<AppData> {
  const res = await fetch("/api/app-data/reset", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to reset data (${res.status})`);
  return res.json() as Promise<AppData>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<AppData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAppData()
      .then((loaded) => {
        if (!cancelled) setDataState(loaded);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load app data"
          );
        }
      });
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const flushSave = useCallback((next: AppData) => {
    pendingSave.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const snapshot = pendingSave.current;
      if (!snapshot) return;
      putAppData(snapshot).catch((err) => {
        console.error("Failed to persist app data", err);
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const setData = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      setDataState((prev) => {
        if (!prev) return prev;
        const next = typeof updater === "function" ? updater(prev) : updater;
        flushSave(next);
        return next;
      });
    },
    [flushSave]
  );

  const reset = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    postReset()
      .then((seed) => setDataState(seed))
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to reset");
      });
  }, []);

  const getHistory = useCallback(
    (entityType: EntityType, entityId: string, field?: string) => {
      if (!data) return [];
      return getHistoryFor(data, entityType, entityId, field);
    },
    [data]
  );

  const value = useMemo<StoreContextValue | null>(() => {
    if (!data) return null;
    return {
      data,
      ready: true,
      setData,
      reset,
      getHistory,
    };
  }, [data, setData, reset, getHistory]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "var(--danger, #b00020)" }}>
        {error}. Is PostgreSQL running and migrated? See README.
      </div>
    );
  }

  if (!value) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>Loading…</div>
    );
  }

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
