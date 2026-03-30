import { playStationAdapter } from "./playstation";
import { totalWineAdapter } from "./totalWine";
import { SourceAdapter, SourceType } from "./types";

const adapters: Record<SourceType, SourceAdapter> = {
  "total-wine": totalWineAdapter,
  playstation: playStationAdapter
};

export function getAdapter(source: SourceType): SourceAdapter {
  const adapter = adapters[source];
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${source}`);
  }
  return adapter;
}
