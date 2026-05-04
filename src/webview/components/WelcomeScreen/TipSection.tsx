import React from "react";
import { LightbulbIcon, ICON_SIZES } from "../../icons";
import { vscodeTheme } from "../../utils/vscodeTheme";

/**
 * TipSection Component
 *
 * Displays helpful tips and shortcuts for users.
 * Shows contextual information to improve user experience.
 *
 * Requirements: 22.5, 21.1
 */
interface TipSectionProps {
  tip?: string;
}

export class TipSection extends React.Component<TipSectionProps> {
  public render(): React.ReactNode {
    const { tip = "Tip: Use Cmd+K anywhere to open the command palette" } = this.props;

    return (
      <div className="mb-6">
        <div
          className="flex items-start gap-2 text-sm"
          style={{ color: vscodeTheme.text.description }}
        >
          <LightbulbIcon size={ICON_SIZES.sm} style={{ marginTop: "2px" }} />
          <span>{tip}</span>
        </div>
      </div>
    );
  }
}
