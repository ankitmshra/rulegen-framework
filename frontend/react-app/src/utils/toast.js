/**
 * Toast notification utility
 * 
 * Simple implementation that adds toast notifications to the DOM
 * Can be replaced with a more robust library like react-toastify if needed
 */

let toastContainer = null;
let toastIdCounter = 0;

/**
 * Initialize the toast container
 */
const initializeContainer = () => {
  if (toastContainer) return;
  
  // Create container if it doesn't exist
  toastContainer = document.createElement('div');
  toastContainer.className = 'fixed top-0 right-0 p-4 z-50 flex flex-col items-end space-y-2';
  document.body.appendChild(toastContainer);
};

/**
 * Create a toast notification
 * 
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 * @param {number} duration - How long to display the toast in ms
 * @returns {number} - The ID of the toast (can be used to dismiss it)
 */
const createToast = (message, type = 'info', duration = 3000) => {
  initializeContainer();
  
  const toastId = toastIdCounter++;
  const toast = document.createElement('div');
  
  // Set appropriate color classes based on type
  const typeClasses = {
    success: 'bg-green-50 border-green-500 text-green-800',
    error: 'bg-red-50 border-red-500 text-red-800',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
  };
  
  const colorClass = typeClasses[type] || typeClasses.info;
  
  // Set the toast content and style
  toast.className = `border-l-4 p-4 rounded shadow-md ${colorClass} transform transition-all duration-300 ease-in-out opacity-0 translate-x-4 max-w-sm`;
  toast.innerHTML = `
    <div class="flex justify-between items-start">
      <p class="text-sm">${message}</p>
      <button class="ml-4 text-gray-400 hover:text-gray-600 focus:outline-none" aria-label="Close">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Add click listener to close button
  const closeButton = toast.querySelector('button');
  closeButton.addEventListener('click', () => {
    dismissToast(toastId);
  });
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-x-4');
  }, 10);
  
  // Set timeout to remove the toast
  const timeoutId = setTimeout(() => {
    dismissToast(toastId);
  }, duration);
  
  // Store the toast data
  toast.dataset.id = toastId;
  toast.dataset.timeoutId = timeoutId;
  
  return toastId;
};

/**
 * Dismiss a toast by ID
 * 
 * @param {number} id - The ID of the toast to dismiss
 */
const dismissToast = (id) => {
  if (!toastContainer) return;
  
  const toast = toastContainer.querySelector(`[data-id="${id}"]`);
  if (!toast) return;
  
  // Clear the timeout
  clearTimeout(Number(toast.dataset.timeoutId));
  
  // Animate out
  toast.classList.add('opacity-0', 'translate-x-4');
  
  // Remove after animation
  setTimeout(() => {
    if (toast.parentNode === toastContainer) {
      toastContainer.removeChild(toast);
    }
    
    // If container is empty, remove it
    if (toastContainer.children.length === 0) {
      document.body.removeChild(toastContainer);
      toastContainer = null;
    }
  }, 300);
};

/**
 * Shorthand for success toast
 */
const success = (message, duration) => createToast(message, 'success', duration);

/**
 * Shorthand for error toast
 */
const error = (message, duration) => createToast(message, 'error', duration);

/**
 * Shorthand for warning toast
 */
const warning = (message, duration) => createToast(message, 'warning', duration);

/**
 * Shorthand for info toast
 */
const info = (message, duration) => createToast(message, 'info', duration);

export default {
  show: createToast,
  dismiss: dismissToast,
  success,
  error,
  warning,
  info,
};
