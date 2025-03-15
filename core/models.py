from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
import uuid
import os


def get_file_path(instance, filename):
    """Generate a unique file path for uploaded email files."""
    ext = filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join("uploads", filename)


class UserProfile(models.Model):
    """Extension of Django User model to add role-based permissions."""

    # User roles
    NORMAL = "normal"
    POWER_USER = "power_user"
    ADMIN = "admin"

    ROLE_CHOICES = [
        (NORMAL, "Normal User"),
        (POWER_USER, "Power User"),
        (ADMIN, "Admin"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=NORMAL)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"

    @property
    def is_admin(self):
        return self.role == self.ADMIN

    @property
    def is_power_user(self):
        return self.role == self.POWER_USER or self.role == self.ADMIN

    @property
    def is_normal_user(self):
        return self.role == self.NORMAL


class Workspace(models.Model):
    """Model to represent a workspace for rule generation."""

    name = models.CharField(max_length=25)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="workspaces")
    created_at = models.DateTimeField(default=timezone.now)
    description = models.TextField(blank=True)

    # Fields for tracking which headers are selected for this workspace
    selected_headers = models.JSONField(default=list)

    class Meta:
        unique_together = ["name", "user"]  # Workspace names must be unique per user

    def __str__(self):
        return f"{self.name} - {self.user.username}"

    def clean(self):
        # Validate workspace name length
        if len(self.name) > 25:
            raise ValidationError(
                {"name": "Workspace name cannot exceed 25 characters."}
            )


class WorkspaceShare(models.Model):
    """Model to track workspace sharing permissions."""

    # Permission levels
    READ = "read"
    WRITE = "write"

    PERMISSION_CHOICES = [
        (READ, "Read Only"),
        (WRITE, "Read & Write"),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="shares"
    )
    shared_with = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="shared_workspaces"
    )
    permission = models.CharField(
        max_length=10, choices=PERMISSION_CHOICES, default=READ
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ["workspace", "shared_with"]

    def __str__(self):
        return f"{self.workspace.name} shared with {self.shared_with.username}"


class EmailFile(models.Model):
    """Model to store uploaded email files."""

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="email_files"
    )
    uploaded_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="uploaded_files"
    )
    file = models.FileField(upload_to=get_file_path)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(default=timezone.now)
    processed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.original_filename} - {self.workspace.name}"


class RuleGeneration(models.Model):
    """Model to store generated SpamAssassin rules."""

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="rule_generations"
    )
    prompt = models.TextField()
    prompt_modules = models.JSONField(default=list)
    base_prompt_id = models.IntegerField(null=True, blank=True)
    prompt_metadata = models.JSONField(default=dict, blank=True)
    rule = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_rules"
    )
    is_complete = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.workspace.name} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class PromptTemplate(models.Model):
    """Model to store prompt templates for rule generation."""

    # Visibility levels
    GLOBAL = "global"
    USER_WORKSPACES = "user_workspaces"
    WORKSPACE = "workspace"

    VISIBILITY_CHOICES = [
        (GLOBAL, "Available Globally"),
        (USER_WORKSPACES, "Available to All User Workspaces"),
        (WORKSPACE, "Available to Specific Workspace"),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    template = models.TextField()
    is_base = models.BooleanField(default=False)
    is_module = models.BooleanField(default=False)
    module_type = models.CharField(max_length=50, blank=True, null=True)
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default=GLOBAL
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_templates"
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="templates",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def clean(self):
        # Only base prompts initialized by the system can be global without a creator
        if self.visibility == self.GLOBAL and not self.created_by and not self.is_base:
            raise ValidationError(
                "Global templates must have a creator "
                + "unless they are system base prompts."
            )

        # Workspace-specific templates must have a workspace
        if self.visibility == self.WORKSPACE and not self.workspace:
            raise ValidationError(
                "Workspace-specific templates must be " + "associated with a workspace."
            )

        # Normal users can't create global templates
        if self.created_by and hasattr(self.created_by, "profile"):
            user_profile = self.created_by.profile
            if self.visibility == self.GLOBAL and not user_profile.is_power_user:
                raise ValidationError(
                    "Only power users and admins can create "
                    + "globally available templates."
                )
