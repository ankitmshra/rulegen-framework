from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import EmailFile, RuleGeneration, PromptTemplate
from .serializers import EmailFileSerializer, RuleGenerationSerializer, PromptTemplateSerializer
from .services import SpamGenieService
import threading


class EmailFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing email files."""
    queryset = EmailFile.objects.all().order_by('-uploaded_at')
    serializer_class = EmailFileSerializer

    def perform_create(self, serializer):
        """Set the original filename when creating an email file."""
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
            base_prompt = PromptTemplate.objects.get(is_base=True)
            serializer = self.get_serializer(base_prompt)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PromptTemplate.DoesNotExist:
            return Response(
                {"error": "No base prompt template found"},
                status=status.HTTP_404_NOT_FOUND
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
            'is_complete': rule_generation.is_complete,
            'rule': rule_generation.rule if rule_generation.is_complete else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def generate_default_prompt(self, request):
        """Generate a default prompt without saving."""
        try:
            # Create a temporary RuleGeneration object
            temp_rule_generation = RuleGeneration(
                selected_headers=request.data.get('selected_headers', []),
                prompt_modules=request.data.get('prompt_modules', [])
            )

            # Add email files to the temporary object
            email_file_ids = request.data.get('email_file_ids', [])
            email_files = EmailFile.objects.filter(id__in=email_file_ids)

            # We need to save to use M2M relationship
            temp_rule_generation.save()
            temp_rule_generation.email_files.set(email_files)

            # Generate the prompt
            prompt = SpamGenieService.generate_prompt(temp_rule_generation)

            # Delete the temporary object
            temp_rule_generation.delete()

            return Response({
                'prompt': prompt
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
