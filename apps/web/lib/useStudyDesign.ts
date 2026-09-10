"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi } from "@/lib/api";
import type { StudyDesignData } from "@/lib/studyDesign";
import { EMPTY_STUDY_DESIGN } from "@/lib/studyDesign";

export function useStudyDesign(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ["study-design", workspaceId],
    queryFn: () => peggyApi.getStudyDesign(workspaceId!),
    enabled: !!workspaceId,
  });

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<StudyDesignData>) => peggyApi.patchStudyDesign(workspaceId!, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["study-design", workspaceId], data);
    },
  });

  const studyDesign = query.data?.study_design ?? EMPTY_STUDY_DESIGN;

  const saveSection = useCallback(
    (section: keyof StudyDesignData, value: Record<string, unknown>) => {
      if (!workspaceId) return;
      queryClient.setQueryData(["study-design", workspaceId], {
        study_design: { ...studyDesign, [section]: { ...(studyDesign[section] as object), ...value } },
      });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchMutation.mutate({ [section]: value } as Partial<StudyDesignData>);
      }, 600);
    },
    [workspaceId, studyDesign, patchMutation, queryClient]
  );

  return {
    studyDesign,
    isLoading: query.isLoading,
    isSaving: patchMutation.isPending,
    saveSection,
    refetch: query.refetch,
  };
}
