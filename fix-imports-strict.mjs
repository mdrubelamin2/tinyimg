import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

function normalizePath(p) {
  // Ensure we don't have trailing slashes or weird double-slashes
  return path.normalize(p).replace(/\\/g, '/');
}

function processFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // This regex matches exactly: from '../some/path'
  // Or import { ... } from "../../path"
  // It does NOT match './path'
  const importRegex = /from\s+['"](\.\.\/[^'"]+)['"]/g;
  
  const newContent = content.replace(importRegex, (match, importPath) => {
    // 1. Determine the absolute location on disk this import actually points to
    const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
    
    // 2. Ensure it resolves to inside the src folder (we don't want to alias external node_modules or weird leaps)
    if (absoluteImportPath.startsWith(SRC_DIR)) {
      // 3. Compute the extremely strict relative path from the 'src' root
      // e.g. /Volumes/Others/projects/tinyimg2/src/constants/index
      // becomes constants/index
      const relativeToSrc = path.relative(SRC_DIR, absoluteImportPath);
      
      // 4. Create the pristine `@/` alias
      const pristineAlias = normalizePath(`@/${relativeToSrc}`);
      
      changed = true;
      return `from '${pristineAlias}'`;
    }
    
    // Fallback if the path goes outside `src`
    return match;
  });
  
  if (changed && content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${path.relative(__dirname, filePath)}`);
  }
}

console.log("Strictly analyzing and rewriting `../` imports to perfect `@/` aliases...");
walkDir(SRC_DIR, processFile);
console.log('Complete.');
