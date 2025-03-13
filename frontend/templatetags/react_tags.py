import os
import json
from django import template
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage

register = template.Library()


@register.simple_tag
def react_asset(asset_name):
    """
    Template tag to get the proper URL for a React asset.

    Usage:
        {% react_asset 'main.js' %}
        {% react_asset 'main.css' %}
    """
    manifest_path = os.path.join(
        settings.BASE_DIR, 'frontend', 'static', 'frontend', 'react', 'asset-manifest.json'
        )

    try:
        with open(manifest_path, 'r') as manifest_file:
            manifest = json.load(manifest_file)

        # Different React versions structure the manifest differently
        # Check for the files property (Create React App v5+)
        if 'files' in manifest:
            if asset_name.startswith('static/'):
                # Handle full paths
                asset_path = manifest['files'].get(asset_name)
            else:
                # Handle main.js, main.css, etc.
                for key, value in manifest['files'].items():
                    if key.endswith(asset_name):
                        asset_path = value
                        break
                else:
                    asset_path = None
        else:
            # Older CRA versions had a flatter structure
            asset_path = manifest.get(asset_name)

        if asset_path:
            # Remove the leading slash if present
            if asset_path.startswith('/'):
                asset_path = asset_path[1:]

            # Check if the path contains 'static/frontend/react'
            if 'static/frontend/react' not in asset_path:
                # Add the appropriate path prefix
                return staticfiles_storage.url(os.path.join('frontend', 'react', asset_path))
            else:
                return staticfiles_storage.url(asset_path)

    except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
        if settings.DEBUG:
            return f"/* Error loading asset {asset_name}: {str(e)} */"

    # Fallback if we can't find the asset
    return staticfiles_storage.url(
        os.path.join('frontend', 'react', 'static', asset_name.split('/')[-1])
        )
