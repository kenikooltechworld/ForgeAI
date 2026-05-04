import React from "react";

/**
 * Input Component
 *
 * Reusable input component that integrates with VS Code theme.
 * Uses Tailwind for layout/spacing and inline styles for theme colors.
 *
 * Requirements: 21.1, 21.2, 8.3
 */

export interface InputProps {
  type?: "text" | "password" | "email" | "number" | "search";
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export class Input extends React.Component<InputProps> {
  private inputRef = React.createRef<HTMLInputElement>();

  private handleFocus = () => {
    if (!this.inputRef.current) {return;}
    this.inputRef.current.style.border = "1px solid var(--vscode-focusBorder)";
    this.props.onFocus?.();
  };

  private handleBlur = () => {
    if (!this.inputRef.current) {return;}
    this.inputRef.current.style.border = "1px solid var(--vscode-input-border)";
    this.props.onBlur?.();
  };

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onChange?.(e.target.value);
  };

  private getBaseStyles(): React.CSSProperties {
    const { disabled } = this.props;

    return {
      backgroundColor: "var(--vscode-input-background)",
      color: "var(--vscode-input-foreground)",
      border: "1px solid var(--vscode-input-border)",
      opacity: disabled ? 0.5 : 1,
    };
  }

  public render(): React.ReactNode {
    const {
      type = "text",
      placeholder,
      value,
      disabled = false,
      className = "",
      icon,
      iconPosition = "left",
      onKeyDown,
    } = this.props;

    const baseClasses = "px-4 py-2 rounded-lg focus:outline-none transition-colors";
    const disabledClasses = disabled ? "cursor-not-allowed" : "";

    if (icon) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          {icon && iconPosition === "left" && icon}
          <input
            ref={this.inputRef}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={this.handleChange}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            onKeyDown={onKeyDown}
            disabled={disabled}
            className={`flex-1 ${baseClasses} ${disabledClasses}`}
            style={this.getBaseStyles()}
          />
          {icon && iconPosition === "right" && icon}
        </div>
      );
    }

    return (
      <input
        ref={this.inputRef}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={this.handleChange}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className={`${baseClasses} ${disabledClasses} ${className}`}
        style={this.getBaseStyles()}
      />
    );
  }
}
