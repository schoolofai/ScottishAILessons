**Source:** https://docs.claude.com/en/api/agent-sdk/hosting

# Hosting the Claude Agent SDK

## Overview

The Claude Agent SDK is a "long-running process" that:
- Executes commands in a persistent shell environment
- Manages file operations within a working directory
- Handles tool execution with contextual interaction history

## Hosting Requirements

### Sandboxing Approach
- Run in containerized environments
- Provide process isolation
- Implement resource limits (CPU, memory, storage)
- Control network connections
- Use ephemeral filesystems

### System Requirements

**Minimum Specifications**:
- Python 3.10+ (Python SDK) or Node.js 18+ (TypeScript SDK)
- Node.js for Claude Code CLI
- Recommended resources:
  * 1 GiB RAM
  * 5 GiB disk space
  * 1 CPU

## Sandbox Provider Options

Recommended providers include:
- AWS Sandboxes
- Cloudflare Sandboxes
- Modal Sandboxes
- Daytona
- E2B
- Fly Machines
- Vercel Sandbox

## Deployment Patterns

### 1. Ephemeral Sessions
- Create container per user task
- Destroy after completion
- Best for one-off tasks

### 2. Long-Running Sessions
- Maintain persistent container instances
- Support multiple agent processes
- Ideal for proactive agents

### 3. Hybrid Sessions
- Containers with resumable state
- Intermittent user interactions
- Supports context preservation

### 4. Single Containers
- Multiple SDK processes in one container
- Requires careful management to prevent conflicts
- Suitable for collaborative agent simulations

## Practical Considerations

**Communication**: Expose ports for SDK instance interactions

**Hosting Cost**: Approximately 5 cents per hour, plus token usage

**Idle Container Management**: Configure timeouts based on expected user response frequency

**Monitoring**: Use standard backend logging infrastructure

**Session Longevity**: No strict timeout, but recommend setting `maxTurns` to prevent infinite loops

The guide emphasizes flexible, secure containerization strategies tailored to specific use cases.
