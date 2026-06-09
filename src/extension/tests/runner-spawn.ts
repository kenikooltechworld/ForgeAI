import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('ts', ['.ts', '.tsx'], async (specifier: string, _referrer: string) => {
  return new URL(specifier, import.meta.url);
});

const { execSync } = await import('child_process');
