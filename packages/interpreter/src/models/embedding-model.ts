let pipeline: any = null;

export async function initEmbeddingModel(): Promise<void> {
  if (pipeline) return;
  console.log('📐 Loading embedding model...');
  const { pipeline: createPipeline } = await import('@xenova/transformers');
  pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('📐 Embedding model loaded');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!pipeline) throw new Error('Embedding model not initialized');
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => generateEmbedding(t)));
}
