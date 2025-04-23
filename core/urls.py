from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet,
    WorkspaceViewSet,
    EmailFileViewSet,
    RuleGenerationViewSet,
    PromptTemplateViewSet,
    WorkspaceShareViewSet,
)
from .auth_views import login_view, logout_view, current_user
from . import views

# Create a router for our API views
router = DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"workspaces", WorkspaceViewSet, basename="workspaces")
router.register(r"email-files", EmailFileViewSet, basename="email-files")
router.register(r"rule-generations", RuleGenerationViewSet, basename="rule-generations")
router.register(r"prompt-templates", PromptTemplateViewSet, basename="prompt-templates")
router.register(r"workspace-shares", WorkspaceShareViewSet, basename="workspace-shares")

# URL patterns for our API
urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", login_view, name="login"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/user/", current_user, name="current-user"),
    path('settings/rule-gen-timeout/', views.rule_gen_timeout_settings, name='rule-gen-timeout-settings'),
    path('settings/openai-api-endpoint/', views.openai_api_endpoint_settings, name='openai-api-endpoint-settings'),
    path('settings/openai-api-version/', views.openai_api_version_settings, name='openai-api-version-settings'),
    path('settings/openai-model-name/', views.openai_model_name_settings, name='openai-model-name-settings'),
    path('settings/openai-embedding-model-name/', views.openai_embedding_model_name_settings, name='openai-embedding-model-name-settings'),
    path('settings/openai-team-name/', views.openai_team_name_settings, name='openai-team-name-settings'),
    path('settings/openai-available-models/', views.openai_available_models, name='openai-available-models'),
]
