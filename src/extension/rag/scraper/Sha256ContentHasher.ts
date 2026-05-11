import crypto from 'crypto';
import type { ContentHasher } from './ContentHasher';

export class Sha256ContentHasher implements ContentHasher {
  public async hash(params: { text: string }): Promise<{ hash: string }> {
    const normalized = params.text ?? '';
    const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    return { hash };
  }
}
