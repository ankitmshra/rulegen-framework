"""
Middleware for the core API.
"""

from django.http import JsonResponse


class APIAuthenticationMiddleware:
    """
    Middleware to ensure API routes are authenticated.
    For SPA navigation, the frontend React router handles authentication.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip authentication checks for auth-related endpoints, login page, and CSRF
        # This allows unauthenticated users to access login/auth endpoints
        if (
            request.path.startswith("/api/auth/")
            or request.path == "/login/"
            or "csrf" in request.path
        ):
            return self.get_response(request)

        # Check authentication for other API routes
        if request.path.startswith("/api/") and not request.user.is_authenticated:
            # Return 401 for API requests
            return JsonResponse({"error": "Authentication required"}, status=401)

        # Continue with the request
        return self.get_response(request)
