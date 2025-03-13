// SpamGenie Frontend JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // Initialize CSRF token for AJAX requests
    const csrftoken = getCookie('csrftoken');

    // State tracking variables
    let currentState = {
        fileIds: [],
        selectedHeaders: [],
        selectedModules: [],
        ruleGenerated: false,
        currentRuleId: null
    };

    // Setup prompt editor and get its functions
    const promptHandler = setupPromptEditor();

    // Main navigation functionality
    setupNavigation();

    // File upload functionality
    setupFileUpload();

    // Headers selection functionality
    setupHeadersSelection();

    // Module selection functionality
    setupModuleSelection();

    // Rule generation functionality
    setupRuleGeneration();

    // History functionality
    setupHistory();

    // Load initial data
    loadEmailFiles();

    // -----------------------------------------------------
    // State Management Functions
    // -----------------------------------------------------
    function updateFileState(files) {
        const newFileIds = files.map(file => file.id);
        // Check if file state has changed
        if (JSON.stringify(newFileIds.sort()) !== JSON.stringify(currentState.fileIds.sort())) {
            console.log("File state changed - resetting rule generation");
            currentState.fileIds = newFileIds;
            currentState.ruleGenerated = false;
            resetRuleGenerationUI();
            return true;
        }
        return false;
    }

    function updateHeaderState(headers) {
        // Check if header state has changed
        if (JSON.stringify(headers.sort()) !== JSON.stringify(currentState.selectedHeaders.sort())) {
            console.log("Header state changed - resetting rule generation");
            currentState.selectedHeaders = headers;
            currentState.ruleGenerated = false;
            resetRuleGenerationUI();
            return true;
        }
        return false;
    }

    function updateModuleState(modules) {
        // Check if module state has changed
        if (JSON.stringify(modules.sort()) !== JSON.stringify(currentState.selectedModules.sort())) {
            console.log("Module state changed - resetting rule generation");
            currentState.selectedModules = modules;
            currentState.ruleGenerated = false;
            resetRuleGenerationUI();
            // This doesn't actually reset the UI, it just refreshes the prompt preview
            if (modules !== null) {
                promptHandler.loadDefaultPrompt();
            }
            return true;
        }
        return false;
    }

    function resetRuleGenerationUI() {
        // Only reset UI, not state
        console.log("Resetting rule generation UI");
        document.getElementById('rule-output').textContent = '';
        document.getElementById('generation-result').classList.add('hidden');
        document.getElementById('generation-status').classList.add('hidden');
        document.getElementById('generate-rules').disabled = false;
    }

    // -----------------------------------------------------
    // Navigation Functions
    // -----------------------------------------------------
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const contentSections = document.querySelectorAll('.content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Remove active class from all links
                navLinks.forEach(l => l.classList.remove('active', 'text-indigo-700', 'bg-indigo-50'));
                navLinks.forEach(l => l.classList.add('text-gray-700'));

                // Add active class to clicked link
                link.classList.add('active', 'text-indigo-700', 'bg-indigo-50');
                link.classList.remove('text-gray-700');

                // Hide all content sections
                contentSections.forEach(section => section.classList.add('hidden'));

                // Show the target content section
                const targetSection = document.getElementById(link.getAttribute('data-target'));
                targetSection.classList.remove('hidden');

                // Load data for the section if needed
                if (link.getAttribute('data-target') === 'headers-section') {
                    loadAvailableHeaders();
                } else if (link.getAttribute('data-target') === 'history-section') {
                    loadRuleGenerationHistory();
                } else if (link.getAttribute('data-target') === 'generate-section') {
                    // Update summary
                    updateSelectedSummary();

                    // Load available modules
                    loadAvailableModules();

                    // Load default prompt
                    promptHandler.loadDefaultPrompt();

                    // If files or headers changed but UI wasn't reset yet
                    if (!currentState.ruleGenerated) {
                        resetRuleGenerationUI();
                    }
                }
            });
        });

        // Next/Back buttons navigation
        document.getElementById('next-to-headers').addEventListener('click', () => {
            navigateTo('headers-section');
        });

        document.getElementById('back-to-upload').addEventListener('click', () => {
            navigateTo('upload-section');
        });

        document.getElementById('next-to-generate').addEventListener('click', () => {
            navigateTo('generate-section');
        });

        document.getElementById('back-to-headers').addEventListener('click', () => {
            navigateTo('headers-section');
        });
    }

    function navigateTo(sectionId) {
        // Simulate click on the corresponding nav link
        const navLink = document.querySelector(`.nav-link[data-target="${sectionId}"]`);
        navLink.click();
    }

    // -----------------------------------------------------
    // File Upload Functions
    // -----------------------------------------------------
    function setupFileUpload() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');

        // Click on dropzone to open file browser
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                uploadFiles(files);
            }
        });

        // Handle drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('bg-indigo-50', 'border-indigo-300');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('bg-indigo-50', 'border-indigo-300');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('bg-indigo-50', 'border-indigo-300');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFiles(files);
            }
        });
    }

    function uploadFiles(files) {
        // Filter for .eml files
        const validFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.eml'));

        // Show alert if invalid files were selected
        if (validFiles.length !== files.length) {
            alert('Only .eml files are supported. Some files were skipped.');
        }

        // Clear existing upload items to prevent duplicates
        const fileListEl = document.getElementById('file-list');
        const existingUploadItems = fileListEl.querySelectorAll('.uploading-item');
        existingUploadItems.forEach(item => item.remove());

        // Track upload completion
        let completedUploads = 0;
        const totalUploads = validFiles.length;

        // Upload each valid file
        validFiles.forEach(file => {
            const formData = new FormData();
            formData.append('file', file);

            // Show loading indicator
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-3 border rounded uploading-item';
            fileItem.setAttribute('data-filename', file.name);
            fileItem.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-file-alt text-indigo-500 mr-2"></i>
                    <span>${file.name}</span>
                </div>
                <div>
                    <span class="text-yellow-500"><i class="fas fa-spinner fa-spin"></i> Uploading...</span>
                </div>
            `;
            fileListEl.appendChild(fileItem);

            // Upload the file
            fetch('/api/email-files/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(`HTTP error! Status: ${response.status}, Response: ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    // Remove the temporary upload item
                    const uploadItem = document.querySelector(`.uploading-item[data-filename="${file.name}"]`);
                    if (uploadItem) {
                        uploadItem.remove();
                    }

                    // Count completed upload
                    completedUploads++;

                    // Only reload file list once all uploads are complete
                    if (completedUploads === totalUploads) {
                        // Reload all files from server
                        loadEmailFiles(true);
                    }

                    // Enable next button if files are uploaded
                    document.getElementById('next-to-headers').disabled = false;
                })
                .catch(error => {
                    console.error('Error uploading file:', error);

                    // Update the temporary item with error state
                    const uploadItem = document.querySelector(`.uploading-item[data-filename="${file.name}"]`);
                    if (uploadItem) {
                        uploadItem.classList.remove('uploading-item');
                        uploadItem.innerHTML = `
                            <div class="flex items-center">
                                <i class="fas fa-file-alt text-red-500 mr-2"></i>
                                <span>${file.name}</span>
                            </div>
                            <div>
                                <span class="text-red-500"><i class="fas fa-exclamation-circle"></i> Upload failed</span>
                            </div>
                        `;
                    }

                    // Count completed upload even if it failed
                    completedUploads++;

                    // Check if all uploads are complete
                    if (completedUploads === totalUploads) {
                        loadEmailFiles(true);
                    }
                });
        });

        // Clear the file input to ensure change event will fire again for the same files
        document.getElementById('file-input').value = '';
    }

    function loadEmailFiles(checkStateChange = false) {
        // Clear file list - but keep any uploading items
        const fileListEl = document.getElementById('file-list');
        const uploadingItems = Array.from(fileListEl.querySelectorAll('.uploading-item'));
        fileListEl.innerHTML = '';

        // Put back any uploading items
        uploadingItems.forEach(item => fileListEl.appendChild(item));

        // Fetch email files
        fetch('/api/email-files/')
            .then(response => response.json())
            .then(data => {
                // Enable next button if files are uploaded
                document.getElementById('next-to-headers').disabled = data.length === 0;

                // Update state tracking if needed
                if (checkStateChange) {
                    updateFileState(data);
                } else {
                    // Just update the state without resetting
                    currentState.fileIds = data.map(file => file.id);
                }

                // Add file items to list
                data.forEach(file => {
                    // Skip if we already have an uploading item for this file
                    if (document.querySelector(`.uploading-item[data-filename="${file.original_filename}"]`)) {
                        return;
                    }

                    const fileItem = document.createElement('div');
                    fileItem.className = 'flex items-center justify-between p-3 border rounded';
                    fileItem.innerHTML = `
                        <div class="flex items-center">
                            <i class="fas fa-file-alt text-indigo-500 mr-2"></i>
                            <span>${file.original_filename}</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-green-500 mr-2"><i class="fas fa-check-circle"></i> Uploaded</span>
                            <button class="delete-file text-red-500 hover:text-red-700" data-id="${file.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                    fileListEl.appendChild(fileItem);

                    // Add event listener for delete button
                    fileItem.querySelector('.delete-file').addEventListener('click', function () {
                        deleteEmailFile(this.getAttribute('data-id'));
                    });
                });
            })
            .catch(error => {
                console.error('Error loading email files:', error);
                fileListEl.innerHTML = '<div class="text-center text-red-500 py-4">Error loading files</div>';
            });
    }

    function deleteEmailFile(id) {
        if (confirm('Are you sure you want to delete this file?')) {
            fetch(`/api/email-files/${id}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken
                }
            })
                .then(response => {
                    if (response.ok) {
                        // Reload email files and check for state changes
                        loadEmailFiles(true);
                    } else {
                        alert('Failed to delete file');
                    }
                })
                .catch(error => {
                    console.error('Error deleting file:', error);
                    alert('Failed to delete file');
                });
        }
    }

    // -----------------------------------------------------
    // Headers Selection Functions
    // -----------------------------------------------------
    function setupHeadersSelection() {
        const selectAllCheckbox = document.getElementById('select-all-headers');

        // Handle select all checkbox
        selectAllCheckbox.addEventListener('change', () => {
            const headerCheckboxes = document.querySelectorAll('#headers-list input[type="checkbox"]');
            headerCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });

            // Enable/disable next button
            updateNextToGenerateButton();

            // Update tracking state
            const selectedHeaders = getSelectedHeaders();
            updateHeaderState(selectedHeaders);
        });

        // Initialize headers list event delegation
        document.getElementById('headers-list').addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateNextToGenerateButton();

                // Update select all checkbox state
                const headerCheckboxes = document.querySelectorAll('#headers-list input[type="checkbox"]');
                const allChecked = Array.from(headerCheckboxes).every(checkbox => checkbox.checked);
                const noneChecked = Array.from(headerCheckboxes).every(checkbox => !checkbox.checked);

                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = !allChecked && !noneChecked;

                // Update tracking state
                const selectedHeaders = getSelectedHeaders();
                updateHeaderState(selectedHeaders);
            }
        });
    }

    function loadAvailableHeaders() {
        // Clear headers list
        const headersListEl = document.getElementById('headers-list');
        headersListEl.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i> Loading headers...</div>';

        // Fetch available headers
        fetch('/api/email-files/available_headers/')
            .then(response => response.json())
            .then(data => {
                headersListEl.innerHTML = '';

                // Add header items to list
                Object.entries(data).forEach(([key, value]) => {
                    const headerItem = document.createElement('div');
                    headerItem.className = 'flex items-start space-x-2 p-1';
                    headerItem.innerHTML = `
                        <input type="checkbox" id="header-${key}" class="mt-1 rounded text-indigo-600" value="${key}">
                        <div>
                            <label for="header-${key}" class="font-medium cursor-pointer">${key}</label>
                            <div class="text-sm text-gray-500">${value}</div>
                        </div>
                    `;
                    headersListEl.appendChild(headerItem);
                });

                // Restore checked state for previously selected headers
                currentState.selectedHeaders.forEach(header => {
                    const checkbox = document.querySelector(`#header-${header}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });

                // Enable/disable next button
                updateNextToGenerateButton();
            })
            .catch(error => {
                console.error('Error loading available headers:', error);
                headersListEl.innerHTML = '<div class="text-center py-4 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i> Failed to load headers</div>';
            });
    }

    function updateNextToGenerateButton() {
        const headerCheckboxes = document.querySelectorAll('#headers-list input[type="checkbox"]:checked');
        document.getElementById('next-to-generate').disabled = headerCheckboxes.length === 0;
    }

    function getSelectedHeaders() {
        const headerCheckboxes = document.querySelectorAll('#headers-list input[type="checkbox"]:checked');
        return Array.from(headerCheckboxes).map(checkbox => checkbox.value);
    }

    // -----------------------------------------------------
    // Module Selection Functions
    // -----------------------------------------------------
    function setupModuleSelection() {
        // Initialize modules list event delegation
        document.getElementById('modules-list').addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                // Update tracking state
                const selectedModules = getSelectedModules();
                updateModuleState(selectedModules);
            }
        });

        // Setup search functionality
        const searchInput = document.getElementById('module-search');
        if (searchInput) {
            // Clear search when navigating to the section
            searchInput.value = '';

            // Add input event listener
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                filterModules(searchTerm);
            });
        }
    }

    function filterModules(searchTerm) {
        const moduleItems = document.querySelectorAll('#modules-list .module-item');
        let visibleCount = 0;

        moduleItems.forEach(item => {
            const moduleName = item.querySelector('.module-name').textContent.toLowerCase();

            if (searchTerm === '' || moduleName.includes(searchTerm)) {
                item.classList.remove('hidden');
                visibleCount++;
            } else {
                item.classList.add('hidden');
            }
        });

        // Show/hide "no results" message
        const noModulesFound = document.getElementById('no-modules-found');
        if (noModulesFound) {
            if (visibleCount === 0 && searchTerm !== '') {
                noModulesFound.classList.remove('hidden');
            } else {
                noModulesFound.classList.add('hidden');
            }
        }
    }

    function loadAvailableModules() {
        // Show loading indicator
        document.getElementById('modules-loading').classList.remove('hidden');
        document.getElementById('modules-list').innerHTML = '';

        // Hide "no results" message
        const noModulesFound = document.getElementById('no-modules-found');
        if (noModulesFound) {
            noModulesFound.classList.add('hidden');
        }

        // Clear search input
        const searchInput = document.getElementById('module-search');
        if (searchInput) {
            searchInput.value = '';
        }

        // Fetch available modules
        fetch('/api/prompt-templates/modules/')
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                document.getElementById('modules-loading').classList.add('hidden');
                const modulesListEl = document.getElementById('modules-list');
                modulesListEl.innerHTML = '';

                if (data.length === 0) {
                    modulesListEl.innerHTML = '<p class="text-gray-500">No prompt modules available</p>';
                    return;
                }

                // Add module items to list
                data.forEach(module => {
                    const moduleItem = document.createElement('div');
                    moduleItem.className = 'module-item flex items-start space-x-2 p-2 border border-gray-200 rounded mb-2';
                    moduleItem.innerHTML = `
                        <input type="checkbox" id="module-${module.module_type}" class="mt-1 rounded text-indigo-600" 
                               value="${module.module_type}" ${currentState.selectedModules.includes(module.module_type) ? 'checked' : ''}>
                        <div class="flex-1">
                            <label for="module-${module.module_type}" class="module-name font-medium cursor-pointer">${module.name}</label>
                            <div class="text-sm text-gray-500">${module.description}</div>
                        </div>
                    `;
                    modulesListEl.appendChild(moduleItem);
                });

                // Apply any existing search filter
                const searchInput = document.getElementById('module-search');
                if (searchInput && searchInput.value) {
                    filterModules(searchInput.value.toLowerCase().trim());
                }

                // Trigger update if there were previously selected modules
                if (currentState.selectedModules.length > 0) {
                    // Restore checked state
                    currentState.selectedModules.forEach(moduleType => {
                        const checkbox = document.querySelector(`#module-${moduleType}`);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error loading available modules:', error);
                document.getElementById('modules-loading').classList.add('hidden');
                document.getElementById('modules-list').innerHTML =
                    '<div class="text-center py-4 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i> Failed to load modules</div>';
            });
    }

    function getSelectedModules() {
        const moduleCheckboxes = document.querySelectorAll('#modules-list input[type="checkbox"]:checked');
        return Array.from(moduleCheckboxes).map(checkbox => checkbox.value);
    }

    // -----------------------------------------------------
    // Prompt Handling Functions
    // -----------------------------------------------------
    function setupPromptEditor() {
        console.log("Setting up prompt editor");
        const togglePromptEditor = document.getElementById('toggle-prompt-editor');
        const promptPreview = document.getElementById('prompt-preview');
        const promptEditContainer = document.getElementById('prompt-edit-container');
        const promptEditor = document.getElementById('prompt-editor');
        const resetPromptBtn = document.getElementById('reset-prompt');
        const savePromptBtn = document.getElementById('save-prompt');
        const togglePromptText = document.getElementById('toggle-prompt-text');

        console.log("Elements found:", {
            togglePromptEditor, promptPreview, promptEditContainer,
            promptEditor, resetPromptBtn, savePromptBtn, togglePromptText
        });

        let defaultPrompt = ''; // Store the default prompt

        // Toggle prompt editor
        togglePromptEditor.addEventListener('click', () => {
            const isHidden = promptEditContainer.classList.contains('hidden');

            if (isHidden) {
                // Show editor
                promptEditContainer.classList.remove('hidden');
                togglePromptText.textContent = 'Hide Editor';
            } else {
                // Hide editor
                promptEditContainer.classList.add('hidden');
                togglePromptText.textContent = 'Edit Prompt';
            }
        });

        // Reset prompt to default
        resetPromptBtn.addEventListener('click', () => {
            promptEditor.value = defaultPrompt;
            updatePromptPreview(defaultPrompt);
        });

        // Save prompt changes
        savePromptBtn.addEventListener('click', () => {
            const updatedPrompt = promptEditor.value;
            updatePromptPreview(updatedPrompt);

            // Hide editor after saving
            promptEditContainer.classList.add('hidden');
            togglePromptText.textContent = 'Edit Prompt';
        });

        // Update preview when prompt changes
        promptEditor.addEventListener('input', () => {
            updatePromptPreview(promptEditor.value);
        });

        // Function to load default prompt based on selected files and headers
        function loadDefaultPrompt() {
            const emailFileIds = currentState.fileIds;
            const selectedHeaders = currentState.selectedHeaders;
            const selectedModules = currentState.selectedModules;

            console.log("Loading default prompt with:", { emailFileIds, selectedHeaders, selectedModules });

            if (emailFileIds.length === 0 || selectedHeaders.length === 0) {
                console.log("Cannot load prompt - missing file IDs or headers");
                return;
            }

            // Show loading indicator
            updatePromptPreview('Loading default prompt...');

            // Fetch default prompt
            fetch('/api/rule-generations/generate_default_prompt/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    email_file_ids: emailFileIds,
                    selected_headers: selectedHeaders,
                    prompt_modules: selectedModules
                })
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.prompt) {
                        // Store and display the default prompt
                        defaultPrompt = data.prompt;
                        promptEditor.value = defaultPrompt;
                        updatePromptPreview(defaultPrompt);
                        console.log("Default prompt loaded successfully");
                    } else {
                        console.error("No prompt in response:", data);
                        updatePromptPreview('Error: No prompt received from server');
                    }
                })
                .catch(error => {
                    console.error('Error loading default prompt:', error);
                    updatePromptPreview('Error loading default prompt: ' + error.message);
                });
        }

        // Function to update prompt preview
        function updatePromptPreview(text) {
            const previewContent = promptPreview.querySelector('pre');
            if (previewContent) {
                previewContent.textContent = text;
            } else {
                console.error("Cannot find preview element");
            }
        }

        // Export the loadDefaultPrompt function
        return {
            loadDefaultPrompt,
            getCustomPrompt: () => {
                const editor = document.getElementById('prompt-editor');
                if (!editor) {
                    console.error("Cannot find prompt editor element");
                    return "";
                }
                return editor.value || "";
            }
        };
    }

    // -----------------------------------------------------
    // Rule Generation Functions
    // -----------------------------------------------------
    function setupRuleGeneration() {
        // Make sure we have fresh event listeners
        const generateButton = document.getElementById('generate-rules');
        const newGenerateButton = generateButton.cloneNode(true);
        generateButton.parentNode.replaceChild(newGenerateButton, generateButton);

        document.getElementById('generate-rules').addEventListener('click', function (e) {
            e.preventDefault();
            console.log("Generate rules button clicked");
            generateRules();
        });

        // Handle copy to clipboard button for the full rule
        const copyButton = document.getElementById('copy-rule');
        const newCopyButton = copyButton.cloneNode(true);
        copyButton.parentNode.replaceChild(newCopyButton, copyButton);

        document.getElementById('copy-rule').addEventListener('click', function (e) {
            e.preventDefault();
            const ruleOutput = document.getElementById('rule-output').textContent;
            navigator.clipboard.writeText(ruleOutput)
                .then(() => {
                    const copyBtn = document.getElementById('copy-rule');
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy to Clipboard';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy rule:', err);
                    alert('Failed to copy rule');
                });
        });
    }

    function updateSelectedSummary() {
        // Update selected files list
        fetch('/api/email-files/')
            .then(response => response.json())
            .then(data => {
                const selectedFilesListEl = document.getElementById('selected-files-list');
                selectedFilesListEl.innerHTML = '';

                if (data.length === 0) {
                    selectedFilesListEl.innerHTML = '<li class="text-gray-500">No files uploaded</li>';
                } else {
                    data.forEach(file => {
                        const fileItem = document.createElement('li');
                        fileItem.textContent = file.original_filename;
                        selectedFilesListEl.appendChild(fileItem);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading selected files:', error);
                const selectedFilesListEl = document.getElementById('selected-files-list');
                selectedFilesListEl.innerHTML = '<li class="text-red-500">Error loading files</li>';
            });

        // Update selected headers list
        const selectedHeadersListEl = document.getElementById('selected-headers-list');
        selectedHeadersListEl.innerHTML = '';

        const selectedHeaders = currentState.selectedHeaders;
        if (selectedHeaders.length === 0) {
            selectedHeadersListEl.innerHTML = '<li class="text-gray-500">No headers selected</li>';
        } else {
            selectedHeaders.forEach(header => {
                const headerItem = document.createElement('li');
                headerItem.textContent = header;
                selectedHeadersListEl.appendChild(headerItem);
            });
        }
    }

    function generateRules() {
        // Get selected headers and modules
        const selectedHeaders = getSelectedHeaders();
        const selectedModules = getSelectedModules();

        // Update state tracking
        updateHeaderState(selectedHeaders);
        updateModuleState(selectedModules);

        // Fetch email files to get their IDs
        fetch('/api/email-files/')
            .then(response => response.json())
            .then(data => {
                const emailFileIds = data.map(file => file.id);

                // Update state tracking
                updateFileState(data);

                if (emailFileIds.length === 0) {
                    alert("No email files available. Please upload files first.");
                    return;
                }

                if (selectedHeaders.length === 0) {
                    alert("No headers selected. Please select at least one header to analyze.");
                    return;
                }

                // Show loading indicator
                document.getElementById('generation-status').classList.remove('hidden');
                document.getElementById('generation-result').classList.add('hidden');
                document.getElementById('generate-rules').disabled = true;

                // Prepare request data
                const requestData = {
                    email_file_ids: emailFileIds,
                    selected_headers: selectedHeaders,
                    prompt_modules: selectedModules
                };

                // Get custom prompt if available
                const customPrompt = promptHandler.getCustomPrompt();
                if (customPrompt && customPrompt.trim() !== '') {
                    requestData.custom_prompt = customPrompt;
                }

                console.log("Sending rule generation request:", requestData);

                // Generate rules
                fetch('/api/rule-generations/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify(requestData)
                })
                    .then(response => {
                        if (!response.ok) {
                            return response.text().then(text => {
                                throw new Error(`HTTP error! Status: ${response.status}, Response: ${text}`);
                            });
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Rule generation initiated, ID:", data.id);
                        currentState.currentRuleId = data.id;
                        // Poll for rule generation status
                        pollRuleGenerationStatus(data.id);
                    })
                    .catch(error => {
                        console.error('Error generating rules:', error);
                        document.getElementById('generation-status').classList.add('hidden');
                        document.getElementById('generate-rules').disabled = false;
                        alert('Failed to generate rules: ' + error.message);
                    });
            })
            .catch(error => {
                console.error('Error loading email files:', error);
                alert('Failed to load email files');
                document.getElementById('generate-rules').disabled = false;
            });
    }

    function renderMarkdown(markdownText) {
        const markdownOutput = document.getElementById('markdown-output');

        // Parse the markdown content
        const htmlContent = marked.parse(markdownText);
        markdownOutput.innerHTML = htmlContent;

        // Find all code blocks and add copy buttons
        const codeBlocks = markdownOutput.querySelectorAll('pre');
        codeBlocks.forEach((codeBlock, index) => {
            // Wrap code block in a container
            const container = document.createElement('div');
            container.className = 'code-block-container';

            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'code-copy-button';
            copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyButton.setAttribute('data-index', index);
            copyButton.addEventListener('click', (e) => {
                e.preventDefault();
                const code = codeBlock.textContent;
                navigator.clipboard.writeText(code)
                    .then(() => {
                        // Change button text temporarily
                        copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy code:', err);
                        alert('Failed to copy code');
                    });
            });

            // Replace the code block with our container
            codeBlock.parentNode.insertBefore(container, codeBlock);
            container.appendChild(codeBlock);
            container.appendChild(copyButton);
        });

        // Apply syntax highlighting
        if (window.hljs) {
            codeBlocks.forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    function pollRuleGenerationStatus(id) {
        console.log("Polling rule generation status for ID:", id);
        // Poll for rule generation status
        const interval = setInterval(() => {
            fetch(`/api/rule-generations/${id}/status/`)
                .then(response => response.json())
                .then(data => {
                    if (data.is_complete) {
                        console.log("Rule generation complete");
                        clearInterval(interval);

                        // Hide loading indicator
                        document.getElementById('generation-status').classList.add('hidden');
                        document.getElementById('generate-rules').disabled = false;

                        // Show result
                        document.getElementById('generation-result').classList.remove('hidden');

                        // Store the plain text version
                        document.getElementById('rule-output').textContent = data.rule;

                        // Render as markdown
                        renderMarkdown(data.rule);

                        // Update state to indicate rule has been generated
                        currentState.ruleGenerated = true;
                    } else {
                        console.log("Rule generation in progress...");
                    }
                })
                .catch(error => {
                    console.error('Error polling rule generation status:', error);
                    clearInterval(interval);

                    // Hide loading indicator
                    document.getElementById('generation-status').classList.add('hidden');
                    document.getElementById('generate-rules').disabled = false;

                    alert('Failed to check rule generation status');
                });
        }, 2000); // Poll every 2 seconds
    }

    // -----------------------------------------------------
    // History Functions
    // -----------------------------------------------------
    function setupHistory() {
        // Initialize history list with event delegation
        const historyList = document.getElementById('history-list');

        // Remove any existing event listeners to prevent duplicates
        const newHistoryList = historyList.cloneNode(true);
        historyList.parentNode.replaceChild(newHistoryList, historyList);

        document.getElementById('history-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('view-rule') || e.target.closest('.view-rule')) {
                e.preventDefault();
                const id = e.target.closest('.view-rule').getAttribute('data-id');
                viewRuleGeneration(id);
            }
        });
    }

    function loadRuleGenerationHistory() {
        // Clear history list
        const historyListEl = document.getElementById('history-list');
        historyListEl.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center">
                    <i class="fas fa-spinner fa-spin mr-2"></i> Loading history...
                </td>
            </tr>
        `;

        // Fetch rule generation history
        fetch('/api/rule-generations/')
            .then(response => response.json())
            .then(data => {
                historyListEl.innerHTML = '';

                if (data.length === 0) {
                    historyListEl.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                                No rule generation history found
                            </td>
                        </tr>
                    `;
                    return;
                }

                // Add history items to list - sort by newest first
                data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(item => {
                    const date = new Date(item.created_at);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

                    const historyItem = document.createElement('tr');
                    historyItem.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">${item.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${formattedDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${item.email_files.length} files</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${item.is_complete ?
                            '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Complete</span>' :
                            '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Processing</span>'
                        }
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <button class="view-rule text-indigo-600 hover:text-indigo-900" data-id="${item.id}">
                                <i class="fas fa-eye mr-1"></i> View
                            </button>
                        </td>
                    `;
                    historyListEl.appendChild(historyItem);
                });
            })
            .catch(error => {
                console.error('Error loading rule generation history:', error);
                historyListEl.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-4 text-center text-red-500">
                            <i class="fas fa-exclamation-circle mr-2"></i> Failed to load history
                        </td>
                    </tr>
                `;
            });
    }

    function viewRuleGeneration(id) {
        // Don't reset if viewing the current rule
        const preserveState = (id === currentState.currentRuleId && currentState.ruleGenerated);

        // Fetch rule generation details
        fetch(`/api/rule-generations/${id}/`)
            .then(response => response.json())
            .then(data => {
                // Navigate to generate section
                navigateTo('generate-section');

                // Update the current rule ID
                currentState.currentRuleId = id;

                if (data.is_complete) {
                    currentState.ruleGenerated = true;
                }

                // Update selected files list
                const selectedFilesListEl = document.getElementById('selected-files-list');
                selectedFilesListEl.innerHTML = '';

                data.email_files.forEach(file => {
                    const fileItem = document.createElement('li');
                    fileItem.textContent = file.original_filename;
                    selectedFilesListEl.appendChild(fileItem);
                });

                // Update selected headers list
                const selectedHeadersListEl = document.getElementById('selected-headers-list');
                selectedHeadersListEl.innerHTML = '';

                data.selected_headers.forEach(header => {
                    const headerItem = document.createElement('li');
                    headerItem.textContent = header;
                    selectedHeadersListEl.appendChild(headerItem);
                });

                // Update selected modules list (if available)
                if (data.prompt_modules && Array.isArray(data.prompt_modules)) {
                    currentState.selectedModules = data.prompt_modules;

                    // Check corresponding checkboxes once modules are loaded
                    const checkboxInterval = setInterval(() => {
                        const moduleCheckboxes = document.querySelectorAll('#modules-list input[type="checkbox"]');
                        if (moduleCheckboxes.length > 0) {
                            clearInterval(checkboxInterval);

                            // Clear all checkboxes first
                            moduleCheckboxes.forEach(checkbox => {
                                checkbox.checked = false;
                            });

                            // Check the ones in the selected modules
                            data.prompt_modules.forEach(moduleType => {
                                const checkbox = document.querySelector(`#module-${moduleType}`);
                                if (checkbox) {
                                    checkbox.checked = true;
                                }
                            });
                        }
                    }, 100); // Check every 100ms until modules are loaded
                }

                // Update state tracking with the viewed rule's data
                currentState.fileIds = data.email_files.map(file => file.id);
                currentState.selectedHeaders = data.selected_headers;

                // Update UI based on rule status
                document.getElementById('generation-status').classList.add('hidden');
                document.getElementById('generate-rules').disabled = false;

                if (data.is_complete) {
                    document.getElementById('generation-result').classList.remove('hidden');
                    document.getElementById('rule-output').textContent = data.rule;

                    // Render as markdown
                    renderMarkdown(data.rule);

                    // Update prompt preview if available
                    if (data.prompt) {
                        const promptEditor = document.getElementById('prompt-editor');
                        if (promptEditor) {
                            promptEditor.value = data.prompt;
                            const previewContent = document.querySelector('#prompt-preview pre');
                            if (previewContent) {
                                previewContent.textContent = data.prompt;
                            }
                        }
                    }
                } else {
                    document.getElementById('generation-status').classList.remove('hidden');
                    document.getElementById('generation-result').classList.add('hidden');
                    // If not complete, start polling
                    pollRuleGenerationStatus(id);
                }
            })
            .catch(error => {
                console.error('Error loading rule generation details:', error);
                alert('Failed to load rule generation details');
            });
    }

    // -----------------------------------------------------
    // Utility Functions
    // -----------------------------------------------------
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
