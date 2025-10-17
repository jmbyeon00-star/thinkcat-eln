# gpu_backend/worker.py
import time
from queue.job_queue import pop_job
from tasks.train_task import run_training

def worker_loop():
    print("[Worker] Ready to process jobs...")
    while True:
        job = pop_job()
        if job:
            run_training(job["project_id"], job["params"])
        else:
            time.sleep(2)  # 대기 후 다시 체크

if __name__ == "__main__":
    worker_loop()
