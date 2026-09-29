import { rankingExportUrl } from "../../api/fantasy-api";
import type { TierDisplayMode } from "../ranking-editor-logic";
import { TierModeToggle } from "./TierModeToggle";

export function EditorToolbar({
  rankingId,
  tierDisplayMode,
  onTierDisplayModeChange,
}: {
  rankingId: string;
  tierDisplayMode: TierDisplayMode;
  onTierDisplayModeChange: (mode: TierDisplayMode) => void;
}) {
  return (
    <div className="ranking-editor__toolbar">
      <h2>Edit rankings</h2>
      <div className="ranking-editor__toolbar-actions">
        <a
          className="ranking-editor__mode-button ranking-editor__export-link"
          href={rankingExportUrl(rankingId)}
          download
        >
          Export CSV
        </a>
        <TierModeToggle
          value={tierDisplayMode}
          onChange={onTierDisplayModeChange}
        />
      </div>
    </div>
  );
}
