import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { LightbulbIcon, CloseIcon } from "../../icons";
import { Button } from "../ui/Button";

/**
 * OnboardingTooltip Component
 *
 * Progressive onboarding tooltips that appear at key moments during first use.
 * Stores dismissal state in localStorage to avoid showing again.
 *
 * Requirements: 22.5, First launch experience from UI/UX doc
 */

export interface OnboardingTooltipProps {
  id: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  onDismiss?: () => void;
}

interface OnboardingTooltipState {
  isVisible: boolean;
}

export class OnboardingTooltip extends React.Component<
  OnboardingTooltipProps,
  OnboardingTooltipState
> {
  constructor(props: OnboardingTooltipProps) {
    super(props);

    // Check if tooltip has been dismissed before
    const dismissedTooltips = this.getDismissedTooltips();
    this.state = {
      isVisible: !dismissedTooltips.includes(props.id),
    };
  }

  private getDismissedTooltips(): string[] {
    try {
      const stored = localStorage.getItem("forgeai-dismissed-tooltips");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveDismissedTooltip(tooltipId: string) {
    try {
      const dismissed = this.getDismissedTooltips();
      if (!dismissed.includes(tooltipId)) {
        dismissed.push(tooltipId);
        localStorage.setItem("forgeai-dismissed-tooltips", JSON.stringify(dismissed));
      }
    } catch (error) {
      console.error("Failed to save dismissed tooltip:", error);
    }
  }

  private handleGotIt = () => {
    this.setState({ isVisible: false });
    this.props.onDismiss?.();
  };

  private handleDontShowAgain = () => {
    this.saveDismissedTooltip(this.props.id);
    this.setState({ isVisible: false });
    this.props.onDismiss?.();
  };

  public render(): React.ReactNode {
    if (!this.state.isVisible) {
      return null;
    }

    return (
      <div
        className="absolute z-50 p-4 rounded-lg shadow-lg max-w-sm"
        style={{
          backgroundColor: vscodeTheme.notifications.background,
          color: vscodeTheme.notifications.foreground,
          border: `1px solid ${vscodeTheme.notifications.border}`,
        }}
      >
        {/* Close Button */}
        <button
          className="absolute top-2 right-2 hover:opacity-70"
          onClick={this.handleGotIt}
          aria-label="Close tooltip"
          style={{
            color: vscodeTheme.notifications.foreground,
          }}
        >
          <CloseIcon size={16} />
        </button>

        {/* Content */}
        <div className="flex gap-3 pr-6">
          <div className="flex-shrink-0">
            <LightbulbIcon size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm whitespace-pre-wrap">{this.props.content}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="secondary" size="sm" onClick={this.handleDontShowAgain}>
            Don't show again
          </Button>
          <Button variant="primary" size="sm" onClick={this.handleGotIt}>
            Got it
          </Button>
        </div>
      </div>
    );
  }
}
