"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi } from "@/lib/api";
import type { StudyDesignData } from "@/lib/studyDesign";
import { EMPTY_STUDY_DESIGN } from "@/lib/studyDesign";

const SECTIONS = ["samples", "ethics", "budget", "methodsPlan", "analysisPlan", "proposal"] as const;
type SectionKey = (typeof SECTIONS)[number];

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function sameSection(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortValue(a ?? {})) === JSON.stringify(sortValue(b ?? {}));
}

export function useStudyDesign(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Partial<StudyDesignData>>({});
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const query = useQuery({
    queryKey: ["study-design", workspaceId],
    queryFn: () => peggyApi.getStudyDesign(workspaceId!),
    enabled: !!workspaceId,
  });

  const serverDesign = query.data?.study_design ?? EMPTY_STUDY_DESIGN;
  const serverRef = useRef(serverDesign);
  serverRef.current = serverDesign;

  useEffect(() => {
    setDrafts({});
  }, [workspaceId]);

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<StudyDesignData>) => peggyApi.patchStudyDesign(workspaceId!, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["study-design", workspaceId], data);
    },
  });

  const studyDesign = useMemo(() => {
    const merged: StudyDesignData = { ...serverDesign };
    for (const key of SECTIONS) {
      const draft = drafts[key];
      if (draft && typeof draft === "object") {
        merged[key] = { ...(serverDesign[key] as object), ...draft } as never;
      }
    }
    return merged;
  }, [serverDesign, drafts]);

  const saveSection = useCallback((section: keyof StudyDesignData, value: Record<string, unknown>) => {
    if (section === "v") return;
    setDrafts((prev) => ({
      ...prev,
      [section]: { ...((prev[section] as object) ?? {}), ...value },
    }));
  }, []);

  const isSectionDirty = useCallback(
    (section: SectionKey) => {
      const draft = drafts[section];
      if (!draft || typeof draft !== "object") return false;
      const saved = (serverDesign[section] as object) ?? {};
      const merged = { ...saved, ...draft };
      return !sameSection(saved, merged);
    },
    [drafts, serverDesign]
  );

  const commitSection = useCallback(
    async (section: SectionKey, extra?: Record<string, unknown>) => {
      if (!workspaceId) return;
      const saved = (serverRef.current[section] as object) ?? {};
      const draft = (draftsRef.current[section] as object) ?? {};
      const value = { ...saved, ...draft, ...extra };
      setSavingSection(section);
      try {
        await patchMutation.mutateAsync({ [section]: value } as Partial<StudyDesignData>);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[section];
          return next;
        });
      } finally {
        setSavingSection(null);
      }
    },
    [workspaceId, patchMutation]
  );

  return {
    studyDesign,
    isLoading: query.isLoading,
    isSaving: patchMutation.isPending,
    savingSection,
    saveSection,
    commitSection,
    isSectionDirty,
    refetch: query.refetch,
  };
}
