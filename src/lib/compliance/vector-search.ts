import type { VectorChunk } from "./types";

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export function chunkText(text: string, maxChars: number = 2000): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export class VectorStore {
  private chunks: VectorChunk[] = [];

  add(chunk: VectorChunk): void {
    this.chunks.push(chunk);
  }

  addMany(chunks: VectorChunk[]): void {
    this.chunks.push(...chunks);
  }

  search(queryEmbedding: number[], topK: number = 5): VectorChunk[] {
    if (this.chunks.length === 0) return [];

    const scored = this.chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  }

  get size(): number {
    return this.chunks.length;
  }

  clear(): void {
    this.chunks = [];
  }
}

/**
 * Simple deterministic embedding based on character trigram hashing.
 * Adequate for small corpus cosine similarity; not production-grade.
 * Switch to Voyage AI or similar when corpus grows past ~1000 docs.
 */
export function hashEmbedding(text: string, dimensions: number = 256): number[] {
  const vec = new Float64Array(dimensions);
  const lower = text.toLowerCase();

  for (let i = 0; i < lower.length - 2; i++) {
    const trigram = lower.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash + trigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  }

  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

/**
 * Generate embeddings for an array of text strings.
 * Uses hash-based embeddings for the small compliance corpus.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return texts.map((text) => hashEmbedding(text, 256));
}
