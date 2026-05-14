export interface ContentHasher {
  hash(params: { text: string }): Promise<{ hash: string }>;
}
