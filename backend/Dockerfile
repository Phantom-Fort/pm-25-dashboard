# Use Python slim image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and model files
COPY app.py .
COPY rf_model.pkl .
COPY pm25_scaler_params.json .
COPY feature_names.json .

# Expose port 5000
EXPOSE 5000

# Run the Flask app
CMD ["python", "app.py"]