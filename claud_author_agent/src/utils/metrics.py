"""Cost tracking and metrics reporting for SOW author agent.

Tracks token usage and costs per subagent and aggregates total costs
for the entire pipeline execution.
"""

import logging
from typing import Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SubagentMetrics:
    """Metrics for a single subagent execution."""
    name: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0
    execution_time_seconds: float = 0.0
    success: bool = False
    error_message: str = ""


@dataclass
class CostTracker:
    """Tracks costs and metrics across all subagent executions.

    Attributes:
        execution_id: Unique identifier for this execution
        subagent_metrics: Dictionary of subagent name to metrics
        total_input_tokens: Aggregate input tokens across all subagents
        total_output_tokens: Aggregate output tokens across all subagents
        total_cost: Aggregate estimated cost across all subagents
    """
    execution_id: str
    subagent_metrics: Dict[str, SubagentMetrics] = field(default_factory=dict)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: float = 0.0

    def record_subagent(
        self,
        name: str,
        input_tokens: int,
        output_tokens: int,
        cost: float,
        execution_time: float,
        success: bool = True,
        error: str = ""
    ):
        """Record metrics for a subagent execution.

        Args:
            name: Subagent name (e.g., 'research_subagent')
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated
            cost: Estimated cost in USD
            execution_time: Execution time in seconds
            success: Whether execution succeeded
            error: Error message if failed
        """
        metrics = SubagentMetrics(
            name=name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            estimated_cost=cost,
            execution_time_seconds=execution_time,
            success=success,
            error_message=error
        )

        self.subagent_metrics[name] = metrics

        # Update totals
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_cost += cost

        logger.info(
            f"Subagent '{name}' metrics: "
            f"{input_tokens} input tokens, {output_tokens} output tokens, "
            f"${cost:.4f}, {execution_time:.2f}s"
        )

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all metrics.

        Returns:
            Dictionary containing aggregated metrics
        """
        return {
            "execution_id": self.execution_id,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_cost_usd": round(self.total_cost, 4),
            "subagent_count": len(self.subagent_metrics),
            "subagents": {
                name: {
                    "input_tokens": m.input_tokens,
                    "output_tokens": m.output_tokens,
                    "total_tokens": m.total_tokens,
                    "cost_usd": round(m.estimated_cost, 4),
                    "execution_time_seconds": round(m.execution_time_seconds, 2),
                    "success": m.success,
                    "error": m.error_message
                }
                for name, m in self.subagent_metrics.items()
            }
        }


def format_cost_report(tracker: CostTracker, agent_name: str = "AGENT") -> str:
    """Format cost tracker data as a readable report.

    Args:
        tracker: CostTracker instance with recorded metrics
        agent_name: Name of the agent for report title (default: "AGENT")

    Returns:
        Formatted string report
    """
    summary = tracker.get_summary()

    report_lines = [
        "=" * 80,
        f"{agent_name} EXECUTION REPORT - {summary['execution_id']}",
        "=" * 80,
        "",
        "AGGREGATE METRICS:",
        f"  Total Tokens: {summary['total_tokens']:,} ({summary['total_input_tokens']:,} input + {summary['total_output_tokens']:,} output)",
        f"  Total Cost: ${summary['total_cost_usd']:.4f}",
        f"  Subagents Executed: {summary['subagent_count']}",
        "",
        "PER-SUBAGENT BREAKDOWN:",
        "-" * 80
    ]

    for name, metrics in summary['subagents'].items():
        status = "✓ SUCCESS" if metrics['success'] else "✗ FAILED"
        report_lines.extend([
            f"  {name} - {status}",
            f"    Tokens: {metrics['total_tokens']:,} ({metrics['input_tokens']:,} input + {metrics['output_tokens']:,} output)",
            f"    Cost: ${metrics['cost_usd']:.4f}",
            f"    Time: {metrics['execution_time_seconds']:.2f}s"
        ])

        if not metrics['success'] and metrics['error']:
            report_lines.append(f"    Error: {metrics['error']}")

        report_lines.append("")

    report_lines.append("=" * 80)

    return "\n".join(report_lines)
