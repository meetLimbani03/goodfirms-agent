from __future__ import annotations

from contextlib import asynccontextmanager

from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import logger, setup_logging
from app.db.mysql import MySQLManager
from app.db.mongo import MongoManager
from app.db.postgres import PostgresManager
from app.db.repositories.agent_runs import AgentRunRepository
from app.db.repositories.service_reviews import ServiceReviewRepository
from app.db.repositories.software_reviews import SoftwareReviewRepository
from app.db.repositories.users import UserRepository
from app.schemas.software_review_agent import (
    AgentRunListItem,
    AgentRunFeedback,
    AgentRunFeedbackUpdateRequest,
    AgentRunMetadata,
    AgentToolTrace,
    OpenRouterUsageCall,
    OpenRouterUsageSummary,
    SoftwareReviewAgentOutput,
    SoftwareReviewAgentResponse,
)
from app.services.public_web_search import PublicWebSearchService
from app.services.reviewer_history import ReviewerHistoryLookupService
from app.services.service_review_agent import ServiceReviewAgentService
from app.services.service_review_context import ServiceReviewContextBuilder
from app.services.software_review_agent import SoftwareReviewAgentService
from app.services.software_review_context import SoftwareReviewContextBuilder


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings)
    logger.info("Starting backend application")
    app.state.mongo = MongoManager(settings)
    app.state.mysql = MySQLManager(settings)
    app.state.postgres = PostgresManager(settings)
    mongo_ok = app.state.mongo.ping()
    mysql_ok = app.state.mysql.ping()
    postgres_ok = app.state.postgres.ping()
    logger.info("MongoDB connection status: {status}", status="up" if mongo_ok else "down")
    logger.info("MySQL connection status: {status}", status="up" if mysql_ok else "down")
    logger.info("PostgreSQL connection status: {status}", status="up" if postgres_ok else "down")
    yield
    logger.info("Shutting down backend application")
    app.state.mongo.close()
    app.state.mysql.close()
    app.state.postgres.close()


app = FastAPI(title="GoodFirms Backend", lifespan=lifespan)
settings = get_settings()

if settings.cors_allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/")
def root() -> str:
    logger.debug("Root endpoint called")
    return "pong"


@app.get("/health")
def health(request: Request) -> dict[str, object]:
    mongo_manager: MongoManager = request.app.state.mongo
    mysql_manager: MySQLManager = request.app.state.mysql
    postgres_manager: PostgresManager = request.app.state.postgres
    mongo_ok = mongo_manager.ping()
    mysql_ok = mysql_manager.ping()
    postgres_ok = postgres_manager.ping()
    logger.info(
        "Health check completed: mongodb={mongodb_status}, mysql={mysql_status}, postgres={postgres_status}",
        mongodb_status="up" if mongo_ok else "down",
        mysql_status="up" if mysql_ok else "down",
        postgres_status="up" if postgres_ok else "down",
    )

    return {
        "status": "ok" if mongo_ok and mysql_ok and postgres_ok else "degraded",
        "services": {
            "mongodb": {
                "status": "up" if mongo_ok else "down",
            },
            "mysql": {
                "status": "up" if mysql_ok else "down",
                "database": mysql_manager.connection.db.decode() if mysql_ok else None,
            },
            "postgres": {
                "status": "up" if postgres_ok else "down",
                "configured": postgres_manager.configured,
            },
        },
    }


