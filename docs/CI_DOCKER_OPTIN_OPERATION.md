# CI and Docker Opt-in Operation

This document defines how CI behaves after the stabilization changes on main.

## 1) Build and Test workflow

File: `.github/workflows/build.yml`

- Job `docker-build` is opt-in.
- Default behavior: `docker-build` is skipped.
- Activation: set repository variable `ENABLE_DOCKER_BUILD=true`.

### Docker Hub behavior in Build and Test

- If Docker Hub credentials are present (`DOCKER_USERNAME` and `DOCKER_PASSWORD`), image push is enabled on main.
- If credentials are missing, the job can still run build steps, but push is disabled.

## 2) Deploy to Production workflow

File: `.github/workflows/deploy.yml`

- Deploy target is controlled by repository variable `DEPLOY_PLATFORM`.
- Valid values: `railway`, `render`, `aws`.
- If variable is not set, pipeline resolves target to `none` and skips external deploy steps safely.

### Required secrets by platform

- Railway:
  - `RAILWAY_TOKEN`
- Render:
  - `RENDER_API_KEY`
  - `RENDER_SERVICE_ID`
- AWS ECS:
  - `AWS_ECS_CLUSTER`
  - `AWS_ECS_SERVICE`
  - `AWS_REGION`

### Optional shared secrets

- `SENTRY_DSN`
- `SLACK_WEBHOOK_URL`
- `VITE_API_URL` (for frontend image build args)

## 3) Recommended operation modes

- Daily development mode:
  - `ENABLE_DOCKER_BUILD` unset or different from `true`
  - `DEPLOY_PLATFORM` unset
  - Result: fast CI validation without external deployment coupling

- Release validation mode:
  - `ENABLE_DOCKER_BUILD=true`
  - `DEPLOY_PLATFORM` set to the target platform
  - Required platform secrets configured

## 4) Troubleshooting checklist

- `Build and Test` failed on docker stage:
  - check if `ENABLE_DOCKER_BUILD` should be enabled for this repository
  - verify Dockerfile and build context if docker build is intentionally active

- `Deploy to Production` failed with target validation:
  - verify `DEPLOY_PLATFORM` value is one of `railway`, `render`, `aws`

- `Deploy` failed on secret validation:
  - configure missing platform secrets in repository settings

## 5) Audit note

These changes were made to keep core quality gates (lint, unit tests, e2e, build checks) reliable while avoiding false negatives caused by optional deployment infrastructure.