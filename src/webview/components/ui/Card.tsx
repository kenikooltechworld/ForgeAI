import React from "react";

/**
 * Card Component
 *
 * Reusable card component that integrates with VS Code theme.
 * Uses Tailwind for layout/spacing and inline styles for theme colors.
 *
 * Requirements: 21.1, 21.2, 8.3
 */

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
  hoverable?: boolean;
}

export class Card extends React.Component<CardProps> {
  private cardRef = React.createRef<HTMLDivElement>();

  private handleMouseEnter = () => {
    if (!this.cardRef.current || !this.props.hoverable) {return;}
    this.cardRef.current.style.backgroundColor = "var(--vscode-list-hoverBackground)";
  };

  private handleMouseLeave = () => {
    if (!this.cardRef.current || !this.props.hoverable) {return;}
    this.cardRef.current.style.backgroundColor = "var(--vscode-input-background)";
  };

  private getBaseStyles(): React.CSSProperties {
    return {
      backgroundColor: "var(--vscode-input-background)",
      border: "1px solid var(--vscode-input-border)",
    };
  }

  private getPaddingClasses(): string {
    const { padding = "md" } = this.props;

    if (padding === "none") {
      return "";
    } else if (padding === "sm") {
      return "p-3";
    } else if (padding === "lg") {
      return "p-6";
    } else {
      return "p-4";
    }
  }

  public render(): React.ReactNode {
    const { children, className = "", onClick, hoverable = false } = this.props;

    const baseClasses = "rounded-lg transition-colors";
    const paddingClasses = this.getPaddingClasses();
    const interactiveClasses = onClick || hoverable ? "cursor-pointer" : "";

    return (
      <div
        ref={this.cardRef}
        className={`${baseClasses} ${paddingClasses} ${interactiveClasses} ${className}`}
        style={this.getBaseStyles()}
        onClick={onClick}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        {children}
      </div>
    );
  }
}
