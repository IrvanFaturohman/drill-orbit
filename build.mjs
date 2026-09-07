/* Inline every file into one self-contained HTML page (for the Artifact / phone build).
   Run: node build.mjs   ->   dist/drill-orbit.html                                     */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/^\s*<script src="[^"]+"><\/script>\s*$/gm, '')
  .trim();

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const css = readFileSync('style.css', 'utf8');
const js = scripts.map((f) => `/* ===== ${f} ===== */\n${readFileSync(f, 'utf8')}`).join('\n\n');

/* No doctype/html/head/body wrapper: the Artifact host supplies those. */
const out = `<title>Drill Orbit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap">
<style>
${css}
</style>

${body}

<script>
${js}
</script>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/drill-orbit.html', out);
console.log(`dist/drill-orbit.html  ${(out.length / 1024).toFixed(1)} KB  (${scripts.length} scripts inlined)`);
