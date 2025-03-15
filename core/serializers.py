from rest_framework import serializers
from django.contrib.auth.models import User
from .models import EmailFile, RuleGeneration, PromptTemplate, UserProfile


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


class EmailFileSerializer(serializers.ModelSerializer):
    """Serializer for the EmailFile model."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EmailFile
        fields = [
            "id",
            "file",
            "file_url",
            "original_filename",
            "uploaded_at",
            "processed",
        ]
        read_only_fields = ["uploaded_at", "processed", "original_filename", "user"]
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
        visibility = validated_data.get("visibility", PromptTemplate.CURRENT_WORKSPACE)

        try:
            user_profile = user.profile
            # If normal user tries to create global template, override to user_workspaces
            if visibility == PromptTemplate.GLOBAL and not user_profile.is_power_user:
                validated_data["visibility"] = PromptTemplate.USER_WORKSPACES
        except:
            # Default to workspace-level if profile doesn't exist
            if visibility == PromptTemplate.GLOBAL:
                validated_data["visibility"] = PromptTemplate.USER_WORKSPACES

        return super().create(validated_data)


class RuleGenerationSerializer(serializers.ModelSerializer):
    """Serializer for the RuleGeneration model."""

    email_files = EmailFileSerializer(many=True, read_only=True)
    email_file_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )
    custom_prompt = serializers.CharField(required=False, write_only=True)
    prompt_modules = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    base_prompt_id = serializers.IntegerField(required=False, allow_null=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = RuleGeneration
        fields = [
            "id",
            "workspace_name",
            "email_files",
            "email_file_ids",
            "selected_headers",
            "prompt",
            "rule",
            "created_at",
            "is_complete",
            "username",
            "custom_prompt",
            "prompt_modules",
            "base_prompt_id",
            "prompt_metadata",
        ]
        read_only_fields = [
            "rule",
            "created_at",
            "is_complete",
            "prompt_metadata",
            "user",
        ]
        extra_kwargs = {
            "prompt": {"required": False},
            "workspace_name": {
                "required": False,
                "max_length": 25,
            },  # Enforce 25 char limit
        }

    def validate_workspace_name(self, value):
        """Validate that workspace_name is not longer than 25 characters."""
        if len(value) > 25:
            raise serializers.ValidationError(
                "Workspace name cannot exceed 25 characters."
            )
        return value

    def create(self, validated_data):
        email_file_ids = validated_data.pop("email_file_ids")
        custom_prompt = validated_data.pop("custom_prompt", None)

        # Initialize with empty prompt (will be generated by the service if needed)
        if "prompt" not in validated_data:
            validated_data["prompt"] = ""

        # If custom prompt was provided, use it directly
        if custom_prompt:
            validated_data["prompt"] = custom_prompt

        # Set default workspace name if not provided
        if (
            "workspace_name" not in validated_data
            or not validated_data["workspace_name"]
        ):
            validated_data["workspace_name"] = "Unnamed Workspace"

        rule_generation = RuleGeneration.objects.create(**validated_data)

        # Add the email files to the rule generation, ensuring they belong to the user
        user = validated_data.get("user")
        email_files = EmailFile.objects.filter(id__in=email_file_ids, user=user)
        rule_generation.email_files.set(email_files)

        return rule_generation
