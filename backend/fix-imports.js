/**
 * fix-imports.js
 * 
 * This script fixes ES module imports in the compiled JavaScript files by adding .js extensions
 * to local imports. This is necessary for proper module resolution in production environments.
 */

import fs from 'fs';
import path from 'path';

const distDir = path.resolve('./dist');

/**
 * Add .js extension to local imports in a file
 * @param {string} filePath - Path to the JavaScript file
 */
function fixImportsInFile(filePath) {
  console.log(`Processing ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add .js extension to local imports (but not to package imports)
    // This regex matches import statements with relative paths (./ or ../) without file extensions
    const importRegex = /from\s+['"](\.\.\/|\.\/)([^'"]+)(?!\.js)['"];/g;
    content = content.replace(importRegex, (match, prefix, importPath) => {
      return `from '${prefix}${importPath}.js';`;
    });
    
    // Fix any duplicate .js extensions that might have been added
    const duplicateJsRegex = /\.js\.js/g;
    content = content.replace(duplicateJsRegex, '.js');
    
    // Also fix dynamic imports
    const dynamicImportRegex = /import\(\s*['"](\.\.\/|\.\/)([^'"]+)(?!\.js)['"]\s*\)/g;
    content = content.replace(dynamicImportRegex, (match, prefix, importPath) => {
      return `import('${prefix}${importPath}.js')`;
    });
    
    // Fix any duplicate .js extensions in dynamic imports
    const duplicateDynamicJsRegex = /\.js'\.js/g;
    content = content.replace(duplicateDynamicJsRegex, '.js');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed imports in ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

/**
 * Recursively process all JavaScript files in a directory
 * @param {string} dir - Directory to process
 */
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.test.js') && !file.endsWith('.min.js')) {
      fixImportsInFile(filePath);
    }
  }
}

// Start processing the dist directory
console.log('🔧 Fixing ES module imports...');
processDirectory(distDir);
console.log('✅ All imports fixed!');