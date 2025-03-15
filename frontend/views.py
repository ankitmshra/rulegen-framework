from django.shortcuts import render


def login_view(request):
    """
    Dedicated login view that doesn't require authentication.
    This renders the React app which will handle the login form.
    """
    return render(request, 'frontend/index.html')


def index(request, path=None):
    """
    Main view for the SPA. Renders the React application.
    All routing will be handled on the client-side.
    """
    return render(request, 'frontend/index.html')
