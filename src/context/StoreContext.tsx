"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppData, EntityType } from "@/lib/types";
import {
  loadAppData,
  saveAppData,
  resetToSeed,
  getHistoryFor,
} from "@/lib/store";

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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData | null>(null);

  useEffect(() => {
    setDataState(loadAppData());
  }, []);

  const setData = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      setDataState((prev) => {
        if (!prev) return prev;
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveAppData(next);
        return next;
      });
    },
    []
  );

  const reset = useCallback(() => {
    const seed = resetToSeed();
    setDataState(seed);
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
