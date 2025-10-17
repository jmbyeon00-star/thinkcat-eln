# gpu_backend/queue/job_queue.py
import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, db=0)

def push_job(job: dict):
    """학습 job을 큐에 넣는다"""
    redis_client.rpush("train_jobs", json.dumps(job))

def pop_job():
    """큐에서 job 꺼낸다"""
    job_data = redis_client.lpop("train_jobs")
    if job_data:
        return json.loads(job_data)
    return None
