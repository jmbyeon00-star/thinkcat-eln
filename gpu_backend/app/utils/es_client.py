# from elasticsearch import Elasticsearch
# import os

# ES_HOST = os.getenv("ES_HOST", "http://192.168.1.116:9200")
# ES_USER = os.getenv("ES_USER")
# ES_PASS = os.getenv("ES_PASS")
# ES_TIMEOUT = int(os.getenv("ES_TIMEOUT", "10"))

# def get_es() -> Elasticsearch:
#     if ES_USER and ES_PASS:
#         return Elasticsearch([ES_HOST], http_auth=(ES_USER, ES_PASS), timeout=ES_TIMEOUT, verify_certs=False)
#     return Elasticsearch([ES_HOST], timeout=ES_TIMEOUT, verify_certs=False)
