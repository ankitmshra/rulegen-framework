"""
Views for core API endpoints.
"""

from django.contrib.auth.models import User
from django.db.models import Q
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
import os
import threading
from django.conf import settings
from rest_framework.permissions import IsAdminUser
import datetime
import jwt
from openai import AzureOpenAI

from .models import (
    EmailFile,
    RuleGeneration,
    PromptTemplate,
    WorkspaceShare,
    Workspace,
    AppSettings,
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

    def create(self, request, *args, **kwargs):
        """Override create method to provide enhanced response with ownership info."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Explicitly set the user (owner) to the current user
        serializer.save(user=request.user)

        # Enhance the response with additional fields that match the summary endpoint format
        response_data = serializer.data
        response_data["is_owner"] = True
        response_data["owner_username"] = request.user.username
        response_data["rule_count"] = 0
        response_data["latest_date"] = None
        response_data["shares"] = []

        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Get a summary of workspaces including ownership and sharing information."""
        user = request.user

        # Get user's own workspaces
        own_workspaces = Workspace.objects.filter(user=user)

        # Get workspaces shared with the user
        shared_workspaces_ids = WorkspaceShare.objects.filter(
            shared_with=user
        ).values_list("workspace_id", flat=True)
        shared_workspaces = Workspace.objects.filter(id__in=shared_workspaces_ids)

        # Ensure we're not double-counting (a workspace shouldn't be both owned and shared)
        shared_workspaces = shared_workspaces.exclude(user=user)

        # Prepare workspace summaries
        workspace_summaries = []

        # Add user's own workspaces
        for workspace in own_workspaces:
            # Count rules in this workspace
            rule_count = RuleGeneration.objects.filter(workspace=workspace).count()

            # Get latest rule generation date
            latest_rule = (
                RuleGeneration.objects.filter(workspace=workspace)
                .order_by("-created_at")
                .first()
            )

            latest_date = latest_rule.created_at if latest_rule else None

            # Get shares for this workspace
            shares = WorkspaceShare.objects.filter(workspace=workspace)
            shares_info = [
                {
                    "user_id": share.shared_with.id,
                    "username": share.shared_with.username,
                    "permission": share.permission,
                }
                for share in shares
            ]

            workspace_summaries.append(
                {
                    "id": workspace.id,
                    "name": workspace.name,
                    "description": workspace.description,
                    "is_owner": True,
                    "owner_username": user.username,
                    "created_at": workspace.created_at,
                    "rule_count": rule_count,
                    "latest_date": latest_date,
                    "shares": shares_info,
                }
            )

        # Add workspaces shared with user
        for workspace in shared_workspaces:
            # Count rules in this workspace
            rule_count = RuleGeneration.objects.filter(workspace=workspace).count()

            # Get latest rule generation date
            latest_rule = (
                RuleGeneration.objects.filter(workspace=workspace)
                .order_by("-created_at")
                .first()
            )

            latest_date = latest_rule.created_at if latest_rule else None

            # Get share permission
            share = WorkspaceShare.objects.get(workspace=workspace, shared_with=user)

            workspace_summaries.append(
                {
                    "id": workspace.id,
                    "name": workspace.name,
                    "description": workspace.description,
                    "is_owner": False,
                    "owner_username": workspace.user.username,
                    "created_at": workspace.created_at,
                    "rule_count": rule_count,
                    "latest_date": latest_date,
                    "permission": share.permission,
                }
            )

        return Response(workspace_summaries, status=status.HTTP_200_OK)


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

                # Save the EmailFile with spam type
                serializer.save(
                    original_filename=file_obj.name,
                    uploaded_by=self.request.user,
                    workspace=workspace,
                    email_type=EmailFile.SPAM,
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
        """Return rule generations based on user permissions with proper workspace filtering."""
        user = self.request.user

        # Get workspace ID from query parameter
        workspace_id = self.request.query_params.get("workspace")

        # If specific workspace is requested, verify access and return its rules
        if workspace_id:
            try:
                # Find the workspace first
                workspace = Workspace.objects.get(id=workspace_id)

                # Check if user has access (owner or shared)
                has_access = (workspace.user == user) or WorkspaceShare.objects.filter(
                    workspace=workspace, shared_with=user
                ).exists()

                if has_access:
                    # User has access, return ALL rules for this workspace regardless of creator
                    return RuleGeneration.objects.filter(workspace=workspace).order_by(
                        "-created_at"
                    )
                else:
                    # No access to this workspace
                    return RuleGeneration.objects.none()

            except Workspace.DoesNotExist:
                # Workspace not found
                return RuleGeneration.objects.none()

        # No specific workspace requested, return rules from all accessible workspaces
        accessible_workspaces = Workspace.objects.filter(
            Q(user=user) | Q(shares__shared_with=user)
        )

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
                "error": rule_generation.error if rule_generation.is_complete else None,
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
        workspace_id = request.data.get("workspace_id")
        if not workspace_id:
            return Response(
                {"error": "workspace_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
                            "error": "You don't have permission to generate prompts for this workspace"
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

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


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def rule_gen_timeout_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.RULE_GEN_TIMEOUT)
            return Response({'timeout': int(setting.value)})
        except AppSettings.DoesNotExist:
            return Response({'timeout': 30000})
    
    elif request.method == 'POST':
        timeout = request.data.get('timeout')
        if not timeout or not isinstance(timeout, int) or timeout < 1000:
            return Response(
                {'error': 'Invalid timeout value. Must be an integer >= 1000'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.RULE_GEN_TIMEOUT,
            defaults={
                'value': str(timeout),
                'description': 'Timeout value in milliseconds for rule generation'
            }
        )
        if setting.value != str(timeout):
            setting.value = str(timeout)
            setting.save()
        
        return Response({'timeout': timeout})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def openai_api_endpoint_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_ENDPOINT)
            return Response({'endpoint': setting.value})
        except AppSettings.DoesNotExist:
            return Response({'endpoint': 'https://api.sage.cudasvc.com'})
    
    elif request.method == 'POST':
        endpoint = request.data.get('endpoint')
        if not endpoint or not isinstance(endpoint, str):
            return Response(
                {'error': 'Invalid endpoint value. Must be a valid URL.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.OPENAI_API_ENDPOINT,
            defaults={
                'value': endpoint,
                'description': 'OpenAI API endpoint URL for rule generation'
            }
        )
        if setting.value != endpoint:
            setting.value = endpoint
            setting.save()
        
        return Response({'endpoint': endpoint})

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def openai_api_version_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_VERSION)
            return Response({'version': setting.value})
        except AppSettings.DoesNotExist:
            return Response({'version': ''})
    
    elif request.method == 'POST':
        version = request.data.get('version', '')  # Default to empty string if not provided
        if not isinstance(version, str):
            return Response(
                {'error': 'Invalid version value. Must be a string.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.OPENAI_API_VERSION,
            defaults={
                'value': version,
                'description': 'OpenAI API version for rule generation'
            }
        )
        if setting.value != version:
            setting.value = version
            setting.save()
        
        return Response({'version': version})

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def openai_model_name_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.OPENAI_MODEL_NAME)
            return Response({'model': setting.value})
        except AppSettings.DoesNotExist:
            return Response({'model': 'deepseek-r1'})
    
    elif request.method == 'POST':
        model = request.data.get('model')
        if not model or not isinstance(model, str):
            return Response(
                {'error': 'Invalid model value. Must be a string.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.OPENAI_MODEL_NAME,
            defaults={
                'value': model,
                'description': 'OpenAI model name for rule generation'
            }
        )
        if setting.value != model:
            setting.value = model
            setting.save()
        
        return Response({'model': model})

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def openai_team_name_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.OPENAI_TEAM_NAME)
            return Response({'team': setting.value})
        except AppSettings.DoesNotExist:
            return Response({'team': 'bci_ta'})
    
    elif request.method == 'POST':
        team = request.data.get('team')
        if not team or not isinstance(team, str):
            return Response(
                {'error': 'Invalid team value. Must be a string.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.OPENAI_TEAM_NAME,
            defaults={
                'value': team,
                'description': 'OpenAI team name for API authentication'
            }
        )
        if setting.value != team:
            setting.value = team
            setting.save()
        
        return Response({'team': team})

@api_view(['GET'])
@permission_classes([IsAdminUser])
def openai_available_models(request):
    """Fetch available models from the OpenAI API."""
    import logging
    
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get API endpoint from settings
        try:
            endpoint_setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_ENDPOINT)
            api_endpoint = endpoint_setting.value
        except AppSettings.DoesNotExist:
            api_endpoint = 'https://api.sage.cudasvc.com'  # Default endpoint

        # Get API version from settings
        try:
            version_setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_VERSION)
            api_version = version_setting.value
        except AppSettings.DoesNotExist:
            api_version = ''  # Default version

        # Get team name from settings
        try:
            team_setting = AppSettings.objects.get(key=AppSettings.OPENAI_TEAM_NAME)
            team_name = team_setting.value
        except AppSettings.DoesNotExist:
            team_name = 'bci_ta'  # Default team name

        # Generate JWT token for authentication
        team_private_key = settings.TEAM_PRIVATE_KEY
        if not team_private_key:
            raise ValueError("TEAM_PRIVATE_KEY environment variable not set!")

        # Log the first few characters of the key for debugging (safely)
        key_preview = team_private_key[:10] + "..." if team_private_key else "None"
        logging.info(f"Using team private key starting with: {key_preview}")
        
        now = datetime.datetime.now(datetime.UTC)
        payload = {
            "iss": team_name,
            "kid": "1",
            "iat": now.timestamp(),
            "nbf": now.timestamp(),
            "exp": (now + datetime.timedelta(hours=1)).timestamp(),
            "session_token": f"session_{now.timestamp()}",
        }
        
        # Log the payload for debugging
        logging.info(f"JWT payload: {payload}")
        
        encoded = jwt.encode(payload, team_private_key, algorithm="PS256")
        
        # Log the token for debugging
        token_preview = encoded[:20] + "..." if encoded else "None"
        logging.info(f"Generated JWT token starting with: {token_preview}")

        # Create a new client with the current settings
        client = AzureOpenAI(
            api_version=api_version,
            azure_endpoint=api_endpoint,
            api_key=encoded,  # Use the JWT token as the API key
        )

        # Use a direct API call instead of the models.list() method
        headers = {
            "Authorization": f"Bearer {encoded}",
            "Content-Type": "application/json",
        }
        
        logging.info(f"Making request to {api_endpoint}/models with headers: {headers}")
        
        response = client._client.get("/models", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'data' in data:
                model_list = [model['id'] for model in data['data']]
            elif isinstance(data, list):
                model_list = [model['id'] for model in data]
            else:
                raise ValueError(f"Unexpected response format: {data}")
            
            model_list.sort()
            return Response({'models': model_list})
        else:
            # Log the full response for debugging
            logging.error(f"API response status: {response.status_code}")
            logging.error(f"API response headers: {response.headers}")
            logging.error(f"API response body: {response.text}")
            raise ValueError(f"API request failed with status {response.status_code}: {response.text}")
            
    except Exception as e:
        logging.error(f"Error fetching OpenAI models: {str(e)}")
        logging.error(f"Error type: {type(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to fetch models: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def openai_embedding_model_name_settings(request):
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.user.profile.is_admin:
        return Response(
            {'error': 'Admin privileges required'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            setting = AppSettings.objects.get(key=AppSettings.OPENAI_EMBEDDING_MODEL_NAME)
            return Response({'model': setting.value})
        except AppSettings.DoesNotExist:
            return Response({'model': 'text-embedding-ada-002'})
    
    elif request.method == 'POST':
        model = request.data.get('model')
        if not model or not isinstance(model, str):
            return Response(
                {'error': 'Invalid model value. Must be a string.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        setting, _ = AppSettings.objects.get_or_create(
            key=AppSettings.OPENAI_EMBEDDING_MODEL_NAME,
            defaults={
                'value': model,
                'description': 'OpenAI embedding model name for rule generation'
            }
        )
        if setting.value != model:
            setting.value = model
            setting.save()
        
        return Response({'model': model})
