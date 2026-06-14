import os
from dotenv import load_dotenv
load_dotenv()

from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "agent_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],  
    result_serializer='json',
    timezone='Asia/Bangkok',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=180, # Hard limit: 3 minutes max for any AI generation task
    task_soft_time_limit=150 # Soft limit: 2.5 minutes before raising Exception
)

celery_app.autodiscover_tasks(["app.modules.agent_runner"])
