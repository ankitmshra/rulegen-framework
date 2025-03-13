from django.shortcuts import render


def index(request, path=None):
    """
    Main view for the SPA. Renders the React application.
    All routing will be handled on the client-side.
    """
    return render(request, 'frontend/index.html')
