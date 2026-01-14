# CI/CD Setup Guide

> Running content authoring pipelines via GitHub Actions

---

## Overview

The pipeline can be triggered via GitHub Actions for:
- Automated course generation
- Scheduled content updates
- API-triggered workflows

## GitHub Actions Workflow

### Location

`.github/workflows/content-pipeline.yml`

### Workflow Configuration

```yaml
name: Content Authoring Pipeline

on:
  workflow_dispatch:
    inputs:
      subject:
        description: 'SQA Subject (e.g., mathematics, physics)'
        required: true
        type: string
      level:
        description: 'SQA Level (e.g., national_5, higher)'
        required: true
        type: string
      skip_diagrams:
        description: 'Skip diagram generation step'
        required: false
        type: boolean
        default: false
      force:
        description: 'Force regenerate existing content'
        required: false
        type: boolean
        default: false
      dry_run:
        description: 'Dry run mode (no actual execution)'
        required: false
        type: boolean
        default: false
```

## Triggering the Workflow

### Via GitHub UI

1. Go to **Actions** tab in your repository
2. Select **Content Authoring Pipeline**
3. Click **Run workflow**
4. Enter parameters:
   - Subject: `mathematics`
   - Level: `national_5`
   - (Optional) Check skip_diagrams, force, dry_run
5. Click **Run workflow**

### Via GitHub CLI

```bash
gh workflow run content-pipeline.yml \
  -f subject=mathematics \
  -f level=national_5
```

### Via GitHub API

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/content-pipeline.yml/dispatches \
  -d '{"ref":"main","inputs":{"subject":"mathematics","level":"national_5"}}'
```

## Required Secrets

Configure these secrets in **Settings > Secrets and variables > Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `APPWRITE_ENDPOINT` | Yes | Appwrite server URL |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID |
| `APPWRITE_API_KEY` | Yes | Appwrite admin API key |
| `LANGSMITH_API_KEY` | No | LangSmith API key for tracing |
| `DIAGRAM_API_KEY` | No | API key for diagram service |

## Workflow Structure

### Jobs

```yaml
jobs:
  validate:
    # Validates subject/level inputs

  run-pipeline:
    # Runs the actual pipeline
    needs: validate

  notify:
    # Sends notifications
    needs: run-pipeline
```

### Pipeline Job Details

```yaml
run-pipeline:
  runs-on: ubuntu-latest
  timeout-minutes: 480  # 8 hours max

  services:
    # Diagram screenshot service (Docker)
    diagram-screenshot:
      image: ghcr.io/schoolofai/diagram-screenshot:latest
      ports:
        - 3001:3000

  steps:
    - name: Checkout
    - name: Setup Node.js
    - name: Setup Python
    - name: Install Dependencies
    - name: Wait for Diagram Service
    - name: Run Pipeline
    - name: Upload Reports
    - name: Upload Logs
    - name: Post Summary
```

## Artifacts

### Uploaded Artifacts

| Artifact | Contents | Retention |
|----------|----------|-----------|
| `pipeline-reports-{run_id}` | summary.json, metrics.json, events.jsonl | 30 days |
| `pipeline-logs-{run_id}` | pipeline.log, step logs | 7 days |
| `pipeline-checkpoints-{run_id}` | checkpoint.json | 30 days |

### Downloading Artifacts

```bash
# Via GitHub CLI
gh run download {run_id} --name pipeline-reports-{timestamp}

# Via GitHub UI
# Go to Actions > Workflow Run > Artifacts section
```

## Job Summary

After each run, a summary is posted to the workflow:

```markdown
## Pipeline Summary

- **Subject**: mathematics
- **Level**: national_5
- **Status**: ✅ Success
- **Cost**: $28.60
- **Error**: None
```

## Environment Variables

Set in workflow:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  APPWRITE_ENDPOINT: ${{ secrets.APPWRITE_ENDPOINT }}
  APPWRITE_PROJECT_ID: ${{ secrets.APPWRITE_PROJECT_ID }}
  APPWRITE_API_KEY: ${{ secrets.APPWRITE_API_KEY }}
  LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
  LANGSMITH_TRACING: 'true'
  LANGSMITH_PROJECT: 'scottish-ai-lessons-pipeline'
```

## Diagram Service

### Service Container

The workflow runs a Docker container for diagram generation:

