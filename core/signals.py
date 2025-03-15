"""
Signal handlers for the core app.
"""

from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a UserProfile for every new User."""
    if created:
        # Check if the user is a superuser, assign admin role
        role = UserProfile.ADMIN if instance.is_superuser else UserProfile.NORMAL
        UserProfile.objects.create(user=instance, role=role)
