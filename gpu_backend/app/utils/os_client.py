from opensearchpy import OpenSearch
import os

OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST", "211.47.9.105")
OPENSEARCH_PORT = int(os.getenv("OPENSEARCH_PORT", "9281"))
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER")
OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS")
OPENSEARCH_TIMEOUT = int(os.getenv("OPENSEARCH_TIMEOUT", "10"))

def get_os() -> OpenSearch:
    return OpenSearch(
        hosts=[{"host": OPENSEARCH_HOST, "port": OPENSEARCH_PORT}],
        http_auth=(OPENSEARCH_USER, OPENSEARCH_PASS) if OPENSEARCH_USER and OPENSEARCH_PASS else None,
        use_ssl=False,
        verify_certs=False,
        timeout=OPENSEARCH_TIMEOUT,
    )
