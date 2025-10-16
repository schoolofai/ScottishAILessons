# Critic Result Schema

## Structure for `sow_critic_result.json`

```json
{
  "overall_score": "float - 0.0 to 1.0",
  "pass": "boolean - true if all dimensions pass thresholds",

  "validation_errors": [
    "array of structural validation errors (empty if none)"
  ],

  "dimensions": {
    "coverage": {
      "score": "float - 0.0 to 1.0",
      "threshold": 0.90,
      "pass": "boolean",
      "issues": ["array of specific issues with locations"],
      "successes": ["array of positive findings"]
    },

    "sequencing": {
      "score": "float",
      "threshold": 0.80,
      "pass": "boolean",
      "issues": ["array"],
      "successes": ["array"]
    },

    "policy": {
      "score": "float",
      "threshold": 0.80,
      "pass": "boolean",
      "issues": ["array"],
      "successes": ["array"]
    },

    "accessibility": {
      "score": "float",
      "threshold": 0.90,
      "pass": "boolean",
      "issues": ["array"],
      "successes": ["array"]
    },

    "authenticity": {
      "score": "float",
      "threshold": 0.90,
      "pass": "boolean",
      "issues": ["array"],
      "successes": ["array"]
    }
  },

  "summary": "string - overall assessment narrative",

  "recommended_actions": [
    "[Critical] [Dimension] Specific actionable fix",
    "[High] [Dimension] Specific actionable fix",
    "[Medium] [Dimension] Specific actionable fix"
  ]
}
```

## Dimension Thresholds

- **Coverage**: ≥0.90 (strict - all standards must be covered with depth)
- **Sequencing**: ≥0.80 (logical flow, teach→revision pairing)
- **Policy**: ≥0.80 (calculator policy, timing, SQA compliance)
- **Accessibility**: ≥0.90 (strict - inclusive design required)
- **Authenticity**: ≥0.90 (strict - Scottish contexts, SQA terminology)

## Overall Scoring

```
overall_score = (
  coverage * 0.25 +
  sequencing * 0.20 +
  policy * 0.15 +
  accessibility * 0.20 +
  authenticity * 0.20
)
```

Pass = ALL dimensions pass their individual thresholds
