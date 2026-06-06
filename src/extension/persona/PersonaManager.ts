/**
 * PersonaManager
 *
 * Manages Stack Profiles and persona configurations.
 * Replaces the old persona.json system with a more flexible profile-based approach.
 * Requirements: 1, 10
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StackProfile {
  id: string;
  name: string;
  description?: string;
  frameworks: string[];
  languages: string[];
  lintTools: string[];
  testFrameworks: string[];
  codingStandards: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PersonaConfig {
  activeProfileId?: string;
  profiles: StackProfile[];
  noJunkDocs: boolean;
}

export class PersonaManager {
  private readonly profilesDir: string;
  private readonly configPath: string;
  private config: PersonaConfig;

  constructor(private readonly workspaceRoot: string) {
    this.profilesDir = path.join(workspaceRoot, '.forgeai', 'profiles');
    this.configPath = path.join(workspaceRoot, '.forgeai', 'persona.json');
    this.ensureDir(this.profilesDir);
    this.config = this.loadConfig();
  }

  public getActiveProfile(): StackProfile | null {
    const id = this.config.activeProfileId;
    if (!id) return null;
    return this.config.profiles.find((p) => p.id === id) || null;
  }

  public listProfiles(): StackProfile[] {
    return [...this.config.profiles];
  }

  public async createProfile(profile: Omit<StackProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<StackProfile> {
    const newProfile: StackProfile = {
      ...profile,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.config.profiles.push(newProfile);
    await this.saveConfig();
    return newProfile;
  }

  public async updateProfile(id: string, updates: Partial<StackProfile>): Promise<StackProfile | null> {
    const index = this.config.profiles.findIndex((p) => p.id === id);
    if (index === -1) return null;
    this.config.profiles[index] = {
      ...this.config.profiles[index],
      ...updates,
      id: this.config.profiles[index].id,
      createdAt: this.config.profiles[index].createdAt,
      updatedAt: Date.now(),
    };
    await this.saveConfig();
    return this.config.profiles[index];
  }

  public async deleteProfile(id: string): Promise<boolean> {
    const index = this.config.profiles.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.config.profiles.splice(index, 1);
    if (this.config.activeProfileId === id) {
      this.config.activeProfileId = this.config.profiles[0]?.id || undefined;
    }
    await this.saveConfig();
    return true;
  }

  public async setActiveProfile(id: string): Promise<boolean> {
    const exists = this.config.profiles.some((p) => p.id === id);
    if (!exists) return false;
    this.config.activeProfileId = id;
    await this.saveConfig();
    return true;
  }

  public async setNoJunkDocs(enabled: boolean): Promise<void> {
    this.config.noJunkDocs = enabled;
    await this.saveConfig();
  }

  public isNoJunkDocsEnabled(): boolean {
    return this.config.noJunkDocs;
  }

  public getPersonaRules(): string[] {
    const active = this.getActiveProfile();
    if (!active) return [];
    return [
      `Use ${active.languages.join(', ')} as primary languages`,
      `Follow coding standards: ${active.codingStandards.join(', ') || 'standard conventions'}`,
      `Use ${active.lintTools.join(', ') || 'ESLint'} for linting`,
      `Use ${active.testFrameworks.join(', ') || 'Jest'} for testing`,
      `Target frameworks: ${active.frameworks.join(', ') || 'none specified'}`,
    ];
  }

  public async importProfile(filePath: string): Promise<StackProfile> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imported = JSON.parse(content) as StackProfile;
    return this.createProfile(imported);
  }

  public async exportProfile(id: string, outputPath: string): Promise<void> {
    const profile = this.config.profiles.find((p) => p.id === id);
    if (!profile) throw new Error('Profile not found');
    fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2));
  }

  private loadConfig(): PersonaConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch {
      // ignore
    }
    return {
      profiles: [],
      noJunkDocs: false,
    };
  }

  private async saveConfig(): Promise<void> {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch {
      // ignore
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private generateId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
