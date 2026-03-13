"""
In-process conflict graph for scheme mutual-exclusion rules.

Loaded once at startup from scheme metadata.  Multi-hop traversal
runs in pure Python — Redis cannot do graph traversal.

Usage:
    from services.conflict_graph import conflict_map, get_all_conflicts
    conflicts = get_all_conflicts("pm_kisan")  # {"pm_samman_nidhi", ...}
"""

import json
import logging
from typing import Dict, List, Set, Optional

logger = logging.getLogger(__name__)

# Global adjacency list: {scheme_id: [conflicting_scheme_ids]}
conflict_map: Dict[str, List[str]] = {}


def build_conflict_map(schemes: list) -> None:
    """
    Rebuild the conflict graph from the scheme list.

    Each scheme dict may contain a "conflicts_with" key
    holding a list of scheme_ids it is mutually exclusive with.

    Call this after every scraper refresh (schemes:all update).
    """
    global conflict_map
    new_map: Dict[str, List[str]] = {}

    for scheme in schemes:
        sid = scheme.get("scheme_id", "")
        conflicts = scheme.get("conflicts_with", [])
        if sid and conflicts:
            new_map.setdefault(sid, []).extend(conflicts)
            # Ensure bidirectional edges
            for cid in conflicts:
                new_map.setdefault(cid, [])
                if sid not in new_map[cid]:
                    new_map[cid].append(sid)

    conflict_map.clear()
    conflict_map.update(new_map)
    logger.info("Conflict graph rebuilt: %d schemes with conflict rules", len(conflict_map))


def get_all_conflicts(scheme_id: str, visited: Optional[Set[str]] = None) -> Set[str]:
    """
    Multi-hop conflict resolution in pure Python.

    Returns the set of ALL scheme_ids that conflict with `scheme_id`,
    following transitive edges (A→B→C means A conflicts with C).
    """
    if visited is None:
        visited = set()
    visited.add(scheme_id)

    for cid in conflict_map.get(scheme_id, []):
        if cid not in visited:
            get_all_conflicts(cid, visited)

    return visited - {scheme_id}


def has_conflict(scheme_a: str, scheme_b: str) -> bool:
    """Check if two schemes conflict (directly or transitively)."""
    return scheme_b in get_all_conflicts(scheme_a)
