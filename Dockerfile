# Use a lightweight official Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

# Set work directory
WORKDIR /app

# Copy requirements
COPY requirements.txt /app/

# Install pip and package dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . /app/

# Expose port (7860 is the Hugging Face Spaces standard)
EXPOSE 7860

# Run Flask using Gunicorn with 1 worker and 2 threads (limits memory usage under 512MB)
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--workers", "1", "--threads", "2", "app:app"]
