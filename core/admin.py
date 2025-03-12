from django.contrib import admin
from .models import EmailFile, RuleGeneration


@admin.register(EmailFile)
class EmailFileAdmin(admin.ModelAdmin):
    """Admin configuration for the EmailFile model."""
    list_display = ('original_filename', 'uploaded_at', 'processed')
    list_filter = ('processed', 'uploaded_at')
    search_fields = ('original_filename',)


@admin.register(RuleGeneration)
class RuleGenerationAdmin(admin.ModelAdmin):
    """Admin configuration for the RuleGeneration model."""
    list_display = ('id', 'created_at', 'is_complete')
    list_filter = ('is_complete', 'created_at')
    readonly_fields = ('prompt', 'rule')
    filter_horizontal = ('email_files',)
