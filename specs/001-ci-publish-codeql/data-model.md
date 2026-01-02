# Data Model: CI/Release/Security Workflows

This feature is primarily configuration and does not introduce persistent application data.

## Entities

### Workflow
Represents an automation pipeline.

**Fields**:
- `name`: string
- `triggers`: event set (push, pull_request, workflow_dispatch, schedule, release)
- `concurrency`: concurrency policy
- `permissions`: GitHub token permissions map

### Job
Represents a unit of work within a workflow.

**Fields**:
- `name`: string
- `runsOn`: runner label (e.g., ubuntu-latest)
- `strategy`: optional matrix definition
- `steps`: ordered list

### Step
Represents a single action or command.

**Fields**:
- `uses`: action reference *or* `run`: shell script
- `env`: environment variables

### Secret
Represents repository-level secret inputs.

**Fields**:
- `name`: e.g., `NPM_TOKEN`
- `requiredFor`: list of jobs/steps

## Relationships

- A **Workflow** contains many **Jobs**.
- A **Job** contains many **Steps**.
- A **Secret** is consumed by one or more **Steps** (typically in publish jobs).

## Validation Rules

- Publish must never run on PR events.
- Publish must be gated on semver-tagged releases and manual confirmation for workflow dispatch.
- CI installs must be reproducible (lockfile must not change).
- Workflows should declare least-privilege permissions.
