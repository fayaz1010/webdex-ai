/**
 * Local LLM inference via node-llama-cpp.
 *
 * Default model: Qwen2.5-14B-Instruct-Q8_0 (~15.7GB)
 * Sized for Oracle A1 Flex free tier (24GB RAM, 4 OCPUs / 8 vCPUs ARM Ampere).
 *
 * Memory budget on 24GB Oracle server:
 *   Model weights (Q8_0): ~15.7GB
 *   KV cache at 8192 ctx: ~1.3GB
 *   OS + Node + Redis:     ~3.0GB
 *   Embedding model:       ~0.1GB
 *   Headroom:              ~3.9GB
 *   Total:                 ≈24GB ✓
 */

import { getLlama, LlamaChatSession, type Llama, type LlamaModel, type LlamaContext } from 'node-llama-cpp';
import { cpus } from 'os';

let llama: Llama | null = null;
let model: LlamaModel | null = null;
let context: LlamaContext | null = null;

const MODEL_PATH = process.env.LOCAL_MODEL_PATH
  || './models/qwen2.5-14b-instruct-q8_0.gguf';

// Use all available threads (Oracle A1 Flex: 4 OCPUs = 8 vCPUs)
const NUM_THREADS = parseInt(process.env.LLM_THREADS || String(Math.max(cpus().length - 1, 1)));

// Context window: 8192 tokens balances quality and KV cache memory usage
const CONTEXT_SIZE = parseInt(process.env.LLM_CONTEXT_SIZE || '8192');

export async function initLocalModel(): Promise<void> {
  if (model) return;
  console.log(`🧠 Loading ${MODEL_PATH} (threads=${NUM_THREADS}, ctx=${CONTEXT_SIZE})...`);
  llama = await getLlama();
  model = await llama.loadModel({
    modelPath: MODEL_PATH,
    gpuLayers: 0,               // CPU-only (Oracle free tier has no GPU)
  });
  context = await model.createContext({
    contextSize: CONTEXT_SIZE,
    threads: NUM_THREADS,
    batchSize: 512,             // Efficient batching for throughput
  });
  console.log('🧠 Local model loaded');
}

export async function localInfer(systemPrompt: string, userMessage: string): Promise<string> {
  if (!model || !context) throw new Error('Model not initialized. Call initLocalModel() first.');

  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt,
  });

  const response = await session.prompt(userMessage, {
    maxTokens: 4096,
    temperature: 0.05,
  } as any);

  session.dispose();
  return response;
}

export async function disposeModel(): Promise<void> {
  if (context) { await context.dispose(); context = null; }
  if (model) { model = null; }
  if (llama) { llama = null; }
}
