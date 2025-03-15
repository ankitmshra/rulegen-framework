#!/usr/bin/env python
"""
Database setup script for SpamGenie.

This script initializes the database with default data:
1. Creates a superuser if one doesn't exist
2. Creates default prompt templates
3. Creates sample workspaces (optional)

Usage:
    python setup.py [--sample]

Options:
    --sample    Include sample workspaces and data
"""

import os
import argparse
import django


def create_superuser():
    """Create a superuser if one doesn't exist."""
    from django.contrib.auth.models import User
    from core.models import UserProfile

    if User.objects.filter(is_superuser=True).exists():
        print("Superuser already exists, skipping creation.")
        return User.objects.filter(is_superuser=True).first()

    username = input("Enter superuser username [admin]: ") or "admin"
    email = input("Enter superuser email [admin@example.com]: ") or "admin@example.com"
    password = input("Enter superuser password [adminpassword]: ") or "adminpassword"

    superuser = User.objects.create_superuser(
        username=username, email=email, password=password
    )

    # Make sure the superuser has an admin profile
    try:
        profile = UserProfile.objects.get(user=superuser)
        if profile.role != UserProfile.ADMIN:
            profile.role = UserProfile.ADMIN
            profile.save()
    except UserProfile.DoesNotExist:
        UserProfile.objects.create(user=superuser, role=UserProfile.ADMIN)

    print(f"Superuser '{username}' created successfully!")
    return superuser


def create_prompt_templates(admin_user):
    """Create default prompt templates."""
    from django.core.management import call_command
    from core.models import PromptTemplate

    print("Creating default prompt templates...")
    call_command("init_prompt_templates", user=admin_user.username)
    print(f"Created {PromptTemplate.objects.count()} prompt templates.")


def create_sample_workspaces(admin_user):
    """Create sample workspaces."""
    from django.contrib.auth.models import User
    from core.models import UserProfile, Workspace

    # Create a regular user for testing
    regular_user, created = User.objects.get_or_create(
        username="regular_user",
        defaults={
            "email": "regular@example.com",
            "is_staff": False,
            "is_superuser": False,
        },
    )

    if created:
        regular_user.set_password("password")
        regular_user.save()
        UserProfile.objects.create(user=regular_user, role=UserProfile.NORMAL)
        print("Created regular user 'regular_user' with password 'password'")

    # Create a power user for testing
    power_user, created = User.objects.get_or_create(
        username="power_user",
        defaults={
            "email": "power@example.com",
            "is_staff": True,
            "is_superuser": False,
        },
    )

    if created:
        power_user.set_password("password")
        power_user.save()
        UserProfile.objects.create(user=power_user, role=UserProfile.POWER_USER)
        print("Created power user 'power_user' with password 'password'")

    # Create sample workspaces
    workspace_names = ["Phishing Campaign", "Malware Analysis", "Spam Detection"]

    for name in workspace_names:
        for user in [admin_user, regular_user, power_user]:
            workspace, created = Workspace.objects.get_or_create(
                name=f"{name} - {user.username}",
                user=user,
                defaults={
                    "description": f"Sample workspace for {name}",
                    "selected_headers": ["From", "To", "Subject", "Date"],
                },
            )

            if created:
                print(
                    f"Created workspace '{workspace.name}' for user '{user.username}'"
                )

    print(f"Created {Workspace.objects.count()} sample workspaces.")


def main():
    # Set up Django environment
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "spamgenie.settings")
    django.setup()

    # After Django is set up, we can import transaction
    from django.db import transaction

    parser = argparse.ArgumentParser(description="Set up SpamGenie database.")
    parser.add_argument("--sample", action="store_true", help="Include sample data")
    args = parser.parse_args()

    print("Starting SpamGenie database setup...")

    with transaction.atomic():
        # Step 1: Create superuser
        admin_user = create_superuser()

        # Step 2: Create prompt templates
        create_prompt_templates(admin_user)

        # Step 3: Create sample workspaces if requested
        if args.sample:
            create_sample_workspaces(admin_user)

    print("Database setup complete!")


if __name__ == "__main__":
    main()
