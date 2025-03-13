# frontend/middleware.py
import os
from django.conf import settings


class ReactAssetDebugMiddleware:
    """
    Debug middleware to help troubleshoot React asset loading
    Only active when DEBUG=True
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only process HTML responses in debug mode
        if not settings.DEBUG or 'text/html' not in response.get('Content-Type', ''):
            return response

        # Check for manifest file existence
        manifest_path = os.path.join(
            settings.BASE_DIR, 'frontend', 'static', 'frontend', 'react', 'asset-manifest.json'
            )
        if not os.path.exists(manifest_path):
            # Inject warning at the top of the HTML response
            warning = f"""
            <div style="background-color: #ffecb3; color: #663c00; padding: 10px; \
position: fixed; top: 0; left: 0; right: 0; z-index: 9999;">
                <strong>Warning:</strong> React asset-manifest.json not found at {manifest_path}.
                <br>Make sure you've run <code>npm run deploy</code> \
to build and deploy the React app.
            </div>
            """
            content = response.content.decode('utf-8')
            content = content.replace('<body', warning + '<body')
            response.content = content.encode('utf-8')

        return response
