import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DIST_URL = new URL('../dist/', import.meta.url);
const REPO_URL = new URL('../', import.meta.url);
const REPO_ROOT = fileURLToPath(REPO_URL);
const PUBLIC_ORIGIN = 'https://emori.boot.tanaab.sh';
const PUBLISHED_SCRIPTS = [
  {
    sourcePath: 'boot.sh',
    destinationPath: 'boot.sh',
    executable: true,
  },
];
const DIST_FILES = [
  ...PUBLISHED_SCRIPTS,
  {
    sourcePath: 'site/index.html',
    destinationPath: 'index.html',
    executable: false,
  },
  {
    sourcePath: 'site/llms.txt',
    destinationPath: 'llms.txt',
    executable: false,
  },
];
const ROBOTS_URL = new URL('./robots.txt', DIST_URL);
const SITEMAP_URL = new URL('./sitemap.xml', DIST_URL);
const PUBLIC_RESOURCES = [
  ...PUBLISHED_SCRIPTS.map(({ destinationPath }) => ({
    destinationPath,
  })),
  {
    destinationPath: 'llms.txt',
  },
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function normalizeLastmod(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.valueOf())) {
    return null;
  }

  return parsedDate.toISOString();
}

async function getGitLastmod() {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '-1', '--format=%cI', '--', ...PUBLISHED_SCRIPTS.map(({ sourcePath }) => sourcePath)],
      {
        cwd: REPO_ROOT,
      },
    );

    return normalizeLastmod(stdout.trim());
  } catch {
    return null;
  }
}

async function getFileLastmod() {
  try {
    const fileStats = await Promise.all(
      PUBLISHED_SCRIPTS.map(({ sourcePath }) => stat(new URL(`../${sourcePath}`, import.meta.url))),
    );
    const latestTimestamp = Math.max(...fileStats.map((entry) => entry.mtimeMs));

    return normalizeLastmod(new Date(latestTimestamp).toISOString());
  } catch {
    return null;
  }
}

async function resolveSitemapLastmod() {
  const explicitLastmod = normalizeLastmod(process.env.SITEMAP_LASTMOD);

  if (explicitLastmod) {
    return explicitLastmod;
  }

  const gitLastmod = await getGitLastmod();

  if (gitLastmod) {
    return gitLastmod;
  }

  const fileLastmod = await getFileLastmod();

  if (fileLastmod) {
    return fileLastmod;
  }

  return new Date().toISOString();
}

function renderSitemap(lastmod) {
  const urls = PUBLIC_RESOURCES.map(
    ({ destinationPath }) => `  <url>
    <loc>${PUBLIC_ORIGIN}/${destinationPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
  </url>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRobots() {
  const allowedPaths = PUBLIC_RESOURCES.map(
    ({ destinationPath }) => `Allow: /${destinationPath}`,
  ).join('\n');

  return `User-agent: *
Disallow: /
Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml
Host: ${PUBLIC_ORIGIN}
${allowedPaths}
Allow: /sitemap.xml
`;
}

async function resetDist() {
  await rm(DIST_URL, { recursive: true, force: true });
  await mkdir(DIST_URL, { recursive: true });
}

async function copyDistFile(sourcePath, destinationPath) {
  const sourceUrl = new URL(`../${sourcePath}`, import.meta.url);
  const destinationUrl = new URL(`./${destinationPath}`, DIST_URL);

  await copyFile(sourceUrl, destinationUrl);

  return destinationUrl.pathname;
}

async function makeExecutable(filename) {
  await chmod(new URL(`./${filename}`, DIST_URL), 0o755);
}

async function writeSitemap() {
  const lastmod = await resolveSitemapLastmod();

  await writeFile(SITEMAP_URL, renderSitemap(lastmod), 'utf8');
  log(`wrote ${SITEMAP_URL.pathname}`);
}

async function writeRobots() {
  await writeFile(ROBOTS_URL, renderRobots(), 'utf8');
  log(`wrote ${ROBOTS_URL.pathname}`);
}

async function main() {
  await resetDist();

  for (const { sourcePath, destinationPath } of DIST_FILES) {
    const copiedPath = await copyDistFile(sourcePath, destinationPath);
    log(`copied ${copiedPath}`);
  }

  await writeSitemap();
  await writeRobots();

  for (const { destinationPath, executable } of PUBLISHED_SCRIPTS) {
    if (executable) {
      await makeExecutable(destinationPath);
    }
  }

  log(`prepared ${DIST_URL.pathname}`);
}

try {
  await main();
} catch (error) {
  const output = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${output}\n`);
  process.exit(1);
}
