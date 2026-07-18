"""
Background scheduler for the live ingestion pipeline.

Runs ``run_ingestion`` on a fixed interval (APScheduler). Enabled via
INGESTION_ENABLED; interval via INGESTION_INTERVAL_HOURS.

Single-instance note: this in-process scheduler is right for one backend
instance. In a multi-instance deployment, run ingestion as ONE external
scheduled job (or leader-elect) so the crawl+LLM work isn't duplicated N times.
"""

import logging
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)

_scheduler = None  # type: ignore


def _job() -> None:
    try:
        from services.ingestion import run_ingestion
        run_ingestion(pages=settings.ingestion_pages, enrich=True)
    except Exception as exc:
        logger.exception("Scheduled ingestion failed: %s", exc)


def start_scheduler() -> None:
    """Start the interval scheduler if ingestion is enabled."""
    global _scheduler
    if not settings.ingestion_enabled:
        logger.info("Ingestion scheduler disabled (INGESTION_ENABLED=false)")
        return
    if _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning("apscheduler not installed; scheduler unavailable")
        return

    _scheduler = BackgroundScheduler(daemon=True)
    hours = max(0.1, float(settings.ingestion_interval_hours))
    _scheduler.add_job(_job, "interval", hours=hours, id="scheme_ingestion",
                       max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info("Ingestion scheduler started: every %.2f h", hours)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Ingestion scheduler stopped")


def scheduler_status() -> dict:
    running = _scheduler is not None and getattr(_scheduler, "running", False)
    return {
        "enabled": settings.ingestion_enabled,
        "running": running,
        "interval_hours": settings.ingestion_interval_hours,
        "pages_per_run": settings.ingestion_pages,
    }
