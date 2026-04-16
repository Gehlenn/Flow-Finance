---
description: n8n-MCP - Workflow automation integration
---

# n8n-MCP Workflow

## Purpose
Integrate n8n workflow automation with both projects for:
- Scheduled tasks (backups, reports)
- Notifications (deploys, errors)
- Data sync (analytics, monitoring)

## Configuration
```yaml
n8n_url: "http://localhost:5678"
webhook_base: "https://hooks.n8n.io"
projects:
  mmorpg:
    webhooks:
      deploy: "/mmorpg/deploy"
      error: "/mmorpg/alert"
  flow:
    webhooks:
      payment: "/flow/payment-received"
      report: "/flow/daily-report"
```

## Common Workflows

### MMORPG
1. **Daily Backup** → Obsidian vault backup
2. **Error Alert** → Discord notification
3. **Deploy Hook** → Post-deploy verification

### Flow Finance
1. **Payment Received** → Invoice generation
2. **Daily Report** → Cash flow summary
3. **Failed Payment** → Retry + notify

## Usage
```javascript
// Trigger from code
fetch(`${N8N_WEBHOOK}/mmorpg/deploy`, {
  method: 'POST',
  body: JSON.stringify({ version, timestamp })
});
```
