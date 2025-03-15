from django.urls import path, re_path
from .views import index, login_view

urlpatterns = [
    # Define the login route with a dedicated view
    path('login/', login_view, name='login'),
    # Then define the root path
    path('', index, name='index'),
    # Catch all other routes with wildcard
    re_path(r'^(?P<path>.*)$', index, name='index-wildcard'),
]
