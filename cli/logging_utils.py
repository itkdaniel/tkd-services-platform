"""
Color-coded leveled logging shared by the CLI (and any future Python tooling
in this project). Distinct from Python's `logging` module — the level set
here (VERBOSE, SUCCESS) doesn't map onto stdlib levels, and CLI output is
meant to be read by a human in a terminal, not shipped to a log aggregator.
"""
from __future__ import annotations

import sys
from enum import Enum

from rich.console import Console

_console = Console()
_err_console = Console(stderr=True)


class Level(str, Enum):
    DEBUG = "DEBUG"
    VERBOSE = "VERBOSE"
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


_STYLES: dict[Level, str] = {
    Level.DEBUG: "blue",
    Level.VERBOSE: "yellow",
    Level.INFO: "cyan",
    Level.SUCCESS: "green",
    Level.WARNING: "bold yellow",
    Level.ERROR: "bold red",
    Level.CRITICAL: "bold white on red",
}

# Only DEBUG/VERBOSE are hidden by default; everything else always prints.
# Set FEATURE_GRAPH_VERBOSE=1 to see DEBUG/VERBOSE output too.
_QUIET_LEVELS = {Level.DEBUG, Level.VERBOSE}


def _is_verbose_enabled() -> bool:
    import os

    return os.environ.get("FEATURE_GRAPH_VERBOSE", "").lower() in ("1", "true", "yes")


def log(level: Level, message: str) -> None:
    if level in _QUIET_LEVELS and not _is_verbose_enabled():
        return
    style = _STYLES[level]
    console = _err_console if level in (Level.ERROR, Level.CRITICAL, Level.WARNING) else _console
    console.print(f"[{style}]{level.value:<8}[/{style}] {message}")


def debug(message: str) -> None:
    log(Level.DEBUG, message)


def verbose(message: str) -> None:
    log(Level.VERBOSE, message)


def info(message: str) -> None:
    log(Level.INFO, message)


def success(message: str) -> None:
    log(Level.SUCCESS, message)


def warning(message: str) -> None:
    log(Level.WARNING, message)


def error(message: str) -> None:
    log(Level.ERROR, message)


def critical(message: str, exit_code: int | None = 1) -> None:
    log(Level.CRITICAL, message)
    if exit_code is not None:
        sys.exit(exit_code)
