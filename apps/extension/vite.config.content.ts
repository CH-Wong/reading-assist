/**
 * Separate build for content script + background worker.
 * Outputs self-contained IIFE bundles — no import/export statements.
 * Content scripts in Chrome are classic scripts and cannot use ES modules.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync } from 'fs';

// Detect Firefox build from outDir
function postBuild() {
  let outDir = '';

  return {
    name: 'content-post-build',
    configResolved(config: any) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const distDir = resolve(__dirname, outDir || 'dist');
      const isFirefox = distDir.toLowerCase().includes('firefox');

      // Read existing manifest (written by popup build or source)
      const manifestPath = resolve(distDir, 'manifest.json');
      let manifest: any;

      if (existsSync(manifestPath)) {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } else {
        // First build — create from source
        manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
      }

      // Copy background.js from assets/ to root (manifest expects it at root)
      const assetsDir = resolve(distDir, 'assets');
      if (existsSync(assetsDir)) {
        const bgFiles = readdirSync(assetsDir).filter((f: string) => f.startsWith('background-'));
        for (const f of bgFiles) {
          copyFileSync(resolve(assetsDir, f), resolve(distDir, 'background.js'));
          break;
        }
      }

      manifest.content_scripts = [{
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      }];

      if (isFirefox) {
        manifest.background = { scripts: ['background.js'] };
      } else {
        manifest.background = { service_worker: 'background.js', type: 'module' };
      }

      // Clean up web_accessible_resources (CSS is inlined via content.js)
      delete manifest.web_accessible_resources;

      // Ensure popup path is set (may have been set by popup build)
      if (!manifest.action?.default_popup?.startsWith('popup/')) {
        manifest.action = { ...manifest.action, default_popup: 'popup/popup.html' };
      }

      // Move popup from dist/src/popup/ to dist/popup/ if needed
      const srcPopupDir = resolve(distDir, 'src/popup');
      const destPopupDir = resolve(distDir, 'popup');
      if (existsSync(srcPopupDir)) {
        if (existsSync(destPopupDir)) rmSync(destPopupDir, { recursive: true });
        renameSync(srcPopupDir, destPopupDir);
      }
      const srcDir = resolve(distDir, 'src');
      if (existsSync(srcDir)) {
        try { rmSync(srcDir, { recursive: true }); } catch {}
      }

      // Fix popup.html paths
      const popupHtmlPath = resolve(destPopupDir, 'popup.html');
      if (existsSync(popupHtmlPath)) {
        let html = readFileSync(popupHtmlPath, 'utf-8');
        html = html.replace(/"\.\.\/\.\.\/assets\//g, '"../assets/');
        writeFileSync(popupHtmlPath, html);
      }

      // Copy icons
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      for (const icon of ['icon.svg', 'icon-off.svg']) {
        const src = resolve(__dirname, 'public/icons', icon);
        if (existsSync(src)) copyFileSync(src, resolve(iconsDir, icon));
      }

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const target = isFirefox ? 'Firefox' : 'Chrome/Edge';
      console.log(`✅ Content/background built (${target})`);
    },
  };
}

export default defineConfig({
  plugins: [react(), postBuild()],
  base: '',
  resolve: {
    alias: {
      '@reading-assist/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.tsx'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        chunkFileNames: 'content-chunks/[name].js',
      },
      preserveEntrySignatures: false,
    },
  },
});
