import { smartFetch, closeBrowser } from './fetcher/smart-router.js';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: pnpm crawl <url>');
    process.exit(1);
  }

  console.log(`\n🕷  WebDex Crawler — Fetching: ${url}\n`);

  try {
    const result = await smartFetch(url);

    console.log('📊 Crawl Result:');
    console.log(`   Status: ${result.status}`);
    console.log(`   HTML Size: ${(result.htmlSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`   DOM Nodes: ${result.domNodes}`);
    console.log(`   Load Time: ${result.loadTimeMs}ms`);
    console.log(`   Requires JS: ${result.requiresJs}`);
    console.log(`   A11y Tree Nodes: ${result.accessibilityTreeNodes}`);

    console.log(`\n📝 Forms Found: ${result.forms.length}`);
    result.forms.forEach((form, i) => {
      console.log(`   Form ${i + 1}: ${form.method} ${form.action}`);
      console.log(`   Fields (${form.fields.length}):`);
      form.fields.forEach(f => {
        console.log(`     - ${f.name} (${f.type}) ${f.required ? '[required]' : ''} ${f.label ? `"${f.label}"` : ''}`);
        if (f.options) console.log(`       Options: ${f.options.join(', ')}`);
      });
      console.log(`   Submit: "${form.submitLabel}"`);
    });

    console.log(`\n🔗 Links Found: ${result.links.length}`);
    console.log(`   Internal: ${result.links.filter(l => !l.isExternal).length}`);
    console.log(`   External: ${result.links.filter(l => l.isExternal).length}`);

    console.log(`\n🖼  Images Found: ${result.images.length}`);
    result.images.slice(0, 5).forEach(img => {
      console.log(`   - ${img.alt || '(no alt)'} [${img.width || '?'}×${img.height || '?'}]`);
    });

    console.log(`\n🎬 Videos Found: ${result.videos.length}`);
    result.videos.forEach(v => {
      console.log(`   - ${v.platform}: ${v.videoId || v.src}`);
    });

    console.log(`\n🌐 API Endpoints Discovered: ${result.apiEndpoints.length}`);
    result.apiEndpoints.forEach(api => {
      console.log(`   - ${api.method} ${api.url} (via ${api.discoveredVia})`);
    });

    // Write full result to file for inspection
    const fs = await import('fs');
    const outPath = `./crawl-result-${Date.now()}.json`;
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full result saved to: ${outPath}`);

  } catch (error) {
    console.error('❌ Crawl failed:', error);
  } finally {
    await closeBrowser();
  }
}

main();
