from rest_framework import serializers
from .models import EmailFile, RuleGeneration


class EmailFileSerializer(serializers.ModelSerializer):
    """Serializer for the EmailFile model."""
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EmailFile
        fields = ['id', 'file', 'file_url', 'original_filename', 'uploaded_at', 'processed']
        read_only_fields = ['uploaded_at', 'processed', 'original_filename']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url') and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class RuleGenerationSerializer(serializers.ModelSerializer):
    """Serializer for the RuleGeneration model."""
    email_files = EmailFileSerializer(many=True, read_only=True)
    email_file_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True
    )

    class Meta:
        model = RuleGeneration
        fields = ['id', 'email_files', 'email_file_ids', 'selected_headers',
                  'prompt', 'rule', 'created_at', 'is_complete']
        read_only_fields = ['prompt', 'rule', 'created_at', 'is_complete']

    def create(self, validated_data):
        email_file_ids = validated_data.pop('email_file_ids')
        rule_generation = RuleGeneration.objects.create(**validated_data)

        # Add the email files to the rule generation
        email_files = EmailFile.objects.filter(id__in=email_file_ids)
        rule_generation.email_files.set(email_files)

        return rule_generation
