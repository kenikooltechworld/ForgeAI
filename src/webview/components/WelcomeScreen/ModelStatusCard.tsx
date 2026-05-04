import React from "react";
import { CheckCircleIcon, ICON_SIZES } from "../../icons";
import { Card } from "../ui/Card";
import { vscodeTheme } from "../../utils/vscodeTheme";

/**
 * ModelStatusCard Component
 *
 * Displays the current AI model connection status.
 * Shows model name, connection status, and description.
 *
 * Requirements: 22.2, 21.1, 41.2
 */
interface ModelStatusCardProps {
  modelName?: string;
  status?: "connected" | "disconnected" | "connecting";
  description?: string;
}

export class ModelStatusCard extends React.Component<ModelStatusCardProps> {
  public render(): React.ReactNode {
    const {
      modelName = "Qwen3-Coder-397B (Cloud)",
      status = "connected",
      description = "Fast, intelligent, and ready to help",
    } = this.props;

    const statusColor =
      status === "connected"
        ? vscodeTheme.status.success
        : status === "connecting"
          ? vscodeTheme.status.info
          : vscodeTheme.status.error;

    return (
      <Card className="mb-8">
        <div className="flex items-center gap-2">
          <CheckCircleIcon size={ICON_SIZES.md} style={{ color: statusColor }} />
          <div>
            <div className="font-semibold">Connected to {modelName}</div>
            <div className="text-sm" style={{ color: vscodeTheme.text.description }}>
              {description}
            </div>
          </div>
        </div>
      </Card>
    );
  }
}
