---
inclusion: auto
---

# Coding Standards - Production-Ready Only

## 🚨 CRITICAL RULES - NO EXCEPTIONS

### 1. NO PLACEHOLDERS OR TODO COMMENTS
```typescript
// ❌ FORBIDDEN
function getUserData() {
  // TODO: implement this
  return null;
}

const API_KEY = 'placeholder'; // TODO: get from env

// ✅ REQUIRED - Complete implementation only
function getUserData(): UserData {
  const data = this.database.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!data) {
    throw new UserNotFoundError(`User ${userId} not found`);
  }
  return this.mapToUserData(data);
}

const API_KEY = process.env.OLLAMA_API_KEY || 'http://localhost:11434';
```

### 2. NO MOCK DATA OR FAKE IMPLEMENTATIONS
```typescript
// ❌ FORBIDDEN
class DatabaseService {
  async query(sql: string): Promise<any[]> {
    // Mock data for testing
    return [{ id: 1, name: 'Test User' }];
  }
}

// ✅ REQUIRED - Real implementation only
class DatabaseService {
  constructor(private readonly connection: DatabaseConnection) {}
  
  async query<T>(sql: string, params: unknown[]): Promise<T[]> {
    const statement = this.connection.prepare(sql);
    const results = statement.all(...params);
    return results as T[];
  }
}
```

### 3. NO TESTING CODE IN PRODUCTION FILES
```typescript
// ❌ FORBIDDEN - No test helpers in production code
export class UserService {
  // For testing only
  public resetDatabase(): void {
    this.db.exec('DELETE FROM users');
  }
}

// ✅ REQUIRED - Production code only
export class UserService {
  constructor(private readonly db: DatabaseSync) {}
  
  public async createUser(data: CreateUserDto): Promise<User> {
    const result = this.db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run(data.name, data.email);
    
    return this.getUserById(result.lastInsertRowid);
  }
}
```

### 4. TESTS MUST USE REAL DATA AND REAL SYSTEMS
```typescript
// ❌ FORBIDDEN - No mocks, no stubs
describe('UserService', () => {
  it('should create user', () => {
    const mockDb = { query: jest.fn().mockResolvedValue({ id: 1 }) };
    const service = new UserService(mockDb);
    // ...
  });
});

// ✅ REQUIRED - Real database, real data
describe('UserService', () => {
  let db: DatabaseSync;
  let service: UserService;
  
  beforeEach(() => {
    // Use real SQLite database (in-memory for speed)
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
    service = new UserService(db);
  });
  
  afterEach(() => {
    db.close();
  });
  
  it('should create user with real data', async () => {
    const user = await service.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });
    
    expect(user.id).toBeGreaterThan(0);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    
    // Verify in database
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    expect(dbUser).toEqual(user);
  });
});
```

---

## Object-Oriented Programming (OOP) - REQUIRED

### Use Classes, Not Functions
```typescript
// ❌ FORBIDDEN - Functional programming
export function createUser(db: Database, data: UserData) {
  return db.insert('users', data);
}

export function getUser(db: Database, id: number) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}

// ✅ REQUIRED - Object-oriented with classes
export class UserRepository {
  constructor(private readonly db: DatabaseSync) {}
  
  public create(data: CreateUserDto): User {
    const result = this.db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run(data.name, data.email);
    
    return this.findById(result.lastInsertRowid);
  }
  
  public findById(id: number): User {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) {
      throw new UserNotFoundError(`User ${id} not found`);
    }
    return this.mapToUser(row);
  }
  
  private mapToUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: new Date(row.created_at)
    };
  }
}
```

### Use Dependency Injection
```typescript
// ❌ FORBIDDEN - Hard-coded dependencies
export class UserService {
  private db = new DatabaseSync('users.db');
  
  getUser(id: number) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
}

// ✅ REQUIRED - Dependency injection
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: Logger
  ) {}
  
  public async getUser(id: number): Promise<User> {
    this.logger.info(`Fetching user ${id}`);
    
    try {
      return await this.userRepository.findById(id);
    } catch (error) {
      this.logger.error(`Failed to fetch user ${id}`, error);
      throw error;
    }
  }
}
```

### Use Interfaces for Contracts
```typescript
// ✅ REQUIRED - Interface-based design
export interface IUserRepository {
  create(data: CreateUserDto): User;
  findById(id: number): User;
  findByEmail(email: string): User | null;
  update(id: number, data: UpdateUserDto): User;
  delete(id: number): void;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseSync) {}
  
  public create(data: CreateUserDto): User {
    // Implementation
  }
  
  // ... other methods
}

// Easy to swap implementations
export class CachedUserRepository implements IUserRepository {
  constructor(
    private readonly repository: IUserRepository,
    private readonly cache: Cache
  ) {}
  
  public findById(id: number): User {
    const cached = this.cache.get(`user:${id}`);
    if (cached) return cached;
    
    const user = this.repository.findById(id);
    this.cache.set(`user:${id}`, user);
    return user;
  }
  
  // ... other methods
}
```

