export type OutcomeType = "continuous" | "ordinal" | "categorical";
export type GroupCount = "1" | "2" | "3plus";
export type Pairing = "independent" | "paired";

export type TestSelector = {
  outcome: OutcomeType;
  groups: GroupCount;
  pairing: Pairing;
};

export type TestSuggestion = {
  test: string;
  why: string;
};

export function suggestTest(sel: TestSelector, parametricHint?: "parametric" | "nonparametric" | "na"): TestSuggestion {
  const preferNon = parametricHint === "nonparametric";
  if (sel.outcome === "categorical") {
    if (sel.groups === "1") {
      return { test: "Chi-square goodness of fit (or binomial if two levels)", why: "One categorical outcome, no grouping variable." };
    }
    if (sel.groups === "2") {
      return {
        test: "Chi-square test of independence (Fisher exact if counts are small)",
        why: "Categorical outcome compared across two groups.",
      };
    }
    return { test: "Chi-square test of independence", why: "Categorical outcome compared across three or more groups." };
  }

  if (sel.groups === "1") {
    if (preferNon || sel.outcome === "ordinal") {
      return { test: "Wilcoxon signed-rank (one-sample)", why: "One group; ranks or a non-normal continuous outcome." };
    }
    return { test: "One-sample t-test", why: "One continuous group; distribution looks close enough to normal for v1." };
  }

  if (sel.groups === "2") {
    if (sel.pairing === "paired") {
      if (preferNon || sel.outcome === "ordinal") {
        return { test: "Wilcoxon signed-rank (paired)", why: "Two related measures; ranks or non-normal continuous data." };
      }
      return { test: "Paired t-test", why: "Two related continuous measures; parametric path." };
    }
    if (preferNon || sel.outcome === "ordinal") {
      return { test: "Mann–Whitney U", why: "Two independent groups; ranks or non-normal continuous data." };
    }
    return { test: "Independent samples t-test", why: "Two independent continuous groups; parametric path." };
  }

  if (sel.pairing === "paired") {
    if (preferNon || sel.outcome === "ordinal") {
      return { test: "Friedman test", why: "Three or more related measures; ranks or non-normal data." };
    }
    return { test: "Repeated-measures ANOVA", why: "Three or more related continuous measures; parametric path." };
  }
  if (preferNon || sel.outcome === "ordinal") {
    return { test: "Kruskal–Wallis", why: "Three or more independent groups; ranks or non-normal continuous data." };
  }
  return { test: "One-way ANOVA", why: "Three or more independent continuous groups; parametric path." };
}