```yaml
services:
  diagram-screenshot:
    image: ghcr.io/schoolofai/diagram-screenshot:latest
    ports:
      - 3001:3000
    env:
      API_KEY: ${{ secrets.DIAGRAM_API_KEY }}
    options: >-
      --health-cmd "curl -f http://localhost:3000/health || exit 1"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Health Check

```yaml
- name: Wait for Diagram Service
  if: ${{ !inputs.skip_diagrams }}
  run: |
    for i in {1..30}; do
      if curl -s http://localhost:3001/health > /dev/null; then
        echo "Diagram service is ready!"
        exit 0
      fi
      sleep 2
    done
    echo "Warning: Diagram service may not be ready"
```

## Timeout Configuration

| Step | Timeout |
|------|---------|
| Full workflow | 480 minutes (8 hours) |
| Diagram service wait | 60 seconds |
| Individual steps | Inherited from workflow |

## Notifications

### Success Notification

```yaml
- name: Notify on Success
  if: ${{ needs.run-pipeline.result == 'success' }}
  run: |
    echo "Pipeline completed successfully for ${{ inputs.subject }} / ${{ inputs.level }}"
    # Add Slack/Discord notification here
```

### Failure Notification

```yaml
- name: Notify on Failure
  if: ${{ needs.run-pipeline.result == 'failure' }}
  run: |
    echo "Pipeline failed for ${{ inputs.subject }} / ${{ inputs.level }}"
    # Add Slack/Discord notification here
```

### Adding Slack Notification

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Pipeline ${{ job.status }}: ${{ inputs.subject }} / ${{ inputs.level }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Scheduled Runs

### Weekly Course Refresh

```yaml
on:
  schedule:
    # Every Sunday at 2 AM UTC
    - cron: '0 2 * * 0'
  workflow_dispatch:
    # ... manual trigger options
```

### Multiple Schedules

```yaml
on:
  schedule:
    - cron: '0 2 * * 0'  # Sunday 2 AM - Mathematics
    - cron: '0 3 * * 0'  # Sunday 3 AM - Physics
```

## Matrix Builds

### Generate Multiple Courses

```yaml
jobs:
  generate-courses:
    strategy:
      matrix:
        include:
          - subject: mathematics
            level: national_5
          - subject: physics
            level: higher
          - subject: chemistry
            level: national_5

    steps:
      - name: Run Pipeline
        run: |
          python devops/pipeline_runner.py lessons \
            --subject ${{ matrix.subject }} \
            --level ${{ matrix.level }}
```

## Debugging Failed Workflows

### View Logs

1. Go to **Actions** > Select failed workflow
2. Click on the failed job
3. Expand the failed step
4. Download artifacts for detailed logs

### Re-run with Debug Logging

```yaml
- name: Run Pipeline
  env:
    PIPELINE_LOG_LEVEL: DEBUG
  run: |
    python devops/pipeline_runner.py lessons \
      --subject ${{ inputs.subject }} \
      --level ${{ inputs.level }}
```

### SSH Access (for debugging)

```yaml
- name: Setup tmate session
  if: failure()
  uses: mxschmitt/action-tmate@v3
  timeout-minutes: 15
```

## Best Practices

1. **Use dry-run first**: Test with `dry_run: true` before real execution
2. **Monitor costs**: Check LangSmith/reports for unexpected cost spikes
3. **Set up notifications**: Add Slack/email alerts for failures
4. **Use artifacts**: Always upload reports and logs for debugging
5. **Timeout appropriately**: Full course generation can take 4-8 hours

## Troubleshooting

### Workflow Times Out

- Increase `timeout-minutes` in workflow
- Consider using `--skip-diagrams` for faster runs
- Split into smaller batches

### Diagram Service Fails to Start

- Check Docker image is available
- Verify `DIAGRAM_API_KEY` secret is set
- Use `skip_diagrams: true` to bypass

### API Rate Limits

- Add delays between API calls (built into agents)
- Use smaller batch sizes
- Contact Anthropic for increased limits

## Related Documentation

- [Orchestrator Guide](ORCHESTRATOR_GUIDE.md) - Pipeline architecture
- [Observability](OBSERVABILITY.md) - Monitoring in CI/CD
- [Pipeline Reference](PIPELINE_REFERENCE.md) - All pipeline steps
