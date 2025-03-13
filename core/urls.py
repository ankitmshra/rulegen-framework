from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmailFileViewSet, RuleGenerationViewSet, PromptTemplateViewSet

# Create a router for our API views
router = DefaultRouter()
router.register(r'email-files', EmailFileViewSet)
router.register(r'rule-generations', RuleGenerationViewSet)
router.register(r'prompt-templates', PromptTemplateViewSet)

# URL patterns for our API
urlpatterns = [
    path('', include(router.urls)),
]
