import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree

import logging_utils as log
from api_client import ApiClient, ApiError

_console = Console()


@click.command(name="graph", help="Query the knowledge graph: search entries and inspect their connections.")
@click.option("--search", default=None, help="Free-text search across entry labels.")
@click.option("--table", "table_id", type=int, default=None, help="Filter to a single table id.")
@click.option("--limit", type=int, default=500)
@click.option("--as-tree", is_flag=True, default=False, help="Render as a tree rooted at each unconnected/source node instead of a flat edge table.")
def graph_command(search: str | None, table_id: int | None, limit: int, as_tree: bool) -> None:
    client = ApiClient()
    params: dict[str, object] = {"limit": limit}
    if search:
        params["search"] = search
    if table_id is not None:
        params["tableId"] = table_id

    try:
        data = client.get("/graph", params=params)
    except ApiError as exc:
        log.error(f"Failed to query graph: {exc.message}")
        raise SystemExit(1)

    nodes = {node["id"]: node for node in data["nodes"]}
    edges = data["edges"]

    if not nodes:
        log.info("No matching nodes.")
        return

    log.info(f"{len(nodes)} node(s), {len(edges)} edge(s).")

    if as_tree:
        outgoing: dict[int, list[dict]] = {}
        has_incoming: set[int] = set()
        for edge in edges:
            outgoing.setdefault(edge["source"], []).append(edge)
            has_incoming.add(edge["target"])

        roots = [n for n in nodes if n not in has_incoming]
        for root_id in roots:
            root = nodes[root_id]
            tree = Tree(f"[bold]{root['label']}[/bold] [dim](#{root_id}, {root['category']})[/dim]")
            _add_children(tree, root_id, outgoing, nodes, visited={root_id})
            _console.print(tree)
        return

    table = Table(title="Graph nodes")
    table.add_column("ID", justify="right")
    table.add_column("Label")
    table.add_column("Table")
    table.add_column("Category")
    for node in nodes.values():
        table.add_row(str(node["id"]), node["label"], node["tableName"], node["category"])
    _console.print(table)

    if edges:
        edge_table = Table(title="Graph edges")
        edge_table.add_column("From")
        edge_table.add_column("Relation")
        edge_table.add_column("To")
        edge_table.add_column("Weight")
        for edge in edges:
            source = nodes.get(edge["source"], {}).get("label", edge["source"])
            target = nodes.get(edge["target"], {}).get("label", edge["target"])
            weight = f"{edge['weight']:.2f}" if edge.get("weight") is not None else "-"
            edge_table.add_row(str(source), edge["relationType"], str(target), weight)
        _console.print(edge_table)


def _add_children(tree: Tree, node_id: int, outgoing: dict[int, list[dict]], nodes: dict[int, dict], visited: set[int]) -> None:
    for edge in outgoing.get(node_id, []):
        target_id = edge["target"]
        target = nodes.get(target_id)
        if not target or target_id in visited:
            continue
        label = f"[cyan]{edge['relationType']}[/cyan] -> [bold]{target['label']}[/bold] [dim](#{target_id})[/dim]"
        branch = tree.add(label)
        _add_children(branch, target_id, outgoing, nodes, visited | {target_id})
