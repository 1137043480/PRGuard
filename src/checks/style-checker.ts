import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../config/schema';
import { CheckResult, PRData } from '../config/types';

// Detect naming convention from identifier
function detectNamingStyle(name: string): 'camelCase' | 'snake_case' | 'PascalCase' | 'UPPER_CASE' | 'unknown' {
  if (/^[A-Z][A-Z0-9_]+$/.test(name)) return 'UPPER_CASE';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
  if (/^[a-z][a-z0-9_]*$/.test(name)) return 'snake_case';
  return 'unknown';
}

// Extract function/variable names from code
function extractIdentifiers(code: string, lang: 'js' | 'python'): string[] {
  const names: string[] = [];

  if (lang === 'js') {
    // JS/TS function and variable names
    const patterns = [
      /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=>|\()/g,
    ];
    for (const p of patterns) {
      p.lastIndex = 0;
      let m;
      while ((m = p.exec(code)) !== null) {
        if (m[1] && m[1].length > 2) names.push(m[1]);
      }
    }
  } else if (lang === 'python') {
    // Python function and variable names
    const patterns = [
      /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
    ];
    for (const p of patterns) {
      p.lastIndex = 0;
      let m;
      while ((m = p.exec(code)) !== null) {
        if (m[1] && m[1].length > 2) names.push(m[1]);
      }
    }
  }

  return names;
}

// Detect indent style
function detectIndentStyle(code: string): { type: 'spaces' | 'tabs'; size: number } {
  const lines = code.split('\n').filter(l => l.match(/^[\t ]+\S/));
  let tabs = 0;
  let spaces = 0;
  const spaceCounts: number[] = [];

  for (const line of lines) {
    if (line.startsWith('\t')) {
      tabs++;
    } else {
      const match = line.match(/^( +)/);
      if (match) {
        spaces++;
        spaceCounts.push(match[1].length);
      }
    }
  }

  if (tabs > spaces) {
    return { type: 'tabs', size: 1 };
  }

  // Find most common indent size
  const sizes = spaceCounts.filter(s => s <= 8);
  const minIndent = sizes.length > 0 ? Math.min(...sizes) : 2;
  return { type: 'spaces', size: minIndent || 2 };
}

// Sample existing project code to detect dominant style
function sampleProjectStyle(workspacePath: string, lang: 'js' | 'python'): {
  namingConvention: string;
  indentStyle: { type: string; size: number };
} | null {
  const extensions = lang === 'js' ? ['.ts', '.tsx', '.js', '.jsx'] : ['.py'];
  const srcDirs = ['src', 'lib', 'app', '.'];
  const sampleFiles: string[] = [];

  // Find source files to sample (max 10)
  for (const dir of srcDirs) {
    const fullDir = path.join(workspacePath, dir);
    if (!fs.existsSync(fullDir)) continue;
    try {
      const files = fs.readdirSync(fullDir, { recursive: true }) as string[];
      for (const file of files) {
        const filePath = typeof file === 'string' ? file : '';
        if (extensions.some(ext => filePath.endsWith(ext)) && !filePath.includes('node_modules')) {
          sampleFiles.push(path.join(fullDir, filePath));
          if (sampleFiles.length >= 10) break;
        }
      }
    } catch {
      continue;
    }
    if (sampleFiles.length >= 10) break;
  }

  if (sampleFiles.length === 0) return null;

  // Analyze naming conventions
  const styleCounts: Record<string, number> = {};
  let combinedCode = '';

  for (const file of sampleFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8').slice(0, 5000); // First 5KB
      combinedCode += content + '\n';
      const identifiers = extractIdentifiers(content, lang);
      for (const id of identifiers) {
        const style = detectNamingStyle(id);
        if (style !== 'unknown') {
          styleCounts[style] = (styleCounts[style] || 0) + 1;
        }
      }
    } catch {
      continue;
    }
  }

  const dominantNaming = Object.entries(styleCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  const indentStyle = detectIndentStyle(combinedCode);

  return { namingConvention: dominantNaming, indentStyle };
}

export function checkCodeStyle(pr: PRData, config: Config, workspacePath?: string): CheckResult[] {
  const results: CheckResult[] = [];

  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return results;
  }

  // Determine language from PR files
  const hasJS = pr.files.some(f => /\.(js|jsx|ts|tsx)$/.test(f.filename));
  const hasPython = pr.files.some(f => /\.py$/.test(f.filename));
  const lang: 'js' | 'python' = hasJS ? 'js' : hasPython ? 'python' : 'js';

  // Sample project style
  const projectStyle = sampleProjectStyle(workspacePath, lang);
  if (!projectStyle) return results;

  // Extract PR code identifiers
  const prCode = pr.files
    .filter(f => f.patch)
    .map(f => f.patch!.split('\n').filter(l => l.startsWith('+')).map(l => l.slice(1)).join('\n'))
    .join('\n');

  const prIdentifiers = extractIdentifiers(prCode, lang);
  if (prIdentifiers.length < 3) return results; // Not enough to analyze

  // Check naming convention mismatch
  const prStyleCounts: Record<string, number> = {};
  for (const id of prIdentifiers) {
    const style = detectNamingStyle(id);
    if (style !== 'unknown' && style !== 'UPPER_CASE') { // Ignore constants
      prStyleCounts[style] = (prStyleCounts[style] || 0) + 1;
    }
  }

  const prDominantStyle = Object.entries(prStyleCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  if (prDominantStyle && projectStyle.namingConvention !== 'unknown' &&
      prDominantStyle !== projectStyle.namingConvention) {
    const total = Object.values(prStyleCounts).reduce((a, b) => a + b, 0);
    const mismatchCount = prStyleCounts[prDominantStyle] || 0;
    const mismatchRatio = mismatchCount / total;

    if (mismatchRatio > 0.5) {
      results.push({
        name: 'style-naming-mismatch',
        passed: false,
        message: `PR uses ${prDominantStyle} naming but project uses ${projectStyle.namingConvention} — code style doesn't match project conventions`,
        severity: 'warning',
        category: 'style',
        score: 30,
      });
    }
  }

  // Check indent style from PR diff
  const prIndent = detectIndentStyle(prCode);
  if (prIndent.type !== projectStyle.indentStyle.type ||
      (prIndent.type === 'spaces' && prIndent.size !== projectStyle.indentStyle.size)) {
    results.push({
      name: 'style-indent-mismatch',
      passed: false,
      message: `PR uses ${prIndent.type} (${prIndent.size}) but project uses ${projectStyle.indentStyle.type} (${projectStyle.indentStyle.size})`,
      severity: 'info',
      category: 'style',
      score: 60,
    });
  }

  // If everything matches
  if (results.length === 0 && prIdentifiers.length >= 3) {
    results.push({
      name: 'style-consistent',
      passed: true,
      message: 'PR code style is consistent with project conventions',
      severity: 'info',
      category: 'style',
      score: 100,
    });
  }

  return results;
}
