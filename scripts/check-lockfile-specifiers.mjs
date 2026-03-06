#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCKFILE_PATH = path.join(ROOT, 'pnpm-lock.yaml');
const ROOT_PACKAGE_PATH = path.join(ROOT, 'package.json');
const WORKSPACE_PATH = path.join(ROOT, 'pnpm-workspace.yaml');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getWorkspaceImporters() {
  const importers = ['.'];

  const workspaceYaml = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  const packageGlobLines = workspaceYaml
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^"|"$/g, ''));

  for (const pattern of packageGlobLines) {
    if (!pattern.endsWith('/*')) continue;
    const baseDir = pattern.slice(0, -2);
    const absoluteBase = path.join(ROOT, baseDir);
    if (!fs.existsSync(absoluteBase)) continue;

    for (const entry of fs.readdirSync(absoluteBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const importerPath = `${baseDir}/${entry.name}`;
      const packagePath = path.join(ROOT, importerPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        importers.push(importerPath);
      }
    }
  }

  return importers.sort();
}

function parseImporters(lockText) {
  const lines = lockText.split('\n');
  const importers = new Map();

  let inImporters = false;
  let current = null;
  let block = [];

  for (const line of lines) {
    if (!inImporters) {
      if (line === 'importers:') {
        inImporters = true;
      }
      continue;
    }

    if (/^[^\s]/.test(line) && line !== 'importers:') {
      if (current) importers.set(current, block);
      break;
    }

    const importerMatch = line.match(/^  (\S[^:]*):$/);
    if (importerMatch) {
      if (current) importers.set(current, block);
      current = importerMatch[1];
      block = [];
      continue;
    }

    if (current) block.push(line);
  }

  return importers;
}

function parseSectionSpecifiers(blockLines, sectionName) {
  const specs = {};
  const lines = blockLines;
  const sectionHeader = `    ${sectionName}:`;
  const start = lines.findIndex((line) => line === sectionHeader);
  if (start === -1) return specs;

  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith('      ')) break;

    const depMatch = line.match(/^      (.+):$/);
    if (!depMatch) {
      i += 1;
      continue;
    }

    const depName = normalizeName(depMatch[1]);
    const specifierLine = lines[i + 1] || '';
    const specifierMatch = specifierLine.match(/^        specifier: (.+)$/);
    if (specifierMatch) {
      specs[depName] = specifierMatch[1].trim();
    }

    i += 1;
    while (i < lines.length && lines[i].startsWith('        ')) {
      i += 1;
    }
  }

  return specs;
}

function diffSpecifiers(importer, sectionName, lockSpecs, packageSpecs, problems) {
  const lockKeys = new Set(Object.keys(lockSpecs));
  const packageKeys = new Set(Object.keys(packageSpecs));

  for (const dep of packageKeys) {
    if (!lockKeys.has(dep)) {
      problems.push(`${importer} ${sectionName}: missing in lockfile -> ${dep}`);
      continue;
    }
    if (lockSpecs[dep] !== packageSpecs[dep]) {
      problems.push(
        `${importer} ${sectionName}: specifier mismatch for ${dep} (lock: ${lockSpecs[dep]}, package.json: ${packageSpecs[dep]})`,
      );
    }
  }

  for (const dep of lockKeys) {
    if (!packageKeys.has(dep)) {
      problems.push(`${importer} ${sectionName}: extra in lockfile -> ${dep}`);
    }
  }
}

function main() {
  if (!fs.existsSync(LOCKFILE_PATH)) {
    console.error('pnpm-lock.yaml not found');
    process.exit(1);
  }
  if (!fs.existsSync(ROOT_PACKAGE_PATH)) {
    console.error('package.json not found');
    process.exit(1);
  }
  if (!fs.existsSync(WORKSPACE_PATH)) {
    console.error('pnpm-workspace.yaml not found');
    process.exit(1);
  }

  const lockText = fs.readFileSync(LOCKFILE_PATH, 'utf8');
  const importerBlocks = parseImporters(lockText);
  const importers = getWorkspaceImporters();
  const problems = [];

  for (const importer of importers) {
    const packagePath = importer === '.' ? ROOT_PACKAGE_PATH : path.join(ROOT, importer, 'package.json');
    const pkg = readJson(packagePath);
    const pkgDeps = pkg.dependencies || {};
    const pkgDevDeps = pkg.devDependencies || {};

    const block = importerBlocks.get(importer);
    if (!block) {
      problems.push(`${importer}: importer is missing from pnpm-lock.yaml`);
      continue;
    }

    const lockDeps = parseSectionSpecifiers(block, 'dependencies');
    const lockDevDeps = parseSectionSpecifiers(block, 'devDependencies');

    diffSpecifiers(importer, 'dependencies', lockDeps, pkgDeps, problems);
    diffSpecifiers(importer, 'devDependencies', lockDevDeps, pkgDevDeps, problems);
  }

  if (problems.length > 0) {
    console.error('Lockfile specifier validation failed:\n');
    for (const issue of problems) {
      console.error(`- ${issue}`);
    }
    console.error('\nRun: pnpm install --lockfile-only');
    process.exit(1);
  }

  console.log('Lockfile specifiers are in sync with package.json files.');
}

main();
