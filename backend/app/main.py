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
    IdentityVerificationInput,
    IdentityVerificationResult,
    OpenRouterUsageCall,
    OpenRouterUsageSummary,
    SoftwareReviewAgentOutput,
    SoftwareReviewAgentResponse,
)
from app.services.apollo_identity import ApolloIdentityService
from app.services.contactout_identity import ContactOutIdentityService
from app.services.public_web_search import PublicWebSearchService
from app.services.hunter_identity import HunterIdentityService
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
    logger.info(
        "software_review_api_started review_id={review_id} test_mode={test_mode}",
        review_id=review_id,
        test_mode=test,
    )
    mongo_manager: MongoManager = request.app.state.mongo
    mysql_manager: MySQLManager = request.app.state.mysql
    postgres_manager: PostgresManager = request.app.state.postgres
    settings = get_settings()

    review_repository = SoftwareReviewRepository(mongo_manager)
    service_review_repository = ServiceReviewRepository(mysql_manager)
    user_repository = UserRepository(mysql_manager)
    context_builder = SoftwareReviewContextBuilder(
        review_repository,
        user_repository,
        service_review_repository,
    )
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
            logger.info(
                "software_review_run_persisted_started review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )

    try:
        logger.info(
            "software_review_context_build_started review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        context = context_builder.build(review_id, test_mode=test)
        logger.info(
            "software_review_context_build_completed review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
    except LookupError as exc:
        logger.warning(
            "software_review_context_build_failed_not_found review_id={review_id} run_id={run_id} error={error}",
            review_id=review_id,
            run_id=persisted_run_id,
            error=str(exc),
        )
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        logger.warning(
            "software_review_context_build_failed_validation review_id={review_id} run_id={run_id} error={error}",
            review_id=review_id,
            run_id=persisted_run_id,
            error=str(exc),
        )
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        logger.info(
            "software_review_agent_execution_started review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        agent_run_result = agent_service.run(context)
        logger.info(
            "software_review_agent_execution_completed review_id={review_id} run_id={run_id} final_decision={final_decision}",
            review_id=review_id,
            run_id=persisted_run_id,
            final_decision=agent_run_result.output.final_decision,
        )
    except Exception as exc:  # pragma: no cover - network/model failures
        _mark_agent_run_failed(request, persisted_run_id, error_stage="agent_call", error_message=str(exc))
        logger.exception("Software review agent call failed for review_id={review_id}", review_id=review_id)
        raise HTTPException(status_code=502, detail="Software review agent call failed") from exc
    output = agent_run_result.output

    completed_run = None
    if persisted_run_id is not None:
        with postgres_manager.session() as session:
            logger.info(
                "software_review_run_persist_completed_started review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )
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
            logger.info(
                "software_review_run_persist_completed review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )

    if completed_run is not None:
        logger.info(
            "software_review_api_returning_persisted_response review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        return _agent_run_response_from_record(completed_run)

    logger.info(
        "software_review_api_returning_inline_response review_id={review_id} run_id={run_id}",
        review_id=review_id,
        run_id=persisted_run_id,
    )
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
    logger.info(
        "service_review_api_started review_id={review_id} test_mode={test_mode}",
        review_id=review_id,
        test_mode=test,
    )
    mongo_manager: MongoManager = request.app.state.mongo
    mysql_manager: MySQLManager = request.app.state.mysql
    postgres_manager: PostgresManager = request.app.state.postgres
    settings = get_settings()

    software_review_repository = SoftwareReviewRepository(mongo_manager)
    review_repository = ServiceReviewRepository(mysql_manager)
    user_repository = UserRepository(mysql_manager)
    context_builder = ServiceReviewContextBuilder(
        review_repository,
        user_repository,
        software_review_repository,
    )
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
            logger.info(
                "service_review_run_persisted_started review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )

    try:
        logger.info(
            "service_review_context_build_started review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        context = context_builder.build(review_id, test_mode=test)
        logger.info(
            "service_review_context_build_completed review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
    except LookupError as exc:
        logger.warning(
            "service_review_context_build_failed_not_found review_id={review_id} run_id={run_id} error={error}",
            review_id=review_id,
            run_id=persisted_run_id,
            error=str(exc),
        )
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        logger.warning(
            "service_review_context_build_failed_validation review_id={review_id} run_id={run_id} error={error}",
            review_id=review_id,
            run_id=persisted_run_id,
            error=str(exc),
        )
        _mark_agent_run_failed(request, persisted_run_id, error_stage="context_build", error_message=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        logger.info(
            "service_review_agent_execution_started review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        agent_run_result = agent_service.run(context)
        logger.info(
            "service_review_agent_execution_completed review_id={review_id} run_id={run_id} final_decision={final_decision}",
            review_id=review_id,
            run_id=persisted_run_id,
            final_decision=agent_run_result.output.final_decision,
        )
    except Exception as exc:  # pragma: no cover - network/model failures
        _mark_agent_run_failed(request, persisted_run_id, error_stage="agent_call", error_message=str(exc))
        logger.exception("Service review agent call failed for review_id={review_id}", review_id=review_id)
        raise HTTPException(status_code=502, detail="Service review agent call failed") from exc
    output = agent_run_result.output

    completed_run = None
    if persisted_run_id is not None:
        with postgres_manager.session() as session:
            logger.info(
                "service_review_run_persist_completed_started review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )
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
            logger.info(
                "service_review_run_persist_completed review_id={review_id} run_id={run_id}",
                review_id=review_id,
                run_id=persisted_run_id,
            )

    if completed_run is not None:
        logger.info(
            "service_review_api_returning_persisted_response review_id={review_id} run_id={run_id}",
            review_id=review_id,
            run_id=persisted_run_id,
        )
        return _agent_run_response_from_record(completed_run)

    logger.info(
        "service_review_api_returning_inline_response review_id={review_id} run_id={run_id}",
        review_id=review_id,
        run_id=persisted_run_id,
    )
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
    "/api/software-reviews/{review_id}/identity-verifications/hunter",
    response_model=IdentityVerificationResult,
)
def verify_software_review_identity_with_hunter(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(request=request, review_type="software", review_id=review_id, provider="hunter")


@app.post(
    "/api/software-reviews/{review_id}/identity-verifications/contactout",
    response_model=IdentityVerificationResult,
)
def verify_software_review_identity_with_contactout(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(
        request=request,
        review_type="software",
        review_id=review_id,
        provider="contactout",
    )


@app.post(
    "/api/software-reviews/{review_id}/identity-verifications/apollo",
    response_model=IdentityVerificationResult,
)
def verify_software_review_identity_with_apollo(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(
        request=request,
        review_type="software",
        review_id=review_id,
        provider="apollo",
    )


@app.post(
    "/api/service-reviews/{review_id}/identity-verifications/hunter",
    response_model=IdentityVerificationResult,
)
def verify_service_review_identity_with_hunter(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(request=request, review_type="service", review_id=review_id, provider="hunter")


@app.post(
    "/api/service-reviews/{review_id}/identity-verifications/contactout",
    response_model=IdentityVerificationResult,
)
def verify_service_review_identity_with_contactout(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(
        request=request,
        review_type="service",
        review_id=review_id,
        provider="contactout",
    )


@app.post(
    "/api/service-reviews/{review_id}/identity-verifications/apollo",
    response_model=IdentityVerificationResult,
)
def verify_service_review_identity_with_apollo(
    review_id: str,
    request: Request,
) -> IdentityVerificationResult:
    return _run_identity_verification(
        request=request,
        review_type="service",
        review_id=review_id,
        provider="apollo",
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


def _run_identity_verification(
    *,
    request: Request,
    review_type: str,
    review_id: str,
    provider: str,
) -> IdentityVerificationResult:
    logger.info(
        "identity_verification_started review_type={review_type} review_id={review_id} provider={provider}",
        review_type=review_type,
        review_id=review_id,
        provider=provider,
    )
    mysql_manager: MySQLManager = request.app.state.mysql
    mongo_manager: MongoManager = request.app.state.mongo

    user_repository = UserRepository(mysql_manager)
    verification_input = _build_identity_verification_input(
        review_type=review_type,
        review_id=review_id,
        review_repository=SoftwareReviewRepository(mongo_manager),
        service_review_repository=ServiceReviewRepository(mysql_manager),
        user_repository=user_repository,
    )

    if verification_input.login_method != "google":
        summary = "External identity verification is only enabled for Google sign-up reviewers in the current workflow."
        logger.info(
            "identity_verification_skipped_non_google review_type={review_type} review_id={review_id} provider={provider} login_method={login_method}",
            review_type=review_type,
            review_id=review_id,
            provider=provider,
            login_method=verification_input.login_method or "unknown",
        )
        return IdentityVerificationResult(
            provider=provider,  # type: ignore[arg-type]
            review_type=review_type,  # type: ignore[arg-type]
            review_id=review_id,
            status="skipped_non_google_signup",
            summary=summary,
            inputs=verification_input,
            result={"reason": summary},
        )

    if provider == "hunter":
        service = HunterIdentityService(get_settings().hunter)
        result = service.lookup(
            full_name=verification_input.name or "",
            signup_email=verification_input.signup_email or "",
            linkedin_url=verification_input.linkedin_url or "",
            company_name=verification_input.company_name or "",
            company_website=verification_input.company_website or "",
        )
        summary = _summarize_hunter_verification(result)
        payload = {
            "lookup_ran": result.lookup_ran,
            "candidate_email": result.candidate_email,
            "candidate_domain": result.candidate_domain,
            "verification_status": result.verification_status,
            "score": result.score,
            "claimed_company_domain_matches": result.claimed_company_domain_matches,
            "lookup_method": result.lookup_method,
            "reason": result.reason,
        }
        status = result.status
    elif provider == "contactout":
        service = ContactOutIdentityService(get_settings().contactout)
        result = service.lookup(
            full_name=verification_input.name or "",
            signup_email=verification_input.signup_email or "",
            linkedin_url=verification_input.linkedin_url or "",
            company_name=verification_input.company_name or "",
            company_website=verification_input.company_website or "",
        )
        summary = _summarize_contactout_verification(result)
        payload = {
            "primary_email": result.primary_email,
            "work_emails": result.work_emails or [],
            "personal_emails": result.personal_emails or [],
            "linkedin_url": result.linkedin_url,
            "full_name": result.full_name,
            "title": result.title,
            "company": result.company,
            "reason": result.reason,
        }
        status = result.status
    else:
        service = ApolloIdentityService(get_settings().apollo)
        result = service.lookup(
            full_name=verification_input.name or "",
            signup_email=verification_input.signup_email or "",
            linkedin_url=verification_input.linkedin_url or "",
            company_name=verification_input.company_name or "",
            company_website=verification_input.company_website or "",
        )
        summary = _summarize_apollo_verification(result)
        payload = {
            "primary_email": result.primary_email,
            "work_email": result.work_email,
            "personal_emails": result.personal_emails or [],
            "linkedin_url": result.linkedin_url,
            "full_name": result.full_name,
            "title": result.title,
            "company": result.company,
            "reason": result.reason,
        }
        status = result.status

    logger.info(
        "identity_verification_completed review_type={review_type} review_id={review_id} provider={provider} status={status}",
        review_type=review_type,
        review_id=review_id,
        provider=provider,
        status=status,
    )
    return IdentityVerificationResult(
        provider=provider,
        review_type=review_type,
        review_id=review_id,
        status=status,
        summary=summary,
        inputs=verification_input,
        result=payload,
    )


def _build_identity_verification_input(
    *,
    review_type: str,
    review_id: str,
    review_repository: SoftwareReviewRepository,
    service_review_repository: ServiceReviewRepository,
    user_repository: UserRepository,
) -> IdentityVerificationInput:
    if review_type == "software":
        review = review_repository.get_review_by_id(review_id)
        if not review:
            raise HTTPException(status_code=404, detail="Software review not found")
        user_id = _parse_int(review.get("user_id"))
        user = user_repository.get_user_by_id(user_id) if user_id is not None else None
        return IdentityVerificationInput(
            name=_first_non_empty(review.get("client_name"), user.get("name") if user else None),
            signup_email=_first_non_empty(review.get("client_email"), user.get("email") if user else None),
            company_name=_first_non_empty(review.get("client_company_name"), user.get("company_name") if user else None),
            linkedin_url=_first_non_empty(review.get("client_profile_link"), user.get("public_url") if user else None),
            company_website=_first_non_empty(
                review.get("client_company_website"),
                user.get("company_website") if user else None,
            ),
            login_method=_infer_login_method(user),
        )

    review = service_review_repository.get_review_by_id(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Service review not found")
    user_id = _parse_int(review.get("user_id"))
    user = user_repository.get_user_by_id(user_id) if user_id is not None else None
    return IdentityVerificationInput(
        name=_first_non_empty(review.get("client_name"), user.get("name") if user else None),
        signup_email=_first_non_empty(review.get("client_email"), user.get("email") if user else None),
        company_name=_first_non_empty(review.get("client_company_name"), user.get("company_name") if user else None),
        linkedin_url=_first_non_empty(review.get("client_profile_link"), user.get("public_url") if user else None),
        company_website=_first_non_empty(
            review.get("client_company_website"),
            user.get("company_website") if user else None,
        ),
        login_method=_infer_login_method(user),
    )


def _summarize_hunter_verification(result) -> str:
    if result.status == "email_match":
        return "Hunter found a candidate email that matches the GoodFirms signup email."
    if result.status == "email_mismatch":
        return "Hunter found a candidate email that does not match the GoodFirms signup email. This is a major red flag."
    if result.status == "no_email_found":
        return result.reason or "Hunter did not find a corroborating email for this identity."
    if result.status == "not_configured":
        return "Hunter is not configured in the backend."
    if result.status == "not_enough_inputs":
        return result.reason or "Hunter could not run because the required identity inputs were missing."
    return (
        f"{result.reason or result.status}. "
        "Treat this as an external verification limitation rather than direct evidence against the reviewer."
    )


def _summarize_contactout_verification(result) -> str:
    if result.status == "email_match":
        return "ContactOut returned work/personal email data that includes the GoodFirms signup email."
    if result.status == "email_mismatch":
        return "ContactOut returned work/personal email data, but none of those emails match the GoodFirms signup email. This is a major red flag."
    if result.status == "sample_response_detected":
        return result.reason or "ContactOut returned a sample/demo payload rather than real enrichment data."
    if result.status == "no_email_found":
        return result.reason or "ContactOut did not return a work or personal email for this profile."
    if result.status == "not_configured":
        return "ContactOut is not configured in the backend."
    if result.status == "not_enough_inputs":
        return result.reason or "ContactOut could not run because the required inputs were missing."
    return (
        f"{result.reason or result.status}. "
        "Treat this as an external verification limitation rather than direct evidence against the reviewer."
    )


def _summarize_apollo_verification(result) -> str:
    if result.status == "email_match":
        return "Apollo returned a work/personal email set that includes the GoodFirms signup email."
    if result.status == "email_mismatch":
        return "Apollo returned work/personal email data, but none of those emails match the GoodFirms signup email. This is a major red flag."
    if result.status == "no_email_found":
        return result.reason or "Apollo did not return a work or personal email for this person."
    if result.status == "not_configured":
        return "Apollo is not configured in the backend."
    if result.status == "not_enough_inputs":
        return result.reason or "Apollo could not run because the required inputs were missing."
    return (
        f"{result.reason or result.status}. "
        "Treat this as an external verification limitation rather than direct evidence against the reviewer."
    )


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


def _first_non_empty(*values: object) -> str | None:
    for value in values:
        text = _text(value)
        if text:
            return text
    return None


def _parse_int(value: object) -> int | None:
    text = _text(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _infer_login_method(user: dict | None) -> str | None:
    if not user:
        return None
    if _text(user.get("google_id")):
        return "google"
    if _text(user.get("social_id")):
        return "linkedin"
    if _text(user.get("email")):
        return "email_legacy"
    return None


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
