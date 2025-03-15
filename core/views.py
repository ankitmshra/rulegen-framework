from django.contrib.auth.models import User
from django.db.models import Count, Max, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import EmailFile, RuleGeneration, PromptTemplate, UserProfile
from .serializers import (
    EmailFileSerializer,
    RuleGenerationSerializer,
    PromptTemplateSerializer,
    UserSerializer,
    UserProfileSerializer,
)
from .services import SpamGenieService
from .prompt_manager import PromptManager
from .permissions import (
    AdminPermission,
    PowerUserPermission,
    NormalUserPermission,
    PromptTemplatePermission,
    WorkspacePermission,
)
import threading
import os
from django.conf import settings


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for managing users - admin only."""

    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        """Optionally filter by role."""
        queryset = super().get_queryset()
        role = self.request.query_params.get("role", None)

        if role:
            queryset = queryset.filter(profile__role=role)

        return queryset

    @action(detail=False, methods=["get"], permission_classes=[NormalUserPermission])
    def me(self, request):
        """Get current user's profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class EmailFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing email files."""

    permission_classes = [NormalUserPermission, WorkspacePermission]
    serializer_class = EmailFileSerializer

    def get_queryset(self):
        """
        Return only the email files owned by the authenticated user,
        filtered by workspace if specified.
        """
        # Admin can see all files if 'all' parameter is provided
        if self.request.query_params.get("all", "").lower() == "true":
            try:
                user_profile = self.request.user.profile
                if user_profile.is_admin:
                    return EmailFile.objects.all().order_by("-uploaded_at")
            except:
                pass

        queryset = EmailFile.objects.filter(user=self.request.user)

        # Filter by workspace if provided
        workspace_id = self.request.query_params.get("workspace", None)
        if workspace_id:
            try:
                workspace_id = int(workspace_id)
                # Get email files associated with this rule generation
                rule_gen = RuleGeneration.objects.get(
                    id=workspace_id, user=self.request.user
                )
                return rule_gen.email_files.all()
            except (ValueError, RuleGeneration.DoesNotExist):
                # If invalid workspace ID or workspace doesn't exist, return empty queryset
                return EmailFile.objects.none()

        return queryset.order_by("-uploaded_at")

    def perform_create(self, serializer):
        """Set the original filename and user when creating an email file."""
        # Create the upload directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
        os.makedirs(upload_dir, exist_ok=True)

        file_obj = self.request.FILES.get("file")
        workspace_id = self.request.data.get("workspace_id")

        if file_obj:
            if not file_obj.name.lower().endswith(".eml"):
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"file": "Only .eml files are supported."})

            email_file = serializer.save(
                original_filename=file_obj.name, user=self.request.user
            )

            # Associate with workspace if provided
            if workspace_id:
                try:
                    rule_gen = RuleGeneration.objects.get(
                        id=workspace_id, user=self.request.user
                    )
                    rule_gen.email_files.add(email_file)
                except (ValueError, RuleGeneration.DoesNotExist):
                    # Ignore if workspace doesn't exist
                    pass
        else:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"file": "No file was submitted."})

    @action(detail=False, methods=["get"])
    def available_headers(self, request):
        """Get all available headers from the processed emails."""
        email_files = self.get_queryset()
        if not email_files:
            return Response({}, status=status.HTTP_200_OK)

        try:
            headers = SpamGenieService.get_available_headers(email_files)
            return Response(headers, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PromptTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing prompt templates."""

    serializer_class = PromptTemplateSerializer
    permission_classes = [NormalUserPermission, PromptTemplatePermission]

    def get_queryset(self):
        """
        Return templates based on user's role and template visibility.

        - Admins and power users see all templates
        - Normal users see:
          - All global templates
          - Templates they created
          - Templates for their workspaces
        """
        user = self.request.user

        # Check user role
        try:
            user_profile = user.profile
            is_power_user = user_profile.is_power_user
        except:
            is_power_user = False

        # If power user or admin, show all templates
        if is_power_user:
            queryset = PromptTemplate.objects.all()
        else:
            # For normal users, show global templates + own templates + workspace templates
            queryset = PromptTemplate.objects.filter(
                Q(visibility=PromptTemplate.GLOBAL)
                | Q(created_by=user)
                | Q(visibility=PromptTemplate.USER_WORKSPACES, created_by=user)
                | Q(workspace__user=user, visibility=PromptTemplate.CURRENT_WORKSPACE)
            ).distinct()

        # Filter by module type if specified
        module_type = self.request.query_params.get("module_type", None)
        if module_type:
            queryset = queryset.filter(module_type=module_type)

        # Filter by is_base
        is_base = self.request.query_params.get("is_base", None)
        if is_base is not None:
            is_base_bool = is_base.lower() == "true"
            queryset = queryset.filter(is_base=is_base_bool)

        # Filter by is_module
        is_module = self.request.query_params.get("is_module", None)
        if is_module is not None:
            is_module_bool = is_module.lower() == "true"
            queryset = queryset.filter(is_module=is_module_bool)

        return queryset.order_by("name")

    def perform_create(self, serializer):
        """Set the creator when creating a prompt template."""
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def modules(self, request):
        """Get all available prompt modules."""
        modules = self.get_queryset().filter(is_module=True)
        serializer = self.get_serializer(modules, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def base(self, request):
        """Get the base prompt template."""
        try:
            # Using PromptManager to get base prompts
            base_prompts = PromptManager.get_base_prompts()
            if not base_prompts:
                return Response(
                    {"error": "No base prompt template found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Return the first one for backward compatibility
            serializer = self.get_serializer(base_prompts.first())
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Error retrieving base prompt: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RuleGenerationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing rule generations."""

    permission_classes = [NormalUserPermission, WorkspacePermission]
    serializer_class = RuleGenerationSerializer

    def get_queryset(self):
        """Return the rule generations based on user role."""
        user = self.request.user

        # Admin can see all rule generations if 'all' parameter is provided
        if self.request.query_params.get("all", "").lower() == "true":
            try:
                user_profile = user.profile
                if user_profile.is_admin:
                    return RuleGeneration.objects.all().order_by("-created_at")
            except:
                pass

        # Other users see only their own rule generations
        return RuleGeneration.objects.filter(user=user).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        """Create a new rule generation request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule_generation = serializer.save(user=request.user)

        # Start a background thread to process the rule generation
        threading.Thread(
            target=SpamGenieService.process_rule_generation, args=(rule_generation.id,)
        ).start()

        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        """Get the status of a rule generation request."""
        rule_generation = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(
            {
                "id": rule_generation.id,
                "workspace_name": rule_generation.workspace_name,
                "is_complete": rule_generation.is_complete,
                "rule": rule_generation.rule if rule_generation.is_complete else None,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def workspaces(self, request):
        """Get all unique workspaces with their latest rule generation for the current user."""
        # For admin users, optionally show all workspaces
        if request.query_params.get("all", "").lower() == "true":
            try:
                user_profile = request.user.profile
                if user_profile.is_admin:
                    workspaces = (
                        RuleGeneration.objects.values(
                            "workspace_name", "user__username"
                        )
                        .annotate(
                            count=Count("id"),
                            latest_id=Max("id"),
                            latest_date=Max("created_at"),
                        )
                        .order_by("-latest_date")
                    )
                    return Response(workspaces, status=status.HTTP_200_OK)
            except:
                pass

        # Regular case - user's own workspaces
        workspaces = (
            self.get_queryset()
            .values("workspace_name")
            .annotate(
                count=Count("id"), latest_id=Max("id"), latest_date=Max("created_at")
            )
            .order_by("-latest_date")
        )

        return Response(workspaces, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def base_prompts(self, request):
        """Get all available base prompts."""
        try:
            # Using PromptManager to get base prompts
            base_prompts = PromptManager.get_base_prompts()
            serializer = PromptTemplateSerializer(base_prompts, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["post"])
    def generate_default_prompt(self, request):
        """Generate a default prompt without saving."""
        try:
            # Create a temporary RuleGeneration object
            temp_rule_generation = RuleGeneration(
                user=request.user,
                selected_headers=request.data.get("selected_headers", []),
                prompt_modules=request.data.get("prompt_modules", []),
                workspace_name=request.data.get(
                    "workspace_name", "Temporary Workspace"
                ),
                base_prompt_id=request.data.get("base_prompt_id"),
            )

            # Add email files to the temporary object
            email_file_ids = request.data.get("email_file_ids", [])
            # Filter to ensure we only include files owned by this user
            email_files = EmailFile.objects.filter(
                id__in=email_file_ids, user=request.user
            )

            # We need to save to use M2M relationship
            temp_rule_generation.save()
            temp_rule_generation.email_files.set(email_files)

            # Generate the prompt
            prompt = SpamGenieService.generate_prompt(temp_rule_generation)

            # Get metadata
            metadata = temp_rule_generation.prompt_metadata

            # Delete the temporary object
            temp_rule_generation.delete()

            return Response(
                {"prompt": prompt, "metadata": metadata}, status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
