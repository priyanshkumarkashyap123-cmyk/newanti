"""CLI to list supported worker job types."""

from __future__ import annotations

import json

from analysis.worker_dispatcher import list_supported_job_types


def main():
    jobs = list_supported_job_types()
    print(json.dumps(jobs, indent=2))


if __name__ == "__main__":
    main()
