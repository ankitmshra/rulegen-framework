"""
Serializers for the core API.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from .models import (
    UserProfile,
    Workspace,
    EmailFile,
    RuleGeneration,
    PromptTemplate,
    WorkspaceShare,
)


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for the UserProfile model."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["id", "username", "email", "role", "created_at"]
        read_only_fields = ["created_at"]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for the User model with profile information."""

    profile = UserProfileSerializer(read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES, write_only=True, required=False
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "profile",
            "role",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        role = validated_data.pop("role", UserProfile.NORMAL)
        password = validated_data.pop("password", None)

        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()

        # Find or create profile and explicitly set the role
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=user)

        # Important: Set the role explicitly and save
        profile.role = role
        profile.save(update_fields=["role"])

        return user

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)

        # Update user instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        # Update role if provided
        if role:
            try:
                profile = UserProfile.objects.get(user=instance)
            except UserProfile.DoesNotExist:
                profile = UserProfile.objects.create(user=instance)

            profile.role = role
            profile.save(update_fields=["role"])

        return instance


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for the Workspace model."""

    owner_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Workspace
        fields = [
            "id",
            "name",
            "user",
            "owner_username",
            "created_at",
            "description",
            "selected_headers",
        ]
        read_only_fields = ["created_at"]
        extra_kwargs = {"user": {"write_only": True}}


class EmailFileSerializer(serializers.ModelSerializer):
    """Serializer for the EmailFile model."""

    file_url = serializers.SerializerMethodField()
    uploader_username = serializers.CharField(
        source="uploaded_by.username", read_only=True
    )

    class Meta:
        model = EmailFile
        fields = [
            "id",
            "file",
            "file_url",
            "original_filename",
            "uploaded_at",
            "processed",
            "workspace",
            "uploaded_by",
            "uploader_username",
        ]
        read_only_fields = [
            "uploaded_at",
            "processed",
            "original_filename",
            "uploaded_by",
        ]
        extra_kwargs = {"file": {"required": True, "allow_empty_file": False}}

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url") and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class PromptTemplateSerializer(serializers.ModelSerializer):
    """Serializer for the PromptTemplate model."""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = PromptTemplate
        fields = [
            "id",
            "name",
            "description",
            "template",
            "is_base",
            "is_module",
            "module_type",
            "visibility",
            "created_by",
            "created_by_username",
            "workspace",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        # Set the user as the creator
        if "created_by" not in validated_data:
            validated_data["created_by"] = self.context["request"].user

        # Enforce visibility permissions based on user role
        user = self.context["request"].user
        visibility = validated_data.get("visibility", PromptTemplate.WORKSPACE)

        try:
            user_profile = user.profile
            # If normal user tries to create global template, override to user_workspaces
            if visibility == PromptTemplate.GLOBAL and not user_profile.is_power_user:
                validated_data["visibility"] = PromptTemplate.USER_WORKSPACES
        except ObjectDoesNotExist:
            # Default to workspace-level if profile doesn't exist
            if visibility == PromptTemplate.GLOBAL:
                validated_data["visibility"] = PromptTemplate.USER_WORKSPACES

        return super().create(validated_data)


class RuleGenerationSerializer(serializers.ModelSerializer):
    """Serializer for the RuleGeneration model."""

    creator_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    email_files = serializers.SerializerMethodField()

    class Meta:
        model = RuleGeneration
        fields = [
            "id",
            "workspace",
            "workspace_name",
            "prompt",
            "prompt_modules",
            "base_prompt_id",
            "prompt_metadata",
            "rule",
            "created_at",
            "is_complete",
            "created_by",
            "creator_username",
            "email_files",
        ]
        read_only_fields = [
            "created_at",
            "is_complete",
            "prompt_metadata",
            "created_by",
            "creator_username",
            "workspace_name",
            "email_files",
        ]

    def get_email_files(self, obj):
        """Get email files associated with this rule generation's workspace."""
        email_files = obj.workspace.email_files.all()
        serializer = EmailFileSerializer(email_files, many=True, context=self.context)
        return serializer.data

    def create(self, validated_data):
        # Set the current user as the creator
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class WorkspaceShareSerializer(serializers.ModelSerializer):
    """Serializer for the WorkspaceShare model."""

    owner_username = serializers.CharField(
        source="workspace.user.username", read_only=True
    )
    shared_with_username = serializers.CharField(
        source="shared_with.username", read_only=True
    )
    shared_with_email = serializers.CharField(
        source="shared_with.email", read_only=True
    )
    workspace_name = serializers.CharField(source="workspace.name", read_only=True)

    class Meta:
        model = WorkspaceShare
        fields = [
            "id",
            "workspace",
            "workspace_name",
            "owner_username",
            "shared_with",
            "shared_with_username",
            "shared_with_email",
            "permission",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "owner_username",
            "shared_with_username",
            "shared_with_email",
            "workspace_name",
        ]