@app.post(
    "/api/software-reviews/{review_id}/agent-run",
    response_model=SoftwareReviewAgentResponse,
    response_model_exclude_none=True,
)
def run_software_review_agent(
    review_id: str,
    request: Request,
    test: bool = Query(
        default=False,
        description="When true, bypass the pending-status gate so approved/rejected reviews can be run for evaluation.",
    ),
) -> SoftwareReviewAgentResponse:
    mongo_manager: MongoManager = request.app.state.mongo
    mysql_manager: MySQLManager = request.app.state.mysql
    postgres_manager: PostgresManager = request.app.state.postgres
    settings = get_settings()

    review_repository = SoftwareReviewRepository(mongo_manager)
    service_review_repository = ServiceReviewRepository(mysql_manager)
    user_repository = UserRepository(mysql_manager)
    context_builder = SoftwareReviewContextBuilder(review_repository, user_repository, service_review_repository)
    reviewer_history_service = ReviewerHistoryLookupService(review_repository, service_review_repository)
    public_web_search_service = PublicWebSearchService(settings.serpapi)
    agent_service = SoftwareReviewAgentService(settings, reviewer_history_service, public_web_search_service)
    persisted_run_id: str | None = None

    if postgres_manager.configured:
        with postgres_manager.session() as session:
            run = AgentRunRepository(session).create_started_run(
                review_type="software",
                review_id=review_id,
                test_mode=test,
                trigger_source="manual_api",
            )
            persisted_run_id = str(run.id)

    try:
        context = context_builder.build(review_id, test_mode=test)
    except LookupError as exc:
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        agent_run_result = agent_service.run(context)
    except Exception as exc:  # pragma: no cover - network/model failures
        _mark_agent_run_failed(request, persisted_run_id, error_stage="agent_call", error_message=str(exc))
        logger.exception("Software review agent call failed for review_id={review_id}", review_id=review_id)
        raise HTTPException(status_code=502, detail="Software review agent call failed") from exc
    output = agent_run_result.output

    completed_run = None
    if persisted_run_id is not None:
        with postgres_manager.session() as session:
            completed_run = AgentRunRepository(session).mark_completed(
                persisted_run_id,
                model=settings.openrouter.model,
                final_decision=output.final_decision,
                decision_summary=output.decision_summary,
                reject_reason=output.reject_reason,
                prompt_markdown=context.prompt_markdown,
                context_markdown=context.context_markdown,
                context_payload=context.payload,
                review_metadata=context.metadata,
                tool_traces=[trace.model_dump() for trace in agent_run_result.tool_traces],
                llm_usage_summary=agent_run_result.llm_usage_summary.model_dump(),
                llm_usage_calls=[call.model_dump() for call in agent_run_result.llm_usage_calls],
                output_payload=output.model_dump(exclude_none=True),
            )

    if completed_run is not None:
        return _agent_run_response_from_record(completed_run)

    return SoftwareReviewAgentResponse(
        run_id=persisted_run_id,
        review_id=review_id,
        model=settings.openrouter.model,
        prompt_markdown=context.prompt_markdown,
        context_markdown=context.context_markdown,
        context_payload=context.payload,
        review_metadata=context.metadata,
        run_metadata=AgentRunMetadata(
            status="completed",
            trigger_source="manual_api",
            test_mode=test,
            created_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        ),
        tool_traces=agent_run_result.tool_traces,
        llm_usage_summary=agent_run_result.llm_usage_summary,
        llm_usage_calls=agent_run_result.llm_usage_calls,
        review_feedback=None,
        output=output,
    )


