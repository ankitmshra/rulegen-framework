from django.db.models import Count, Max
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import EmailFile, RuleGeneration, PromptTemplate
from .serializers import EmailFileSerializer, RuleGenerationSerializer, PromptTemplateSerializer
from .services import SpamGenieService
from .prompt_manager import PromptManager
import threading
import os
from django.conf import settings


class EmailFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing email files."""
    queryset = EmailFile.objects.all().order_by('-uploaded_at')
    serializer_class = EmailFileSerializer

    def perform_create(self, serializer):
        """Set the original filename when creating an email file."""
        # Create the upload directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        file_obj = self.request.FILES.get('file')
        if file_obj:
            if not file_obj.name.lower().endswith('.eml'):
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"file": "Only .eml files are supported."})
            serializer.save(original_filename=file_obj.name)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"file": "No file was submitted."})

    @action(detail=False, methods=['get'])
    def available_headers(self, request):
        """Get all available headers from the processed emails."""
        email_files = EmailFile.objects.all()
        if not email_files:
            return Response({"error": "No email files found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            headers = SpamGenieService.get_available_headers(email_files)
            return Response(headers, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PromptTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing prompt templates."""
    queryset = PromptTemplate.objects.all().order_by('name')
    serializer_class = PromptTemplateSerializer

    @action(detail=False, methods=['get'])
    def modules(self, request):
        """Get all available prompt modules."""
        modules = PromptTemplate.objects.filter(is_module=True)
        serializer = self.get_serializer(modules, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def base(self, request):
        """Get the base prompt template."""
        try:
            # Using PromptManager to get base prompts
            base_prompts = PromptManager.get_base_prompts()
            if not base_prompts:
                return Response(
                    {"error": "No base prompt template found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Return the first one for backward compatibility
            serializer = self.get_serializer(base_prompts.first())
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Error retrieving base prompt: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RuleGenerationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing rule generations."""
    queryset = RuleGeneration.objects.all().order_by('-created_at')
    serializer_class = RuleGenerationSerializer

    def create(self, request, *args, **kwargs):
        """Create a new rule generation request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule_generation = serializer.save()

        # Start a background thread to process the rule generation
        threading.Thread(
            target=SpamGenieService.process_rule_generation,
            args=(rule_generation.id,)
        ).start()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get the status of a rule generation request."""
        rule_generation = get_object_or_404(RuleGeneration, pk=pk)
        return Response({
            'id': rule_generation.id,
            'workspace_name': rule_generation.workspace_name,
            'is_complete': rule_generation.is_complete,
            'rule': rule_generation.rule if rule_generation.is_complete else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def workspaces(self, request):
        """Get all unique workspaces with their latest rule generation."""
        workspaces = RuleGeneration.objects.values('workspace_name').annotate(
            count=Count('id'),
            latest_id=Max('id'),
            latest_date=Max('created_at')
        ).order_by('-latest_date')

        return Response(workspaces, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def base_prompts(self, request):
        """Get all available base prompts."""
        try:
            # Using PromptManager to get base prompts
            base_prompts = PromptManager.get_base_prompts()
            serializer = PromptTemplateSerializer(base_prompts, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_default_prompt(self, request):
        """Generate a default prompt without saving."""
        try:
            # Create a temporary RuleGeneration object
            temp_rule_generation = RuleGeneration(
                selected_headers=request.data.get('selected_headers', []),
                prompt_modules=request.data.get('prompt_modules', []),
                workspace_name=request.data.get('workspace_name', 'Temporary Workspace'),
                base_prompt_id=request.data.get('base_prompt_id')
            )

            # Add email files to the temporary object
            email_file_ids = request.data.get('email_file_ids', [])
            email_files = EmailFile.objects.filter(id__in=email_file_ids)

            # We need to save to use M2M relationship
            temp_rule_generation.save()
            temp_rule_generation.email_files.set(email_files)

            # Generate the prompt
            prompt = SpamGenieService.generate_prompt(temp_rule_generation)

            # Get metadata
            metadata = temp_rule_generation.prompt_metadata

            # Delete the temporary object
            temp_rule_generation.delete()

            return Response({
                'prompt': prompt,
                'metadata': metadata
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
