// Script to bundle Dhadi Wala into a single standalone offline HTML file
import fs from 'fs';
import path from 'path';

console.log('Generating Standalone Offline HTML Bundle...');

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run vite build first.');
  process.exit(1);
}

// 1. Read dist/index.html
let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// 2. Read and inline CSS
const assetFiles = fs.readdirSync(assetsDir);
const cssFile = assetFiles.find(f => f.endsWith('.css') && f.startsWith('index-'));
if (cssFile) {
  const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8');
  html = html.replace(
    new RegExp(`<link[^>]*href="\\/assets\\/${cssFile}"[^>]*>`, 'i'),
    () => `<style>\n${cssContent}\n</style>`
  );
  console.log(`Inlined CSS from ${cssFile}`);
}

// 3. Load QR code images as base64 data URLs
const qrMonthlyPath = path.join(assetsDir, 'qr-monthly-29.png');
const qrYearlyPath = path.join(assetsDir, 'qr-yearly-199.png');

let qrMonthlyBase64 = '';
let qrYearlyBase64 = '';

if (fs.existsSync(qrMonthlyPath)) {
  qrMonthlyBase64 = `data:image/png;base64,${fs.readFileSync(qrMonthlyPath).toString('base64')}`;
}
if (fs.existsSync(qrYearlyPath)) {
  qrYearlyBase64 = `data:image/png;base64,${fs.readFileSync(qrYearlyPath).toString('base64')}`;
}

// 4. Read main JS bundle
const jsFile = assetFiles.find(f => f.endsWith('.js') && f.startsWith('index-') && !f.includes('purify') && !f.includes('index.es'));
if (jsFile) {
  let jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8');

  // Replace QR asset paths with inline base64 data URLs
  if (qrMonthlyBase64) {
    jsContent = jsContent.replaceAll('/assets/qr-monthly-29.png', () => qrMonthlyBase64);
  }
  if (qrYearlyBase64) {
    jsContent = jsContent.replaceAll('/assets/qr-yearly-199.png', () => qrYearlyBase64);
  }

  // Remove the module script tag from <head>
  html = html.replace(
    new RegExp(`<script[^>]*src="\\/assets\\/${jsFile}"[^>]*><\\/script>`, 'i'),
    ''
  );

  // Read apk-data.js content
  let apkDataScript = '';
  const apkDataPath = path.resolve('public/apk-data.js');
  if (fs.existsSync(apkDataPath)) {
    const apkDataContent = fs.readFileSync(apkDataPath, 'utf-8');
    apkDataScript = `<script>\n${apkDataContent}\n</script>\n`;
    // Remove standalone apk-data script tag if present
    html = html.replace(/<script[^>]*src="\/apk-data\.js"[^>]*><\/script>/i, '');
    console.log('Inlined APK data script');
  }

  // Insert both apk-data and main script right before </body> so DOM elements are available
  const closingBodyIndex = html.lastIndexOf('</body>');
  if (closingBodyIndex !== -1) {
    const scriptsBlock = `${apkDataScript}<script>\n${jsContent}\n</script>\n`;
    html = html.slice(0, closingBodyIndex) + scriptsBlock + html.slice(closingBodyIndex);
    console.log(`Placed bundled scripts cleanly right before </body>`);
  } else {
    html += `\n${apkDataScript}<script>\n${jsContent}\n</script>`;
  }
  console.log(`Inlined JS from ${jsFile}`);
}

// 6. Replace remaining QR image references in HTML if any
if (qrMonthlyBase64) {
  html = html.replaceAll('/assets/qr-monthly-29.png', () => qrMonthlyBase64);
}
if (qrYearlyBase64) {
  html = html.replaceAll('/assets/qr-yearly-199.png', () => qrYearlyBase64);
}

// 7. Write to targets
const targets = [
  path.resolve('public/DhadiWala.html'),
  path.resolve('public/DhadiWala_Offline.html'),
  path.resolve('dist/DhadiWala.html'),
  path.resolve('dist/DhadiWala_Offline.html')
];

targets.forEach(target => {
  fs.writeFileSync(target, html, 'utf-8');
  console.log(`Saved offline bundle: ${target} (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
});

console.log('Offline bundle generation complete!');
