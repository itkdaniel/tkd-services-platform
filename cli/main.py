#!/usr/bin/env python3
"""
Feature Graph CLI — create and manage feature databases, data entries, and
knowledge-graph relations from the terminal, backed by the same API the web
app uses. Run `python cli/main.py --help` for the full command reference.
"""
import click

from commands.auth import auth_group
from commands.entries import entries_group
from commands.fields import fields_group
from commands.graph import graph_command
from commands.relations import relations_group
from commands.tables import tables_group


@click.group(
    name="feature-graph",
    help=(
        "Feature Graph CLI — create feature databases, add typed fields and data "
        "entries, draw justified relations between them, and query the resulting "
        "knowledge graph. Talks to the Feature Graph API over HTTP; run "
        "`feature-graph auth whoami` to check your current session."
    ),
)
def cli() -> None:
    pass


cli.add_command(auth_group)
cli.add_command(tables_group)
cli.add_command(fields_group)
cli.add_command(entries_group)
cli.add_command(relations_group)
cli.add_command(graph_command)


if __name__ == "__main__":
    cli()