@app.post(
    "/api/service-reviews/{review_id}/agent-run",
    response_model=SoftwareReviewAgentResponse,
    response_model_exclude_none=True,
)
def run_service_review_agent(
    review_id: str,
    request: Request,
    test: bool = Query(
        default=False,
        description="When true, bypass the pending-status gate so published/rejected reviews can be run for evaluation.",
    ),
) -> SoftwareReviewAgentResponse:
    mongo_manager: MongoManager = request.app.state.mongo
    mysql_manager: MySQLManager = request.app.state.mysql
    postgres_manager: PostgresManager = request.app.state.postgres
    settings = get_settings()

    software_review_repository = SoftwareReviewRepository(mongo_manager)
    review_repository = ServiceReviewRepository(mysql_manager)
    user_repository = UserRepository(mysql_manager)
    context_builder = ServiceReviewContextBuilder(review_repository, user_repository, software_review_repository)
    reviewer_history_service = ReviewerHistoryLookupService(software_review_repository, review_repository)
    public_web_search_service = PublicWebSearchService(settings.serpapi)
    agent_service = ServiceReviewAgentService(settings, reviewer_history_service, public_web_search_service)
    persisted_run_id: str | None = None

    if postgres_manager.configured:
        with postgres_manager.session() as session:
            run = AgentRunRepository(session).create_started_run(
                review_type="service",
                review_id=review_id,
                test_mode=test,
                trigger_source="manual_api",
            )
            persisted_run_id = str(run.id)

    try:
        context = context_builder.build(review_id, test_mode=test)
    except LookupError as exc:
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        agent_run_result = agent_service.run(context)
    except Exception as exc:  # pragma: no cover - network/model failures
        _mark_agent_run_failed(request, persisted_run_id, error_stage="agent_call", error_message=str(exc))
        logger.exception("Service review agent call failed for review_id={review_id}", review_id=review_id)
        raise HTTPException(status_code=502, detail="Service review agent call failed") from exc
    output = agent_run_result.output

    completed_run = None
    if persisted_run_id is not None:
        with postgres_manager.session() as session:
            completed_run = AgentRunRepository(session).mark_completed(
                persisted_run_id,
                model=settings.openrouter.model,
                final_decision=output.final_decision,
                decision_summary=output.decision_summary,
                reject_reason=output.reject_reason,
                prompt_markdown=context.prompt_markdown,
                context_markdown=context.context_markdown,
                context_payload=context.payload,
                review_metadata=context.metadata,
                tool_traces=[trace.model_dump() for trace in agent_run_result.tool_traces],
                llm_usage_summary=agent_run_result.llm_usage_summary.model_dump(),
                llm_usage_calls=[call.model_dump() for call in agent_run_result.llm_usage_calls],
                output_payload=output.model_dump(exclude_none=True),
            )

    if completed_run is not None:
        return _agent_run_response_from_record(completed_run)

    return SoftwareReviewAgentResponse(
        run_id=persisted_run_id,
        review_id=review_id,
        model=settings.openrouter.model,
        prompt_markdown=context.prompt_markdown,
        context_markdown=context.context_markdown,
        context_payload=context.payload,
        review_metadata=context.metadata,
        run_metadata=AgentRunMetadata(
            status="completed",
            trigger_source="manual_api",
            test_mode=test,
            created_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        ),
        tool_traces=agent_run_result.tool_traces,
        llm_usage_summary=agent_run_result.llm_usage_summary,
        llm_usage_calls=agent_run_result.llm_usage_calls,
        review_feedback=None,
        output=output,
    )


@app.get("/api/agent-runs", response_model=list[AgentRunListItem], response_model_exclude_none=True)
def list_agent_runs(
    request: Request,
    review_type: str = Query(..., pattern="^(software|service)$"),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AgentRunListItem]:
    postgres_manager: PostgresManager = request.app.state.postgres
    if not postgres_manager.configured:
        raise HTTPException(status_code=503, detail="PostgreSQL is not configured")

    with postgres_manager.session() as session:
        runs = AgentRunRepository(session).list_completed_runs(review_type=review_type, limit=limit)
        return [_agent_run_list_item_from_record(run) for run in runs]


@app.get(
    "/api/agent-runs/{run_id}",
    response_model=SoftwareReviewAgentResponse,
    response_model_exclude_none=True,
)
def get_agent_run_detail(run_id: str, request: Request) -> SoftwareReviewAgentResponse:
    postgres_manager: PostgresManager = request.app.state.postgres
    if not postgres_manager.configured:
        raise HTTPException(status_code=503, detail="PostgreSQL is not configured")

    with postgres_manager.session() as session:
        run = AgentRunRepository(session).get_run(run_id)
        if run is None or run.status != "completed":
            raise HTTPException(status_code=404, detail="Agent run not found")
        return _agent_run_response_from_record(run)


@app.post(
    "/api/agent-runs/{run_id}/feedback",
    response_model=SoftwareReviewAgentResponse,
    response_model_exclude_none=True,
)
def submit_agent_run_feedback(
    run_id: str,
    feedback_request: AgentRunFeedbackUpdateRequest,
    request: Request,
) -> SoftwareReviewAgentResponse:
    postgres_manager: PostgresManager = request.app.state.postgres
    if not postgres_manager.configured:
        raise HTTPException(status_code=503, detail="PostgreSQL is not configured")

    with postgres_manager.session() as session:
        repository = AgentRunRepository(session)
        run = repository.get_run(run_id)
        if run is None or run.status != "completed":
            raise HTTPException(status_code=404, detail="Agent run not found")
        updated_run = repository.update_feedback(run_id, feedback=feedback_request.feedback.strip())
        return _agent_run_response_from_record(updated_run)


