FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EMBEDDING_BACKEND=hash \
    PUBLIC_HEALTH_DETAIL=false
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-render.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements-render.txt

COPY . .
RUN mkdir -p /app/data

EXPOSE 8000
# Render sets PORT and RENDER=true; bind quickly, warm up in lifespan background task.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --timeout-keep-alive 5"]
