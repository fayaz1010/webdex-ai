#!/bin/bash
set -e
MODELS_DIR="./packages/interpreter/models"
mkdir -p "$MODELS_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# Qwen2.5-14B-Instruct Q8_0  (~15.7 GB)
#
# Sized for Oracle A1 Flex free tier (24 GB RAM, 4 OCPUs ARM Ampere):
#   Model weights:   ~15.7 GB
#   KV cache 8K ctx: ~1.3 GB
#   OS + Node + DB:  ~3.0 GB
#   Headroom:        ~4.0 GB
# ─────────────────────────────────────────────────────────────────────────────
MODEL_FILE="qwen2.5-14b-instruct-q8_0.gguf"
MODEL_URL="https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/${MODEL_FILE}"

echo "📥 Downloading Qwen2.5-14B-Instruct-Q8_0 (~15.7 GB) ..."
echo "   Destination: ${MODELS_DIR}/${MODEL_FILE}"
echo ""

if [ -f "${MODELS_DIR}/${MODEL_FILE}" ]; then
  echo "ℹ  Model file already exists — skipping download"
else
  # Use curl with resume support (-C -) in case of interrupted downloads
  curl -L -C - \
    --progress-bar \
    --retry 5 \
    --retry-delay 10 \
    -o "${MODELS_DIR}/${MODEL_FILE}" \
    "${MODEL_URL}"
  echo ""
  echo "✅ Model downloaded ($(du -sh "${MODELS_DIR}/${MODEL_FILE}" | cut -f1))"
fi

echo ""
echo "📥 Embedding model (all-MiniLM-L6-v2, ~90 MB)"
echo "   Will auto-download on first run via @xenova/transformers"
echo ""
echo "✅ Setup complete"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example → .env and fill in keys"
echo "  2. pnpm run db:migrate"
echo "  3. pnpm run worker       # start the indexing worker"
echo "  4. pnpm run dev          # start API + dashboard"
