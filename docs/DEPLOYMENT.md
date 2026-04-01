# Flow Finance - Deployment Guides

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/Flow-Finance.git
cd Flow-Finance

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env

# Start with Docker Compose
docker-compose up -d
```

## AWS ECS/Fargate Deployment

### 1. Create ECR Repositories
```bash
aws ecr create-repository --repository-name flow-finance/frontend --region us-east-1
aws ecr create-repository --repository-name flow-finance/backend --region us-east-1
```

### 2. Build and Push Images
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and tag images
docker build -f Dockerfile.frontend -t flow-finance/frontend:latest .
docker build -f backend/Dockerfile -t flow-finance/backend:latest .

# Tag for ECR
docker tag flow-finance/frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/flow-finance/frontend:latest
docker tag flow-finance/backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/flow-finance/backend:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/flow-finance/frontend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/flow-finance/backend:latest
```

### 3. Create ECS Cluster and Services
```bash
# Create cluster
aws ecs create-cluster --cluster-name flow-finance

# Create task definitions (use AWS Console or CLI)
# Create services for frontend and backend
# Configure load balancer and target groups
```

### 4. Environment Variables
Set these in ECS task definitions:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret
# ... other vars
```

## Render Deployment

### 1. Connect Repository
- Go to Render Dashboard
- Click "New" → "Web Service"
- Connect your GitHub repository

### 2. Configure Services

#### Backend Service
- **Name:** Flow Finance API
- **Environment:** Node
- **Build Command:** `cd backend && npm install`
- **Start Command:** `cd backend && npm start`
- **Environment Variables:** Copy from `.env.example`

#### Frontend Service
- **Name:** Flow Finance Frontend
- **Environment:** Static Site
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:**
  ```
  VITE_API_URL=https://your-backend-service.onrender.com
  VITE_SENTRY_DSN=your-sentry-dsn
  ```

#### PostgreSQL Database
- **Name:** Flow Finance DB
- **Database:** PostgreSQL
- **Plan:** Starter (free) or Professional

#### Redis Cache
- **Name:** Flow Finance Redis
- **Database:** Redis
- **Plan:** Starter (free) or Professional

### 3. Database Setup
After creating PostgreSQL service, run the init script:
```bash
# Connect to database
psql YOUR_DATABASE_URL < docker/postgres/init.sql
```

## Railway Deployment

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Deploy
```bash
# Initialize project
railway init

# Add services
railway add postgres
railway add redis

# Deploy
railway deploy
```

### 3. Environment Variables
Set in Railway dashboard:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=your-secret
# ... other vars
```

## DigitalOcean App Platform

### 1. Create App
- Go to DigitalOcean Dashboard
- Apps → Create App
- Connect GitHub repository

### 2. Configure Resources

#### Frontend Component
- **Type:** Static Site
- **Source:** `/`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  ```
  VITE_API_URL=${api.URL}
  VITE_SENTRY_DSN=your-sentry-dsn
  ```

#### Backend Component
- **Type:** Service
- **Source:** `/backend`
- **Build Command:** `npm install`
- **Run Command:** `npm start`
- **Environment Variables:** All from `.env.example`

#### Database Component
- **Type:** Database
- **Engine:** PostgreSQL
- **Plan:** Basic (for development) or Professional

#### Cache Component
- **Type:** Database
- **Engine:** Redis
- **Plan:** Basic

### 3. Domain Configuration
- Add custom domain in App settings
- Configure SSL certificate (automatic)

## General Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up monitoring alerts
- [ ] Enable database backups

### Performance
- [ ] Configure CDN (Cloudflare, AWS CloudFront)
- [ ] Set up database indexes
- [ ] Configure Redis clustering (if needed)
- [ ] Enable compression

### Monitoring
- [ ] Set up Sentry error tracking
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring
- [ ] Configure performance monitoring

### Backup & Recovery
- [ ] Database automated backups
- [ ] File storage backups
- [ ] Disaster recovery plan
- [ ] Regular restore testing

## Troubleshooting

### Common Issues

#### Database Connection
```bash
# Test connection
psql YOUR_DATABASE_URL -c "SELECT version();"
```

#### Redis Connection
```bash
# Test connection
redis-cli -u YOUR_REDIS_URL ping
```

#### Container Logs
```bash
# Docker logs
docker-compose logs -f

# Specific service
docker-compose logs backend
```

#### Health Checks
```bash
# API health
curl https://your-api-domain.com/health

# Frontend health
curl https://your-frontend-domain.com
```

## Support

For deployment issues:
1. Check logs: `docker-compose logs`
2. Verify environment variables
3. Test database connectivity
4. Check firewall/security groups
5. Review platform-specific documentation