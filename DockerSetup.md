# Docker Setup Instructions for SpamGenie

## Overview

This document explains how to set up and run SpamGenie using Docker and Docker Compose. The application is containerized with the following components:

- **Backend**: Django application running on Gunicorn
- **Frontend**: React application built and served through Django's static files
- **Web Server**: Nginx for routing and serving static files

## Prerequisites

- Docker and Docker Compose installed on your system
- Git to clone the repository

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd spamgenie
```

### 2. Configuration

1. Copy the sample environment file:

```bash
cp .env.sample .env
```

2. Edit the `.env` file to set your environment variables:
   - Set a strong `SECRET_KEY`
   - Set your `GEMINI_API_KEY` if you plan to use rule generation
   - Modify `ALLOWED_HOSTS` if needed

### 3. Create Directory Structure

```bash
mkdir -p staticfiles
mkdir -p media/uploads
```

### 4. Build and Start the Containers

```bash
docker-compose up -d
```

This command will:
- Build all the Docker images
- Run database migrations
- Collect static files
- Create a default admin user (username: admin, password: adminpassword)
- Set up the initial prompt templates
- Start all services

### 5. Access the Application

Once the containers are up and running, you can access the application:

- Web Interface: http://localhost
- Admin Interface: http://localhost/admin

### 6. Important Commands

**Start all services:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f
```

**Stop all services:**
```bash
docker-compose down
```

**Rebuild and restart services:**
```bash
docker-compose up -d --build
```

## Customization

### Changing the Admin User

If you want to change the default admin credentials, you can:

1. Stop the containers: `docker-compose down`
2. Edit the `setup.py` file to modify the default credentials
3. Rebuild and restart: `docker-compose up -d --build`

### Persistent Data

The following data is persisted outside the containers:

- SQLite database: `./db.sqlite3`
- Media files: `./media/`
- Static files: `./staticfiles/`

## Troubleshooting

### Frontend Not Displaying Correctly

If the frontend is not displaying correctly, you may need to rebuild the React app:

```bash
docker-compose restart frontend-build
```

### Database Issues

If you encounter database issues, you can reset the database:

```bash
docker-compose down
rm db.sqlite3
docker-compose up -d
```

### Permission Issues

If you encounter permission issues with the mounted volumes:

```bash
chmod -R 777 media staticfiles
```

## Security Considerations

- Change the default admin password immediately after first login
- In production, set `DEBUG=False` in the `.env` file
- Use a strong `SECRET_KEY` in the `.env` file
- Consider using a proper database like PostgreSQL instead of SQLite for production
