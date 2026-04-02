"""Simple smoke script to start the worker pool and report status.

Usage:
    python -m analysis.worker_pool_smoke
"""

from __future__ import annotations

import asyncio
import json

from analysis.worker_pool import get_worker_pool, shutdown_worker_pool


async def run_smoke():
    pool = await get_worker_pool()
    status = pool.get_queue_status()
    print(json.dumps(status, indent=2))
    await shutdown_worker_pool()


if __name__ == "__main__":
    asyncio.run(run_smoke())
