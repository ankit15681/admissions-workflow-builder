import { useGetConditionTypesQuery } from "../../app/api";
import type { ConditionTypeDefinition } from "../../types/stepTypes";

// Data-logic hook for the Branches editor. Owns the condition-type fetch, the selected
// condition, the picker options, and the type-change reset (which swaps in the new condition's
// defaultConfig). The component renders a Select + the selected condition's SchemaForm.
export function useBranches(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
) {
  const { data: conditionTypes, isLoading } = useGetConditionTypesQuery();

  const list: ConditionTypeDefinition[] = conditionTypes ?? [];
  const selected = list.find((c) => c.type === config.conditionType);
  const options = list.map((c) => ({ value: c.type, label: c.label }));

  const setConditionType = (type: string) => {
    const def = list.find((c) => c.type === type);
    onChange({ conditionType: type, conditionConfig: { ...(def?.defaultConfig ?? {}) } });
  };

  const setConditionConfig = (next: Record<string, unknown>) => onChange({ ...config, conditionConfig: next });

  return {
    loading: isLoading || !conditionTypes,
    conditionType: (config.conditionType as string) ?? "",
    conditionConfig: (config.conditionConfig as Record<string, unknown>) ?? {},
    selected,
    options,
    setConditionType,
    setConditionConfig,
  };
}
