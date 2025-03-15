from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
import uuid
import os


def get_file_path(instance, filename):
    """Generate a unique file path for uploaded email files."""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)


class EmailFile(models.Model):
    """Model to store uploaded email files."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_files')
    file = models.FileField(upload_to=get_file_path)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(default=timezone.now)
    processed = models.BooleanField(default=False)

    def __str__(self):
        return self.original_filename


class RuleGeneration(models.Model):
    """Model to store generated SpamAssassin rules."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rule_generations')
    workspace_name = models.CharField(max_length=255, default="Unnamed Workspace")
    email_files = models.ManyToManyField(EmailFile, related_name='rule_generations')
    selected_headers = models.JSONField()
    prompt = models.TextField()
    prompt_modules = models.JSONField(default=list)
    base_prompt_id = models.IntegerField(null=True, blank=True)
    prompt_metadata = models.JSONField(default=dict, blank=True)
    rule = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    is_complete = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.workspace_name} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class PromptTemplate(models.Model):
    """Model to store prompt templates for rule generation."""
    # Keeping prompt templates global (shared across users)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    template = models.TextField()
    is_base = models.BooleanField(default=False)
    is_module = models.BooleanField(default=False)
    module_type = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
