import React from "react";

/**
 * Button Component
 *
 * Reusable button component that integrates with VS Code theme.
 * Uses Tailwind for layout/spacing and inline styles for theme colors.
 *
 * Variants:
 * - primary: Main action button (blue background)
 * - secondary: Secondary action button (gray background)
 * - link: Text-only button with link styling
 *
 * Requirements: 21.1, 21.2, 8.3
 */

export interface ButtonProps {
  variant?: "primary" | "secondary" | "link";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export class Button extends React.Component<ButtonProps> {
  private buttonRef = React.createRef<HTMLButtonElement>();

  private handleMouseEnter = () => {
    if (!this.buttonRef.current || this.props.disabled) {return;}

    const { variant = "primary" } = this.props;

    if (variant === "primary") {
      this.buttonRef.current.style.backgroundColor = "var(--vscode-button-hoverBackground)";
    } else if (variant === "secondary") {
      this.buttonRef.current.style.backgroundColor =
        "var(--vscode-button-secondaryHoverBackground)";
    } else if (variant === "link") {
      this.buttonRef.current.style.color = "var(--vscode-textLink-activeForeground)";
    }
  };

  private handleMouseLeave = () => {
    if (!this.buttonRef.current || this.props.disabled) {return;}

    const { variant = "primary" } = this.props;

    if (variant === "primary") {
      this.buttonRef.current.style.backgroundColor = "var(--vscode-button-background)";
    } else if (variant === "secondary") {
      this.buttonRef.current.style.backgroundColor = "var(--vscode-button-secondaryBackground)";
    } else if (variant === "link") {
      this.buttonRef.current.style.color = "var(--vscode-textLink-foreground)";
    }
  };

  private getBaseStyles(): React.CSSProperties {
    const { variant = "primary", disabled } = this.props;

    if (variant === "primary") {
      return {
        backgroundColor: "var(--vscode-button-background)",
        color: "var(--vscode-button-foreground)",
        opacity: disabled ? 0.5 : 1,
      };
    } else if (variant === "secondary") {
      return {
        backgroundColor: "var(--vscode-button-secondaryBackground)",
        color: "var(--vscode-button-secondaryForeground)",
        opacity: disabled ? 0.5 : 1,
      };
    } else {
      // link variant
      return {
        backgroundColor: "transparent",
        color: "var(--vscode-textLink-foreground)",
        opacity: disabled ? 0.5 : 1,
      };
    }
  }

  private getSizeClasses(): string {
    const { size = "md" } = this.props;

    if (size === "sm") {
      return "px-3 py-1.5 text-sm";
    } else if (size === "lg") {
      return "px-6 py-3 text-lg";
    } else {
      return "px-4 py-2";
    }
  }

  public render(): React.ReactNode {
    const {
      variant = "primary",
      children,
      onClick,
      disabled = false,
      className = "",
      type = "button",
      icon,
      iconPosition = "left",
    } = this.props;

    const baseClasses =
      variant === "link"
        ? "inline-flex items-center gap-2 font-medium transition-colors underline"
        : "inline-flex items-center gap-2 rounded-lg font-medium transition-colors";

    const sizeClasses = this.getSizeClasses();
    const disabledClasses = disabled ? "cursor-not-allowed" : "cursor-pointer";

    return (
      <button
        ref={this.buttonRef}
        type={type}
        className={`${baseClasses} ${sizeClasses} ${disabledClasses} ${className}`}
        style={this.getBaseStyles()}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        {icon && iconPosition === "left" && icon}
        {children}
        {icon && iconPosition === "right" && icon}
      </button>
    );
  }
}
