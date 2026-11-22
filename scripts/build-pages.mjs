#!/usr/bin/env node
/**
 * Builds the optional GitHub Pages mirror.
 *
 * This used to be `DEPLOY_TARGET=github-pages vite build`, which is Unix-only:
 * PowerShell and cmd.exe cannot set an environment variable that way. Vercel
 * stays the primary host; this script only makes the secondary build runnable
 * on Windows as well.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

const result = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    DEPLOY_TARGET: "github-pages",
    // The mirror must never canonicalise itself: every canonical, OG and
    // sitemap URL has to keep pointing at the official Vercel deployment.
    VITE_PUBLIC_SITE_URL: process.env.VITE_PUBLIC_SITE_URL || "https://pokeguru.vercel.app",
  },
});

if (result.error) {
  console.error("GitHub Pages build failed to start:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