---

## TypeScript Standards

### Strict Type Safety
```typescript
// ❌ FORBIDDEN
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// ✅ REQUIRED
interface DataItem {
  id: number;
  value: string;
}

function processData(data: DataItem[]): string[] {
  return data.map((item: DataItem) => item.value);
}
```

### Explicit Return Types
```typescript
// ❌ FORBIDDEN
class UserService {
  getUser(id: number) {
    return this.repository.findById(id);
  }
}

// ✅ REQUIRED
class UserService {
  public getUser(id: number): User {
    return this.repository.findById(id);
  }
  
  public async getUserAsync(id: number): Promise<User> {
    return await this.repository.findByIdAsync(id);
  }
}
```

### No Null or Undefined - Use Exceptions
```typescript
// ❌ FORBIDDEN
class UserRepository {
  findById(id: number): User | null {
    const row = this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return row ? this.mapToUser(row) : null;
  }
}

// ✅ REQUIRED
class UserRepository {
  public findById(id: number): User {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) {
      throw new UserNotFoundError(`User ${id} not found`);
    }
    return this.mapToUser(row);
  }
  
  // If null is valid, use Optional pattern
  public findByEmail(email: string): Optional<User> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return Optional.ofNullable(row ? this.mapToUser(row) : null);
  }
}
```

---

## Error Handling

### Custom Error Classes
```typescript
// ✅ REQUIRED
export class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Usage
class UserService {
  public getUser(id: number): User {
    if (id <= 0) {
      throw new ValidationError('Invalid user ID', 'id', id);
    }
    
    const user = this.repository.findById(id);
    if (!user) {
      throw new UserNotFoundError(`User ${id} not found`);
    }
    
    return user;
  }
}
```

### Always Handle Errors
```typescript
// ❌ FORBIDDEN
async function saveUser(user: User) {
  await db.insert('users', user);
}

// ✅ REQUIRED
async function saveUser(user: User): Promise<void> {
  try {
    await this.db.insert('users', user);
    this.logger.info(`User ${user.id} saved successfully`);
  } catch (error) {
    this.logger.error(`Failed to save user ${user.id}`, error);
    throw new DatabaseError(`Failed to save user: ${error.message}`, error);
  }
}
```

---

## Code Organization

### One Class Per File
```typescript
// ❌ FORBIDDEN - Multiple classes in one file
// user.ts
export class User { }
export class UserRepository { }
export class UserService { }

// ✅ REQUIRED - One class per file
// User.ts
export class User {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string
  ) {}
}

// UserRepository.ts
export class UserRepository {
  // ...
}

// UserService.ts
export class UserService {
  // ...
}

// index.ts (barrel export)
export { User } from './User';
export { UserRepository } from './UserRepository';
export { UserService } from './UserService';
```

### File Organization Structure

**CRITICAL**: Follow this exact directory structure for the project:

```
ForgeAI/
├── src/
│   ├── extension/                    # Extension host code (Node.js/CommonJS)
│   │   ├── extension.ts              # Main entry point
│   │   ├── ollama/                   # Ollama integration
│   │   │   ├── OllamaClient.ts
│   │   │   ├── StreamHandler.ts
│   │   │   ├── AgentLoop.ts
│   │   │   └── index.ts
│   │   ├── providers/                # VS Code providers
│   │   │   ├── LanguageModelChatProvider.ts
│   │   │   ├── ChatParticipant.ts
│   │   │   └── index.ts
│   │   ├── storage/                  # Storage management
│   │   │   ├── StorageManager.ts
│   │   │   └── index.ts
│   │   ├── tools/                    # Tool implementations
│   │   │   ├── ToolRegistry.ts
│   │   │   ├── FileSystemTools.ts
│   │   │   ├── TerminalTools.ts
│   │   │   ├── GitTools.ts
│   │   │   ├── DiagnosticsTools.ts
│   │   │   └── index.ts
│   │   ├── types/                    # TypeScript types/interfaces
│   │   │   ├── OllamaTypes.ts
│   │   │   ├── ToolTypes.ts
│   │   │   └── index.ts
│   │   └── utils/                    # Utility classes
│   │       ├── Logger.ts
│   │       ├── CommandManager.ts
│   │       ├── WebviewManager.ts
│   │       └── index.ts
│   │
│   └── webview/                      # Webview UI code (React/ESM)
│       ├── index.tsx                 # React entry point
│       ├── App.tsx                   # Root component
│       ├── components/               # React components
│       │   ├── ActivityStream/
│       │   │   ├── ActivityStream.tsx
│       │   │   ├── TabBar.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageInput.tsx
│       │   │   ├── ThinkingBlock.tsx
│       │   │   ├── ToolCard.tsx
│       │   │   └── index.ts
│       │   ├── LivePreview/
│       │   │   ├── LivePreview.tsx
│       │   │   ├── CodeDiff.tsx
│       │   │   ├── TestResults.tsx
│       │   │   ├── FilePreview.tsx
│       │   │   └── index.ts
│       │   ├── SplitScreen/
│       │   │   ├── SplitScreen.tsx
│       │   │   └── index.ts
│       │   └── WelcomeScreen/
│       │       ├── WelcomeScreen.tsx
│       │       └── index.ts
│       ├── hooks/                    # Custom React hooks
│       │   ├── useVSCodeMessage.ts
│       │   ├── useStreamingResponse.ts
│       │   └── index.ts
│       ├── store/                    # Zustand state management
│       │   ├── conversationStore.ts
│       │   ├── vscodeStorageAdapter.ts
│       │   └── index.ts
│       └── styles/                   # Global styles
│           └── globals.css
│
├── dist/                             # Build output (gitignored)
├── resources/                        # Static resources (icons, etc.)
├── docs/                             # Documentation
├── .kiro/                            # Kiro configuration
│   ├── specs/                        # Feature specifications
│   └── steering/                     # Coding standards
├── package.json
├── tsconfig.json                     # Base TypeScript config
├── tsconfig.extension.json           # Extension host config
├── tsconfig.webview.json             # Webview config
├── vite.config.ts                    # Vite bundler config
├── eslint.config.js                  # ESLint config
└── .gitignore
```

