#!/bin/bash
set -e
echo "📊 WebDex Accuracy Evaluation"
echo "============================="
echo ""
echo "Testing entity extraction accuracy against Claude API (ground truth)"
echo ""

SAMPLE_URLS=(
  "https://www.regenpower.com"
  "https://www.infiniteenergy.com.au"
  "https://www.solarcity.com.au"
  "https://www.solarwholesale.com.au"
  "https://www.arise.solar"
)

pnpm --filter @webdex/interpreter evaluate "${SAMPLE_URLS[@]}"
