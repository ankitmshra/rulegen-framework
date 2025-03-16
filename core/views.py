"""
Views for core API endpoints.
"""

from django.contrib.auth.models import User
from django.db.models import Q
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
import os
import threading
from django.conf import settings

from .models import (
    EmailFile,
    RuleGeneration,
    PromptTemplate,
    WorkspaceShare,
    Workspace,
)
from .serializers import (
    EmailFileSerializer,
    RuleGenerationSerializer,
    PromptTemplateSerializer,
    UserSerializer,
    WorkspaceShareSerializer,
    WorkspaceSerializer,
)
from .services import SpamGenieService
from .prompt_manager import PromptManager
from .permissions import (
    AdminPermission,
    NormalUserPermission,
    PromptTemplatePermission,
    WorkspacePermission,
)


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

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Search users by username or email."""
        query = request.query_params.get("q", "")
        if len(query) < 2:
            return Response([])

        # Don't include the current user in results
        users = (
            User.objects.filter(
                Q(username__icontains=query) | Q(email__icontains=query)
            )
            .exclude(id=request.user.id)
            .values("id", "username", "email")[:10]
        )

        return Response(users)


class WorkspaceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing workspaces."""

    permission_classes = [NormalUserPermission, WorkspacePermission]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        """Return workspaces based on user permissions."""
        user = self.request.user

        # Admin can see all workspaces if 'all' parameter is provided
        if self.request.query_params.get("all", "").lower() == "true":
            try:
                user_profile = self.request.user.profile
                if user_profile.is_admin:
                    return Workspace.objects.all().order_by("-created_at")
            except ObjectDoesNotExist:
                pass

        # Get workspaces this user has access to through sharing
        shared_workspaces = WorkspaceShare.objects.filter(shared_with=user).values_list(
            "workspace_id", flat=True
        )

        # Return user's own workspaces OR shared ones
        return Workspace.objects.filter(
            Q(user=user) | Q(id__in=shared_workspaces)
        ).order_by("-created_at")

    def perform_create(self, serializer):
        """Set the user when creating a workspace."""
        serializer.save(user=self.request.user)

    # Add a method to check permissions specifically for workspace creation
    def create(self, request, *args, **kwargs):
        """Override create method to handle permissions."""
        # For admin users, we don't need additional checks
        try:
            if request.user.profile.is_admin:
                return super().create(request, *args, **kwargs)
        except Exception:
            pass

        # For regular users, continue with the standard create process
        return super().create(request, *args, **kwargs)


class EmailFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing email files."""

    permission_classes = [NormalUserPermission, WorkspacePermission]
    serializer_class = EmailFileSerializer

    def get_queryset(self):
        """
        Return email files based on user permissions.
        """
        # Admin can see all files if 'all' parameter is provided
        if self.request.query_params.get("all", "").lower() == "true":
            try:
                user_profile = self.request.user.profile
                if user_profile.is_admin:
                    return EmailFile.objects.all().order_by("-uploaded_at")
            except ObjectDoesNotExist:
                pass

        # Get workspaces this user has access to
        workspaces = Workspace.objects.filter(
            Q(user=self.request.user)  # User's own workspaces
            | Q(shares__shared_with=self.request.user)  # Shared workspaces
        )

        # Filter by specific workspace ID if provided
        workspace_id = self.request.query_params.get("workspace", None)
        if workspace_id:
            try:
                workspace_id = int(workspace_id)
                # Check if user has access to this specific workspace
                workspace = workspaces.filter(id=workspace_id).first()
                if workspace:
                    return EmailFile.objects.filter(workspace=workspace).order_by(
                        "-uploaded_at"
                    )
                else:
                    # If user doesn't have access, return empty queryset
                    return EmailFile.objects.none()
            except (ValueError, Workspace.DoesNotExist):
                # If invalid workspace ID, return empty queryset
                return EmailFile.objects.none()

        # Return all email files from workspaces the user has access to
        return EmailFile.objects.filter(workspace__in=workspaces).order_by(
            "-uploaded_at"
        )

    def perform_create(self, serializer):
        """Set the uploaded_by field and create the upload directory if needed."""
        # Create the upload directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
        os.makedirs(upload_dir, exist_ok=True)

        file_obj = self.request.FILES.get("file")
        workspace_id = self.request.data.get("workspace")

        if file_obj:
            if not file_obj.name.lower().endswith(".eml"):
                raise ValidationError({"file": "Only .eml files are supported."})

            try:
                # Check if the user has access to this workspace
                workspace = Workspace.objects.get(id=workspace_id)

                # Check if user owns the workspace or has write permission
                has_permission = False
                if workspace.user == self.request.user:
                    has_permission = True
                else:
                    # Check if user has write permission for shared workspace
                    has_permission = WorkspaceShare.objects.filter(
                        workspace=workspace,
                        shared_with=self.request.user,
                        permission=WorkspaceShare.WRITE,
                    ).exists()

                if not has_permission:
                    raise PermissionDenied(
                        "You don't have permission to upload files to this workspace."
                    )

                # Save the EmailFile
                serializer.save(
                    original_filename=file_obj.name,
                    uploaded_by=self.request.user,
                    workspace=workspace,
                )
            except Workspace.DoesNotExist:
                raise ValidationError({"workspace": "Workspace not found."})
        else:
            raise ValidationError({"file": "No file was submitted."})

    @action(detail=False, methods=["get"])
    def available_headers(self, request):
        """Get all available headers from the processed emails."""
        # Get workspace if specified
        workspace_id = request.query_params.get("workspace", None)
        email_files = None

        if workspace_id:
            try:
                workspace = Workspace.objects.get(id=workspace_id)
                # Check permission
                if (
                    workspace.user == request.user
                    or WorkspaceShare.objects.filter(
                        workspace=workspace, shared_with=request.user
                    ).exists()
                ):
                    email_files = EmailFile.objects.filter(workspace=workspace)
            except Workspace.DoesNotExist:
                return Response(
                    {"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND
                )
        else:
            email_files = self.get_queryset()

        if not email_files or email_files.count() == 0:
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
          - Templates for workspaces they can access
        """
        user = self.request.user

        # Check user role
        try:
            user_profile = user.profile
            is_power_user = user_profile.is_power_user
        except ObjectDoesNotExist:
            is_power_user = False

        # If power user or admin, show all templates
        if is_power_user:
            queryset = PromptTemplate.objects.all()
        else:
            # Get workspaces the user has access to
            accessible_workspaces = Workspace.objects.filter(
                Q(user=user)  # User's own workspaces
                | Q(shares__shared_with=user)  # Shared workspaces
            )

            # For normal users,
            # show global templates + own templates + workspace templates they can access
            queryset = PromptTemplate.objects.filter(
                Q(visibility=PromptTemplate.GLOBAL)
                | Q(created_by=user)
                | Q(visibility=PromptTemplate.USER_WORKSPACES, created_by=user)
                | Q(
                    visibility=PromptTemplate.WORKSPACE,
                    workspace__in=accessible_workspaces,
                )
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
        """Return rule generations based on user permissions."""
        user = self.request.user

        # Get workspaces this user has access to
        accessible_workspaces = Workspace.objects.filter(
            Q(user=user)  # User's own workspaces
            | Q(shares__shared_with=user)  # Shared workspaces
        )

        # Get rule generations for these workspaces
        return RuleGeneration.objects.filter(
            workspace__in=accessible_workspaces
        ).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        """Create a new rule generation request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verify user has access to the workspace
        workspace_id = serializer.validated_data.get("workspace").id
        try:
            workspace = Workspace.objects.get(id=workspace_id)

            # Check permission (must be owner or have write permission)
            if workspace.user != request.user:
                share = WorkspaceShare.objects.filter(
                    workspace=workspace,
                    shared_with=request.user,
                    permission=WorkspaceShare.WRITE,
                ).first()

                if not share:
                    return Response(
                        {
                            "error": "You don't have permission to create rules for this workspace"
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

            # Create the rule generation
            rule_generation = serializer.save(created_by=request.user)

            # Start a background thread to process the rule generation
            threading.Thread(
                target=SpamGenieService.process_rule_generation,
                args=(rule_generation.id,),
            ).start()

            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        """Get the status of a rule generation request."""
        rule_generation = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(
            {
                "id": rule_generation.id,
                "workspace_name": rule_generation.workspace.name,
                "is_complete": rule_generation.is_complete,
                "rule": rule_generation.rule if rule_generation.is_complete else None,
            },
            status=status.HTTP_200_OK,
        )

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
        # Get the workspace
        workspace_id = request.data.get("workspace_id")
        if not workspace_id:
            return Response(
                {"error": "Workspace ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            workspace = Workspace.objects.get(id=workspace_id)
            # Check permission
            if (
                workspace.user != request.user
                and not WorkspaceShare.objects.filter(
                    workspace=workspace, shared_with=request.user
                ).exists()
            ):
                return Response(
                    {"error": "You don't have permission to access this workspace"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Get email files for this workspace
            email_files = EmailFile.objects.filter(workspace=workspace)

            # Create a temporary RuleGeneration object
            temp_rule_generation = RuleGeneration(
                workspace=workspace,
                created_by=request.user,
                prompt_modules=request.data.get("prompt_modules", []),
                base_prompt_id=request.data.get("base_prompt_id"),
            )

            # Save to get an ID
            temp_rule_generation.save()

            # Update workspace's selected_headers if provided
            selected_headers = request.data.get("selected_headers")
            if selected_headers:
                workspace.selected_headers = selected_headers
                workspace.save()

            # Generate the prompt
            prompt = SpamGenieService.generate_prompt(temp_rule_generation, email_files)

            # Get metadata
            metadata = temp_rule_generation.prompt_metadata

            # Delete the temporary object
            temp_rule_generation.delete()

            return Response(
                {"prompt": prompt, "metadata": metadata}, status=status.HTTP_200_OK
            )
        except Exception as e:
            if hasattr(e, "__class__") and e.__class__.__name__ != "Exception":
                # Use the specific exception name in the error message
                error_type = e.__class__.__name__
                error_message = f"{error_type}: {str(e)}"
            else:
                error_message = str(e)

            return Response(
                {"error": error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WorkspaceShareViewSet(viewsets.ModelViewSet):
    """ViewSet for managing workspace sharing."""

    permission_classes = [NormalUserPermission]
    serializer_class = WorkspaceShareSerializer

    def get_queryset(self):
        """Return workspace shares based on user permissions."""
        # Users can only see shares for workspaces they own
        return WorkspaceShare.objects.filter(
            workspace__user=self.request.user
        ).order_by("workspace__name", "shared_with__username")

    @action(detail=False, methods=["post"])
    def share_workspace(self, request):
        """Share a workspace with another user."""
        workspace_id = request.data.get("workspace_id")
        username_or_email = request.data.get("username_or_email")
        permission = request.data.get("permission", WorkspaceShare.READ)

        if not workspace_id or not username_or_email:
            return Response(
                {"error": "Both workspace_id and username_or_email are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the workspace exists and user owns it
        try:
            workspace = Workspace.objects.get(id=workspace_id, user=request.user)
        except Workspace.DoesNotExist:
            return Response(
                {
                    "error": "Workspace not found or you do not have permission to share it"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Find the user to share with
        try:
            if "@" in username_or_email:
                # Search by email
                shared_with = User.objects.get(email=username_or_email)
            else:
                # Search by username
                shared_with = User.objects.get(username=username_or_email)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Don't allow sharing with yourself
        if shared_with == request.user:
            return Response(
                {"error": "You cannot share a workspace with yourself"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or update the share
        share, created = WorkspaceShare.objects.update_or_create(
            workspace=workspace,
            shared_with=shared_with,
            defaults={"permission": permission},
        )

        serializer = self.get_serializer(share)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["delete"])
    def remove_share(self, request):
        """Remove sharing for a workspace."""
        workspace_id = request.data.get("workspace_id")
        user_id = request.data.get("user_id")

        if not workspace_id or not user_id:
            return Response(
                {"error": "Both workspace_id and user_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Verify the workspace exists and user owns it
            workspace = Workspace.objects.get(id=workspace_id, user=request.user)

            # Find and delete the share
            share = WorkspaceShare.objects.get(
                workspace=workspace, shared_with_id=user_id
            )
            share.delete()

            return Response(status=status.HTTP_204_NO_CONTENT)
        except Workspace.DoesNotExist:
            return Response(
                {
                    "error": (
                        "Workspace not found or you do not have permission to manage its shares"
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except WorkspaceShare.DoesNotExist:
            return Response(
                {"error": "Share not found"}, status=status.HTTP_404_NOT_FOUND
            )
