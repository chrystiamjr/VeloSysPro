---
title: End-to-End GitHub Governance Validation
keywords: github, actions, PR, squash, dependabot, semantic-release, pages, release
---

# End-to-End GitHub Governance Validation

## Overview
When changing GitHub Workflows, Pages deployments, rulesets, Dependabot settings, squash behavior, or semantic-release configurations, treat PR metadata, merge commits, hosted runners, and bot pushes as critical integration boundaries.

## Strict Requirements
1. **Workflow Directives**: Keep workflow-suppression directives exclusively inside intentional automated release commit templates. NEVER reproduce them in PR titles or bodies, as squash merges copy that metadata into the push commit.
2. **Manual Dispatch**: Documentation deployment workflows MUST expose a manual `workflow_dispatch` recovery path.
3. **Branch Permissions**: If release bumps write to a protected branch, scope committed assets and bypass permissions strictly to the official Actions integration.
4. **Post-Merge Verification**: Validate locally across all stacks, then verify real post-merge CI, documentation deployment, release tag, artifact, and public URL before declaring completion.
