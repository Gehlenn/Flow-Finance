---
description: Markitdown - Convert documents to markdown
---

# Markitdown Workflow

## Purpose
Convert various document formats to markdown for Obsidian vault.

## Supported Formats
- PDF → Markdown
- DOCX → Markdown
- HTML → Markdown
- Images (with OCR)

## Usage

### Document Import
```bash
# Convert PDF to vault
markitdown input.pdf > "obsidian-vault/Imports/document.md"

# Batch conversion
markitdown *.pdf --output "obsidian-vault/Imports/"
```

### Integration
```javascript
// In skills
convert_to_vault: (filePath, vaultPath) => {
  run_command: `markitdown "${filePath}" > "${vaultPath}/${basename}.md"`
}
```

## Common Use Cases
1. Import competitor research PDFs
2. Convert meeting notes
3. Archive documentation
4. Extract text from screenshots
