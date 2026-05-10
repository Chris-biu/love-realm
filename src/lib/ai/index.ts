import { DeepSeekAdapter } from "@/lib/ai/deepseek-adapter";
import type { ModelAdapter } from "@/lib/ai/types";

const adapterRegistry: Record<string, ModelAdapter> = {
  deepseek: new DeepSeekAdapter(),
};

export function getAdapter(provider: string): ModelAdapter {
  const adapter = adapterRegistry[provider];
  if (!adapter) {
    throw new Error(`未找到 provider "${provider}" 的适配器。`);
  }
  return adapter;
}
