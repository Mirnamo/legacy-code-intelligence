"""Static Python import evidence; never imports or executes analyzed code."""
from __future__ import annotations

import ast
from collections import defaultdict, deque
from pathlib import Path, PurePosixPath


def analyze_impact(root: Path, sources: dict[str, str]) -> dict:
    modules: dict[str, list[str]] = defaultdict(list)
    for path in sorted(sources):
        if path.endswith(".py"):
            parts = list(PurePosixPath(path).with_suffix("").parts)
            if parts[-1] == "__init__":
                parts.pop()
            modules[".".join(parts)].append(path)
    edges = []
    unresolved = []
    invalid = []
    seen = set()
    for source, text in sorted(sources.items()):
        if not source.endswith(".py"):
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            invalid.append(source)
            continue
        package = list(PurePosixPath(source).parent.parts)
        for node in ast.walk(tree):
            candidates = []
            if isinstance(node, ast.Import):
                candidates = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    if node.level > len(package):
                        unresolved.append({"source": source, "line": node.lineno, "import": "." * node.level + (node.module or ""), "reason": "relative import outside known package"})
                        continue
                    base_parts = package[:len(package) - node.level + 1]
                    if node.module:
                        base_parts += node.module.split(".")
                    base = ".".join(base_parts)
                else:
                    base = node.module or ""
                if base:
                    candidates.append(base)
                for alias in node.names:
                    child = ".".join(filter(None, [base, alias.name]))
                    if alias.name != "*" and child in modules:
                        candidates.append(child)
                if not candidates:
                    unresolved.append({"source": source, "line": node.lineno, "import": "." * node.level, "reason": "no exact local module"})
            for name in candidates:
                matches = modules.get(name, [])
                if len(matches) != 1:
                    unresolved.append({"source": source, "line": node.lineno, "import": name, "reason": "ambiguous local module" if matches else "external or unresolved import"})
                    continue
                target = matches[0]
                key = (source, target, node.lineno)
                if key not in seen:
                    seen.add(key)
                    edges.append({"source": source, "target": target, "line": node.lineno, "import": name})
    reverse = defaultdict(list)
    for edge in edges:
        reverse[edge["target"]].append(edge)
    results = []
    for changed in sorted(path for path in sources if path.endswith(".py")):
        visited = {changed}
        queue = deque([(changed, [], [changed])])
        affected = []
        while queue:
            current, evidence, path = queue.popleft()
            for edge in sorted(reverse[current], key=lambda e: (e["source"], e["line"])):
                dependent = edge["source"]
                if dependent in visited:
                    continue
                visited.add(dependent)
                steps = evidence + [edge]
                route = path + [dependent]
                affected.append({"file": dependent, "distance": len(steps), "path": route, "evidence": steps})
                queue.append((dependent, steps, route))
        results.append({"changed_file": changed, "affected_count": len(affected), "affected": affected})
    return {
        "method": "python-static-import-reachability",
        "scope": "Python module names are relative to the uploaded analysis root; no execution or runtime import resolution.",
        "interpretation": "Affected files are review candidates, not proven failures. Zero matches does not establish safety.",
        "edges": edges,
        "unresolved_imports": unresolved,
        "syntax_error_files": invalid,
        "unsupported_files": sorted(p for p in sources if not p.endswith(".py")),
        "modules": sorted(results, key=lambda r: (-r["affected_count"], r["changed_file"])),
    }
