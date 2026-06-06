/**
 * SharedControlMode
 *
 * Pause AI and let User take control, preserving AI's planned next steps.
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

export interface PlannedStep {
  description: string;
  order: number;
}

export class SharedControlMode {
  private isPaused = false;
  private plannedSteps: PlannedStep[] = [];

  constructor(private readonly logger: Logger) {}

  public pause(): void {
    this.isPaused = true;
    void vscode.window.showInformationMessage('Shared Control: AI paused. You are now in control.');
  }

  public resume(): void {
    this.isPaused = false;
    void vscode.window.showInformationMessage('Shared Control: AI resumed.');
  }

  public setPlannedSteps(steps: PlannedStep[]): void {
    this.plannedSteps = steps;
  }

  public getPlannedSteps(): PlannedStep[] {
    return [...this.plannedSteps];
  }

  public isPausedState(): boolean {
    return this.isPaused;
  }
}
