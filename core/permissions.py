from rest_framework import permissions


class RoleBasedPermission(permissions.BasePermission):
    """
    Base class for role-based permissions.
    Define the minimum role required for access.
    """

    minimum_role = None  # Should be set by subclasses

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Get user profile. If it doesn't exist, create it with default role (normal)
        try:
            user_profile = request.user.profile
        except:
            from core.models import UserProfile

            user_profile = UserProfile.objects.create(
                user=request.user, role=UserProfile.NORMAL
            )

        # Check if user meets the minimum role requirement
        if self.minimum_role == "admin":
            return user_profile.is_admin
        elif self.minimum_role == "power_user":
            return user_profile.is_power_user
        else:  # Normal user or no specific role needed
            return True


class AdminPermission(RoleBasedPermission):
    """Permission class for admin-only access."""

    minimum_role = "admin"


class PowerUserPermission(RoleBasedPermission):
    """Permission class for power user access (power_user or admin)."""

    minimum_role = "power_user"


class NormalUserPermission(RoleBasedPermission):
    """Permission class for normal user access (any authenticated user)."""

    minimum_role = "normal"


class PromptTemplatePermission(permissions.BasePermission):
    """
    Custom permission for PromptTemplate operations.

    Rules:
    - Anyone can view prompts visible to them
    - Only admins can delete default prompts and modules
    - Power users can create global prompts
    - Normal users can only create user_workspaces or current_workspace prompts
    - Users can only delete prompts they created (except admins)
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return False

        # Allow GET requests for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True

        # For actions that modify data, check user role and permissions
        try:
            user_profile = request.user.profile
        except:
            from core.models import UserProfile

            user_profile = UserProfile.objects.create(
                user=request.user, role=UserProfile.NORMAL
            )

        if view.action == "create":
            # Check if normal user is trying to create a global template
            from core.models import PromptTemplate

            visibility = request.data.get(
                "visibility", PromptTemplate.CURRENT_WORKSPACE
            )
            if visibility == PromptTemplate.GLOBAL and not user_profile.is_power_user:
                return False
            return True

        if view.action == "destroy":
            # Only admins can delete any template
            # Other users can only delete templates they created
            return True  # Detailed check done in has_object_permission

        # Allow other actions
        return True

    def has_object_permission(self, request, view, obj):
        # Always allow GET, HEAD or OPTIONS requests
        if request.method in permissions.SAFE_METHODS:
            return True

        # Get user profile
        try:
            user_profile = request.user.profile
        except:
            from core.models import UserProfile

            user_profile = UserProfile.objects.create(
                user=request.user, role=UserProfile.NORMAL
            )

        # Special rules for delete operation
        if view.action == "destroy":
            # If template is a base prompt or module
            if obj.is_base or obj.is_module:
                # Only admin can delete default prompts and modules
                return user_profile.is_admin

            # Normal users can only delete templates they created
            if not user_profile.is_power_user:
                return obj.created_by == request.user

            # Power users can delete any non-default template
            return True

        # Rules for update operation
        if view.action in ["update", "partial_update"]:
            # Check if trying to change visibility to global
            if "visibility" in request.data:
                from core.models import PromptTemplate

                if (
                    request.data["visibility"] == PromptTemplate.GLOBAL
                    and not user_profile.is_power_user
                ):
                    return False

            # Normal users can only update templates they created
            if not user_profile.is_power_user:
                return obj.created_by == request.user

        # Default to allow
        return True


class WorkspacePermission(permissions.BasePermission):
    """
    Custom permission for Workspace operations.

    Rules:
    - Users can only access their own workspaces
    - Admin users can see all workspaces
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Admin can access any workspace
        try:
            user_profile = request.user.profile
            if user_profile.is_admin:
                return True
        except:
            pass

        # Users can only access their own workspaces
        return obj.user == request.user
