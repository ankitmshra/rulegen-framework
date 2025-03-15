# core/auth_views.py - Update existing file

from django.contrib.auth import authenticate, login, logout
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import UserProfile


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "Please provide both username and password"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)
    if user is not None:
        login(request, user)

        # Get or create user profile
        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=user, role=UserProfile.NORMAL)

        return Response(
            {
                "success": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "role": profile.role,
                },
            }
        )
    return Response(
        {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(["POST"])
def logout_view(request):
    """Thoroughly clean up the session when user logs out."""
    # Get user ID for localStorage clearing in response
    user_id = request.user.id if request.user.is_authenticated else None

    # Standard Django logout
    logout(request)

    # Create response for clearing localStorage
    response_data = {
        "success": True,
        "user_id": user_id,  # Include this so frontend can clear user-specific localStorage
    }

    # Return response with instructions to clear localStorage
    return Response(response_data)


@api_view(["GET"])
def current_user(request):
    if not request.user.is_authenticated:
        return Response({"authenticated": False}, status=status.HTTP_401_UNAUTHORIZED)

    # Get or create user profile
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user, role=UserProfile.NORMAL)

    return Response(
        {
            "authenticated": True,
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "firstName": request.user.first_name,
            "lastName": request.user.last_name,
            "role": profile.role,
            "isAdmin": profile.is_admin,
            "isPowerUser": profile.is_power_user,
        }
    )
