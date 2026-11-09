from __future__ import annotations

from core.store.qdrant_store import _user_filter


def test_two_workspaces_do_not_share_filter():
    a = _user_filter("user-a", "project-a")
    b = _user_filter("user-b", "project-b")
    a_vals = {(c.key, c.match.value) for c in a.must}
    b_vals = {(c.key, c.match.value) for c in b.must}
    assert ("user_id", "user-a") in a_vals
    assert ("workspace_id", "project-a") in a_vals
    assert ("user_id", "user-b") in b_vals
    assert ("workspace_id", "project-b") in b_vals
    assert a_vals != b_vals
