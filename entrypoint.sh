#!/bin/bash

# Exit on error
set -e

# Run migrations
echo "Applying database migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create initial data if needed
echo "Setting up initial data..."
python setup.py --auto-setup

# Start gunicorn
echo "Starting Gunicorn server..."
exec gunicorn spamgenie.wsgi:application --bind 0.0.0.0:8000