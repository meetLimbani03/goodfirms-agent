from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from langchain_core.messages import ToolMessage

from app.core.logging import logger
from app.schemas.software_review_agent import AgentToolTrace


def execute_tool_calls(
    tool_calls: list[dict[str, Any]],
    *,
    tools_by_name: dict[str, Any],
    starting_order: int = 1,
) -> tuple[list[AgentToolTrace], list[ToolMessage]]:
    if not tool_calls:
        return [], []

    indexed_calls = list(enumerate(tool_calls, start=starting_order))
    max_workers = min(4, len(indexed_calls))
    logger.info(
        "tool_execution_batch_started tool_call_count={tool_call_count} starting_order={starting_order} max_workers={max_workers} tool_names={tool_names}",
        tool_call_count=len(indexed_calls),
        starting_order=starting_order,
        max_workers=max_workers,
        tool_names=",".join(tool_call["name"] for _, tool_call in indexed_calls),
    )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(_invoke_tool, order, tool_call, tools_by_name[tool_call["name"]])
            for order, tool_call in indexed_calls
        ]
        executed = [future.result() for future in futures]

    executed.sort(key=lambda item: item["order"])

    traces: list[AgentToolTrace] = []
    tool_messages: list[ToolMessage] = []
    for item in executed:
        tool_call = item["tool_call"]
        response_markdown = item["response_markdown"]
        traces.append(
            AgentToolTrace(
                order=item["order"],
                tool_name=tool_call["name"],
                arguments={key: _stringify_arg(value) for key, value in tool_call.get("args", {}).items()},
                response_markdown=response_markdown,
            )
        )
        tool_messages.append(
            ToolMessage(
                content=response_markdown,
                tool_call_id=tool_call["id"],
                name=tool_call["name"],
            )
        )
    logger.info(
        "tool_execution_batch_completed executed_count={executed_count} final_order_range={starting_order}-{ending_order}",
        executed_count=len(executed),
        starting_order=starting_order,
        ending_order=starting_order + len(executed) - 1,
    )
    return traces, tool_messages


def _invoke_tool(order: int, tool_call: dict[str, Any], tool: Any) -> dict[str, Any]:
    tool_name = tool_call["name"]
    args = tool_call.get("args", {})
    logger.info(
        "tool_execution_started order={order} tool_name={tool_name} argument_keys={argument_keys}",
        order=order,
        tool_name=tool_name,
        argument_keys=",".join(sorted(args.keys())) or "none",
    )
    try:
        response = tool.invoke(args)
    except Exception as exc:
        logger.exception(
            "tool_execution_failed order={order} tool_name={tool_name} error={error}",
            order=order,
            tool_name=tool_name,
            error=str(exc),
        )
        raise
    response_markdown = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
    logger.info(
        "tool_execution_completed order={order} tool_name={tool_name} response_length={response_length}",
        order=order,
        tool_name=tool_name,
        response_length=len(response_markdown),
    )
    return {
        "order": order,
        "tool_call": tool_call,
        "response_markdown": response_markdown,
    }


def _stringify_arg(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return json.dumps(value, ensure_ascii=False)
