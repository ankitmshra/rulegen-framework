from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    UserProfile,
    Workspace,
    EmailFile,
    RuleGeneration,
    PromptTemplate,
    WorkspaceShare,
)


class UserProfileInline(admin.StackedInline):
    """Inline admin for UserProfile to show on User admin page."""

    model = UserProfile
    can_delete = False
    verbose_name_plural = "profile"


class UserAdmin(BaseUserAdmin):
    """Extend the default UserAdmin to include UserProfile."""

    inlines = (UserProfileInline,)
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "get_role",
        "is_staff",
    )

    def get_role(self, obj):
        try:
            return obj.profile.get_role_display()
        except UserProfile.DoesNotExist:
            return "No Profile"

    get_role.short_description = "Role"


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """Admin configuration for the Workspace model."""

    list_display = ("name", "user", "created_at")
    list_filter = ("created_at", "user")
    search_fields = ("name", "user__username")
    readonly_fields = ("created_at",)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # Help text for name field
        if "name" in form.base_fields:
            form.base_fields["name"].help_text = "Maximum 25 characters"
        return form


@admin.register(EmailFile)
class EmailFileAdmin(admin.ModelAdmin):
    """Admin configuration for the EmailFile model."""

    list_display = (
        "original_filename",
        "workspace",
        "uploaded_by",
        "uploaded_at",
        "processed",
    )
    list_filter = ("processed", "uploaded_at", "uploaded_by", "workspace")
    search_fields = ("original_filename", "uploaded_by__username", "workspace__name")
    readonly_fields = ("uploaded_by", "uploaded_at")


@admin.register(RuleGeneration)
class RuleGenerationAdmin(admin.ModelAdmin):
    """Admin configuration for the RuleGeneration model."""

    list_display = ("id", "workspace", "created_by", "created_at", "is_complete")
    list_filter = ("is_complete", "created_at", "created_by", "workspace")
    search_fields = ("workspace__name", "created_by__username")
    readonly_fields = ("prompt", "rule", "created_by", "created_at")


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    """Admin configuration for the PromptTemplate model."""

    list_display = (
        "name",
        "description",
        "is_base",
        "is_module",
        "module_type",
        "visibility",
        "created_by",
        "created_at",
    )
    list_filter = ("is_base", "is_module", "visibility", "created_at", "created_by")
    search_fields = ("name", "description", "template")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("name", "description", "template")}),
        ("Type", {"fields": ("is_base", "is_module", "module_type")}),
        (
            "Visibility & Ownership",
            {
                "fields": (
                    "visibility",
                    "created_by",
                    "workspace",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_readonly_fields(self, request, obj=None):
        # Make created_by read-only if the template already exists
        if obj:
            return self.readonly_fields + ("created_by",)
        return self.readonly_fields

    def save_model(self, request, obj, form, change):
        # Set created_by to current user if not set and this is a new object
        if not change and not obj.created_by:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(WorkspaceShare)
class WorkspaceShareAdmin(admin.ModelAdmin):
    """Admin configuration for the WorkspaceShare model."""

    list_display = ("workspace", "shared_with", "permission", "created_at")
    list_filter = ("permission", "created_at", "workspace__user")
    search_fields = ("workspace__name", "shared_with__username")
    readonly_fields = ("created_at",)
