import React from "react";
import { HelpCircleIcon, SettingsIcon, ICON_SIZES } from "../../icons";
import { Button } from "../ui/Button";

/**
 * FooterLinks Component
 *
 * Displays footer links for documentation and settings.
 * Provides quick access to help resources and configuration.
 *
 * Requirements: 22.5, 21.1, 8.3
 */
interface FooterLinksProps {
  onDocumentationClick: () => void;
  onSettingsClick: () => void;
}

export class FooterLinks extends React.Component<FooterLinksProps> {
  public render(): React.ReactNode {
    return (
      <div className="flex gap-4 text-sm">
        <Button variant="link" onClick={this.props.onDocumentationClick} className="gap-1">
          <HelpCircleIcon size={ICON_SIZES.xs} />
          <span>View Documentation</span>
        </Button>
        <Button variant="link" onClick={this.props.onSettingsClick} className="gap-1">
          <SettingsIcon size={ICON_SIZES.xs} />
          <span>Settings</span>
        </Button>
      </div>
    );
  }
}
