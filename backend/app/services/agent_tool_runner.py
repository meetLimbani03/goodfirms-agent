from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from langchain_core.messages import ToolMessage

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
    return traces, tool_messages


def _invoke_tool(order: int, tool_call: dict[str, Any], tool: Any) -> dict[str, Any]:
    response = tool.invoke(tool_call.get("args", {}))
    return {
        "order": order,
        "tool_call": tool_call,
        "response_markdown": response if isinstance(response, str) else json.dumps(response, ensure_ascii=False),
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
