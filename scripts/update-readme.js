import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const readmePath = path.join(rootDir, 'README.md');

const ignoreList = [
  'node_modules',
  '.git',
  '.DS_Store',
  'dist',
  '.env',
  '.env.local',
  'package-lock.json',
  'scripts' // Don't list the scripts folder itself to keep it clean
];

function generateTree(dir, prefix = '') {
  let output = '';
  const files = fs.readdirSync(dir);
  
  // Filter and sort: directories first, then files
  const filtered = files.filter(f => !ignoreList.includes(f));
  
  const sorted = filtered.sort((a, b) => {
    const aPath = path.join(dir, a);
    const bPath = path.join(dir, b);
    const aStat = fs.statSync(aPath);
    const bStat = fs.statSync(bPath);
    
    if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
    if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
    return a.localeCompare(b);
  });

  sorted.forEach((file, index) => {
    const isLast = index === sorted.length - 1;
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    
    output += `${prefix}${connector}${file}\n`;
    
    if (stats.isDirectory()) {
      output += generateTree(filePath, `${prefix}${childPrefix}`);
    }
  });
  
  return output;
}

function updateReadme() {
  if (!fs.existsSync(readmePath)) {
    console.error('README.md not found!');
    process.exit(1);
  }

  let content = fs.readFileSync(readmePath, 'utf-8');
  const tree = generateTree(rootDir);
  
  const startMarker = '## 📂 Estrutura de Pastas';
  // Find the start of the section
  const startIndex = content.indexOf(startMarker);
  
  if (startIndex === -1) {
    console.log('Section "## 📂 Estrutura de Pastas" not found. Appending it.');
    content += `\n\n${startMarker}\n\n\`\`\`text\n${tree}\`\`\`\n`;
  } else {
    // Find the end of the code block after the marker
    const codeBlockStart = content.indexOf('```text', startIndex);
    if (codeBlockStart !== -1) {
      const codeBlockEnd = content.indexOf('```', codeBlockStart + 7);
      if (codeBlockEnd !== -1) {
        const before = content.substring(0, codeBlockStart);
        const after = content.substring(codeBlockEnd + 3);
        content = `${before}\`\`\`text\n${tree}\`\`\`${after}`;
      }
    } else {
        // If section exists but no code block, append it
        // This is a simple heuristic; might need manual adjustment if the format is different
        console.log('Section found but no code block. Please check README format.');
    }
  }

  fs.writeFileSync(readmePath, content);
  console.log('README.md structure updated successfully!');
}

updateReadme();
