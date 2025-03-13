from django.contrib import admin
from .models import EmailFile, RuleGeneration, PromptTemplate


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


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    """Admin configuration for the PromptTemplate model."""
    list_display = ('name', 'description', 'is_base', 'is_module', 'module_type', 'created_at')
    list_filter = ('is_base', 'is_module', 'created_at')
    search_fields = ('name', 'description', 'template')
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'template')
        }),
        ('Type', {
            'fields': ('is_base', 'is_module', 'module_type')
        }),
    )
