from django.db import models
from django.utils import timezone
import uuid
import os


def get_file_path(instance, filename):
    """Generate a unique file path for uploaded email files."""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)


class EmailFile(models.Model):
    """Model to store uploaded email files."""
    file = models.FileField(upload_to=get_file_path)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(default=timezone.now)
    processed = models.BooleanField(default=False)

    def __str__(self):
        return self.original_filename


class RuleGeneration(models.Model):
    """Model to store generated SpamAssassin rules."""
    email_files = models.ManyToManyField(EmailFile, related_name='rule_generations')
    selected_headers = models.JSONField()
    prompt = models.TextField()
    rule = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    is_complete = models.BooleanField(default=False)

    def __str__(self):
        return f"Rule Generation #{self.id} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
