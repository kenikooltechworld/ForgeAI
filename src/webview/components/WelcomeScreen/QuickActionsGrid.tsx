import React from "react";
import {
  BugIcon,
  SparklesIcon,
  BookOpenIcon,
  TestTubeIcon,
  SearchIcon,
  FileTextIcon,
  ICON_SIZES,
} from "../../icons";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/**
 * QuickActionsGrid Component
 *
 * Displays a grid of quick action buttons for common tasks.
 * Provides shortcuts for fixing bugs, building features, explaining code, etc.
 *
 * Requirements: 22.3, 21.1, 8.3
 */
interface QuickActionsGridProps {
  onActionClick: (action: string) => void;
}

export class QuickActionsGrid extends React.Component<QuickActionsGridProps> {
  private readonly actions = [
    { id: "fix-bug", label: "Fix a bug", icon: BugIcon },
    { id: "build-feature", label: "Build a feature", icon: SparklesIcon },
    { id: "explain-code", label: "Explain code", icon: BookOpenIcon },
    { id: "generate-tests", label: "Generate tests", icon: TestTubeIcon },
    { id: "review-changes", label: "Review changes", icon: SearchIcon },
    { id: "write-docs", label: "Write docs", icon: FileTextIcon },
  ];

  public render(): React.ReactNode {
    return (
      <Card className="mb-8 p-6">
        <h2 className="text-xl font-semibold mb-4">What would you like to do?</h2>

        <div className="grid grid-cols-2 gap-3">
          {this.actions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={action.id}
                variant="secondary"
                onClick={() => this.props.onActionClick(action.id)}
                className="flex items-center gap-2 justify-start"
              >
                <IconComponent size={ICON_SIZES.md} />
                <span className="font-medium">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </Card>
    );
  }
}
