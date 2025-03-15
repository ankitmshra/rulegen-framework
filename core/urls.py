from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmailFileViewSet, RuleGenerationViewSet, PromptTemplateViewSet
from .auth_views import login_view, logout_view, current_user

# Create a router for our API views
router = DefaultRouter()
router.register(r'email-files', EmailFileViewSet, basename='email-files')
router.register(r'rule-generations', RuleGenerationViewSet, basename='rule-generations')
router.register(r'prompt-templates', PromptTemplateViewSet)

# URL patterns for our API
urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/user/', current_user, name='current-user'),
]
