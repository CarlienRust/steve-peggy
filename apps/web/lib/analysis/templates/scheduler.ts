import type { ComputeProfileJson } from "@/lib/analysis/types";

function requireProfileValue(label: string, value: string): string {
  const v = value.trim();
  if (!v) return `# ${label}: set this in Compute profile (Peggy does not guess)`;
  return v;
}

export function stageScript(profile: ComputeProfileJson): string {
  const mods = profile.moduleNames.trim()
    ? profile.moduleNames
        .split(/[,\n]/)
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => `module load ${m}`)
        .join("\n")
    : "# no module names in compute profile";
  return `#!/usr/bin/env bash
# Stage script — run where there is internet. Do not run on offline compute nodes.
set -euo pipefail
# Preset: ${profile.preset || "none"} (verify with site docs)
${mods}
# Example package fetch only if this node has internet.
# pip download -d wheels pandas statsmodels
# Rscript -e 'renv::restore()'
echo "Stage complete. Copy wheels/containers to ${requireProfileValue("storagePath", profile.storagePath)}"
`;
}

export function jobScript(profile: ComputeProfileJson, jobName = "peggy-job"): string {
  const queue = requireProfileValue("queue", profile.queue);
  const wall = requireProfileValue("walltime", profile.walltime);
  const mem = requireProfileValue("memoryGb", profile.memoryGb);
  if (profile.scheduler === "slurm") {
    return `#!/bin/bash
#SBATCH --job-name=${jobName}
#SBATCH --partition=${queue}
#SBATCH --time=${wall}
#SBATCH --mem=${mem}G
# Generated from compute profile only. Peggy does not guess queue names.
# computeNodesHaveInternet=${profile.computeNodesHaveInternet}
# containerRuntime=${profile.containerRuntime || "unset"}
set -euo pipefail
cd "${requireProfileValue("storagePath", profile.storagePath)}"
# srun python scripts/describe.py
`;
  }
  if (profile.scheduler === "pbs") {
    return `#!/bin/bash
#PBS -N ${jobName}
#PBS -q ${queue}
#PBS -l walltime=${wall}
#PBS -l mem=${mem}gb
# Generated from compute profile only.
cd "${requireProfileValue("storagePath", profile.storagePath)}"
`;
  }
  return `#!/usr/bin/env bash
# Local job (scheduler=none). No cluster directives.
set -euo pipefail
cd "${requireProfileValue("storagePath", profile.storagePath)}"
python scripts/describe.py
`;
}
