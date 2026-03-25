import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../config/schema';
import { CheckResult, PRData } from '../config/types';

// Regex patterns for different import styles
const IMPORT_PATTERNS = [
  // JS/TS: import xxx from 'yyy'
  /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
  // JS/TS: require('yyy')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Python: import yyy
  /^import\s+([\w.]+)/gm,
  // Python: from yyy import xxx
  /^from\s+([\w.]+)\s+import/gm,
];

// Known built-in modules that should not be flagged
const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'url', 'http', 'https', 'crypto', 'stream', 'util',
  'events', 'buffer', 'querystring', 'child_process', 'cluster', 'net',
  'dns', 'tls', 'readline', 'zlib', 'assert', 'process', 'vm', 'worker_threads',
  'node:fs', 'node:path', 'node:os', 'node:url', 'node:http', 'node:https',
  'node:crypto', 'node:stream', 'node:util', 'node:events', 'node:buffer',
]);

const PYTHON_BUILTINS = new Set([
  'os', 'sys', 'json', 'math', 'time', 'datetime', 'collections', 'functools',
  'itertools', 'typing', 'pathlib', 'argparse', 'logging', 'unittest', 'io',
  're', 'copy', 'abc', 'enum', 'dataclasses', 'contextlib', 'hashlib', 'hmac',
  'base64', 'secrets', 'uuid', 'random', 'string', 'textwrap', 'struct',
  'threading', 'multiprocessing', 'subprocess', 'socket', 'http', 'urllib',
  'email', 'html', 'xml', 'csv', 'sqlite3', 'pickle', 'shelve', 'gzip',
  'zipfile', 'tarfile', 'tempfile', 'glob', 'shutil', 'pprint', 'inspect',
  'traceback', 'warnings', 'weakref', 'types', 'importlib', 'pkgutil',
]);

// Extract imports from PR diff
function extractImportsFromDiff(files: PRData['files']): Map<string, string[]> {
  const importsByFile = new Map<string, string[]>();

  for (const file of files) {
    if (!file.patch) continue;

    const addedLines = file.patch
      .split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.slice(1)); // Remove leading +

    const imports: string[] = [];
    const fullText = addedLines.join('\n');

    for (const pattern of IMPORT_PATTERNS) {
      // Reset regex
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const importPath = match[1];
        if (importPath) {
          imports.push(importPath);
        }
      }
    }

    if (imports.length > 0) {
      importsByFile.set(file.filename, imports);
    }
  }

  return importsByFile;
}

// Check if a JS/TS import exists in the project
function verifyJSImport(importPath: string, sourceFile: string, workspacePath: string): boolean {
  // Skip built-in modules
  if (NODE_BUILTINS.has(importPath)) return true;

  // Skip scoped and common packages (check node_modules or package.json)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    // It's a package import — check package.json
    const pkgJsonPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        };
        // Check root package name (e.g., "lodash" from "lodash/merge")
        const rootPkg = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];
        if (allDeps[rootPkg]) return true;
      } catch {
        // Can't read package.json
      }
    }
    // Also check if node_modules exists
    const nmPath = path.join(workspacePath, 'node_modules', importPath);
    if (fs.existsSync(nmPath)) return true;

    // Package not found
    return false;
  }

  // Relative import — resolve against source file
  const sourceDir = path.dirname(path.join(workspacePath, sourceFile));
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', ''];

  for (const ext of extensions) {
    const resolved = path.resolve(sourceDir, importPath + ext);
    if (fs.existsSync(resolved)) return true;
    // Check index file
    const indexPath = path.resolve(sourceDir, importPath, `index${ext}`);
    if (fs.existsSync(indexPath)) return true;
  }

  return false;
}

// Check if a Python import exists
function verifyPythonImport(importPath: string, sourceFile: string, workspacePath: string): boolean {
  const rootModule = importPath.split('.')[0];

  // Skip built-in modules
  if (PYTHON_BUILTINS.has(rootModule)) return true;

  // Check requirements.txt
  const reqPath = path.join(workspacePath, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    const reqs = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
    if (reqs.includes(rootModule.toLowerCase())) return true;
  }

  // Check if local module exists
  const modulePath = importPath.replace(/\./g, '/');
  const possiblePaths = [
    path.join(workspacePath, modulePath + '.py'),
    path.join(workspacePath, modulePath, '__init__.py'),
    path.join(workspacePath, 'src', modulePath + '.py'),
    path.join(workspacePath, 'src', modulePath, '__init__.py'),
  ];

  return possiblePaths.some(p => fs.existsSync(p));
}

export function checkImports(pr: PRData, config: Config, workspacePath?: string): CheckResult[] {
  const results: CheckResult[] = [];

  if (!workspacePath || !fs.existsSync(workspacePath)) {
    // No workspace available — skip verification
    return results;
  }

  const importsByFile = extractImportsFromDiff(pr.files);
  const nonExistentImports: { file: string; import: string }[] = [];

  for (const [filename, imports] of importsByFile) {
    const isJS = /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filename);
    const isPython = /\.py$/.test(filename);

    for (const imp of imports) {
      let exists = true;

      if (isJS) {
        exists = verifyJSImport(imp, filename, workspacePath);
      } else if (isPython) {
        exists = verifyPythonImport(imp, filename, workspacePath);
      }

      if (!exists) {
        nonExistentImports.push({ file: filename, import: imp });
      }
    }
  }

  if (nonExistentImports.length > 0) {
    results.push({
      name: 'imports-verified-nonexistent',
      passed: false,
      message: `🔍 Verified non-existent imports (checked against project source):\n${nonExistentImports.map(i => `  • \`${i.import}\` in ${i.file}`).join('\n')}`,
      severity: 'error',
      category: 'slop-pattern',
      score: 0,
    });
  } else if (importsByFile.size > 0) {
    results.push({
      name: 'imports-verified',
      passed: true,
      message: `All imports verified against project source`,
      severity: 'info',
      category: 'files',
      score: 100,
    });
  }

  return results;
}
