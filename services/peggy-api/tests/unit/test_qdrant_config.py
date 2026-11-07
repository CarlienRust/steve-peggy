from config import qdrant_https_requires_key


def test_local_http_qdrant_ok_without_key():
    assert qdrant_https_requires_key("http://localhost:6333", "") is False


def test_cloud_https_requires_key():
    assert qdrant_https_requires_key("https://abc.eu-west-1-0.aws.cloud.qdrant.io", "") is True
    assert qdrant_https_requires_key("https://abc.eu-west-1-0.aws.cloud.qdrant.io", "secret") is False