def _mark_agent_run_failed(
    request: Request,
    run_id: str | None,
    *,
    error_stage: str,
    error_message: str,
) -> None:
    if run_id is None:
        return

    postgres_manager: PostgresManager = request.app.state.postgres
    if not postgres_manager.configured:
        return

    with postgres_manager.session() as session:
        AgentRunRepository(session).mark_failed(run_id, error_stage=error_stage, error_message=error_message)


def _agent_run_list_item_from_record(run) -> AgentRunListItem:
    context_payload = run.context_payload or {}
    review_content = context_payload.get("review_content") or {}
    reviewer = ((context_payload.get("reviewer") or {}).get("resolved")) or {}
    subject_payload = context_payload.get("subject") or {}
    subject_name = subject_payload.get("name") or subject_payload.get("company_name") or run.review_id
    normalized_output = _normalized_output_payload(run)

    return AgentRunListItem(
        run_id=str(run.id),
        review_type=run.review_type,
        review_id=run.review_id,
        status=run.status,
        final_decision=normalized_output.get("final_decision"),
        created_at=_iso_datetime(run.created_at),
        completed_at=_iso_datetime(run.completed_at),
        test_mode=bool(run.test_mode),
        review_title=_text(review_content.get("headline")) or run.review_id,
        subject_name=_text(subject_name) or run.review_id,
        reviewer_name=_text(reviewer.get("name")) or "Unknown reviewer",
        model=run.model,
    )


def _agent_run_response_from_record(run) -> SoftwareReviewAgentResponse:
    normalized_output = _normalized_output_payload(run)
    return SoftwareReviewAgentResponse(
        run_id=str(run.id),
        review_id=run.review_id,
        model=run.model or "",
        prompt_markdown=run.prompt_markdown or "",
        context_markdown=run.context_markdown or "",
        context_payload=run.context_payload or {},
        review_metadata=run.review_metadata or {},
        run_metadata=AgentRunMetadata(
            status=run.status,
            trigger_source=run.trigger_source,
            test_mode=bool(run.test_mode),
            created_at=_iso_datetime(run.created_at),
            completed_at=_iso_datetime(run.completed_at),
            error_stage=run.error_stage,
            error_message=run.error_message,
        ),
        tool_traces=[AgentToolTrace.model_validate(item) for item in (run.tool_traces or [])],
        llm_usage_summary=OpenRouterUsageSummary.model_validate(run.llm_usage_summary or {}),
        llm_usage_calls=[OpenRouterUsageCall.model_validate(item) for item in (run.llm_usage_calls or [])],
        review_feedback=_review_feedback_from_record(run),
        output=SoftwareReviewAgentOutput.model_validate(normalized_output),
    )


def _iso_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _text(value: object) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def _normalized_output_payload(run) -> dict[str, object]:
    payload = dict(run.output_payload or {})
    final_decision = payload.get("final_decision") or run.final_decision
    if not final_decision:
        legacy_decision = _text(payload.get("decision"))
        if legacy_decision in {
            "verified_pass",
            "verified_with_minor_fixes",
            "needs_manual_review",
            "reject_recommended",
        }:
            final_decision = legacy_decision
        elif _text(payload.get("reject_reason")):
            final_decision = "reject_recommended"

    if final_decision:
        payload["final_decision"] = final_decision

    if not payload.get("confidence"):
        payload["confidence"] = "medium"

    return payload


def _review_feedback_from_record(run) -> AgentRunFeedback | None:
    feedback = _text(getattr(run, "reviewer_feedback", None))
    updated_at = _iso_datetime(getattr(run, "reviewer_feedback_updated_at", None))
    if not feedback and not updated_at:
        return None
    return AgentRunFeedback(
        feedback=feedback or None,
        updated_at=updated_at,
    )