**File Organization Rules:**

1. **Separation of Concerns**:
   - Extension host code (`src/extension/`) runs in Node.js context
   - Webview code (`src/webview/`) runs in browser context
   - NEVER mix extension and webview code in the same file

2. **Feature-Based Organization**:
   - Group related files by feature/domain (ollama/, tools/, providers/)
   - Each feature folder has an `index.ts` barrel export

3. **Component Co-location** (Webview only):
   - Keep component-specific styles, tests, and types near the component
   - Example: `ActivityStream.tsx`, `ActivityStream.test.tsx`, `ActivityStream.types.ts`

4. **Barrel Exports**:
   - Every folder MUST have an `index.ts` that exports public APIs
   - Internal implementation files should not be imported directly from outside the folder

```typescript
// ❌ FORBIDDEN - Direct import from internal file
import { OllamaClient } from '../ollama/OllamaClient';

// ✅ REQUIRED - Import from barrel export
import { OllamaClient } from '../ollama';
```

5. **File Naming Conventions**:
   - Classes: PascalCase (e.g., `UserService.ts`, `OllamaClient.ts`)
   - Components: PascalCase (e.g., `ActivityStream.tsx`, `MessageList.tsx`)
   - Hooks: camelCase with 'use' prefix (e.g., `useVSCodeMessage.ts`)
   - Types/Interfaces: PascalCase with 'Types' suffix (e.g., `OllamaTypes.ts`)
   - Utils: camelCase (e.g., `formatDate.ts`, `parseJson.ts`)
   - Constants: UPPER_SNAKE_CASE (e.g., `API_CONSTANTS.ts`)

6. **Import Order** (enforced by ESLint):
   ```typescript
   // 1. External dependencies
   import * as vscode from 'vscode';
   import React from 'react';
   
   // 2. Internal absolute imports
   import { OllamaClient } from '@/ollama';
   
   // 3. Internal relative imports
   import { Logger } from '../utils';
   import { StorageManager } from './StorageManager';
   
   // 4. Types
   import type { User } from '../types';
   ```

### Max File Length: 300 Lines
If a file exceeds 300 lines, split it into multiple files or refactor into smaller classes.

### Max Method Length: 50 Lines
If a method exceeds 50 lines, extract helper methods or refactor logic.

---

## Naming Conventions

### Classes: PascalCase
```typescript
class UserService { }
class DatabaseConnection { }
class OllamaClient { }
```

### Methods/Functions: camelCase
```typescript
class UserService {
  public getUser() { }
  public createUser() { }
  private validateEmail() { }
}
```

### Constants: UPPER_SNAKE_CASE
```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const API_BASE_URL = 'http://localhost:11434';
```

### Interfaces: PascalCase with 'I' prefix
```typescript
interface IUserRepository { }
interface ILogger { }
interface IDatabaseConnection { }
```

---

## Production-Ready Checklist

Before committing code, verify:

- [ ] No placeholder comments or TODO items
- [ ] No mock data or fake implementations
- [ ] No testing code in production files
- [ ] All classes use dependency injection
- [ ] All methods have explicit return types
- [ ] All errors are handled with custom error classes
- [ ] All code is object-oriented (classes, not functions)
- [ ] All tests use real data and real systems
- [ ] No `any` types (use proper types or `unknown`)
- [ ] All public methods are documented with JSDoc
- [ ] All files are under 300 lines
- [ ] All methods are under 50 lines
- [ ] Code follows naming conventions

---

## Enforcement

These rules are **MANDATORY**. Code that violates these standards will be rejected.

**No exceptions. No compromises. Production-ready code only.**
