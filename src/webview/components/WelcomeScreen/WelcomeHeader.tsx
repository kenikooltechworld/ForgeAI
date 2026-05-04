import React from "react";
import { RocketIcon, ICON_SIZES } from "../../icons";
import { vscodeTheme } from "../../utils/vscodeTheme";

/**
 * WelcomeHeader Component
 *
 * Displays the welcome header with title, icon, and subtitle.
 * Used in the WelcomeScreen to greet users on first launch.
 *
 * Requirements: 22.1, 21.1
 */
export class WelcomeHeader extends React.Component {
  public render(): React.ReactNode {
    return (
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">Welcome to ForgeAI</h1>
          <RocketIcon size={ICON_SIZES.lg} style={{ color: vscodeTheme.text.link }} />
        </div>
        <p className="text-lg" style={{ color: vscodeTheme.text.description }}>
          Your autonomous AI coding assistant
        </p>
      </div>
    );
  }
}
