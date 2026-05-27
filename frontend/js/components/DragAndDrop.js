// ==========================================
// DRAG & DROP FILE INGESTION COMPONENT
// ==========================================

/**
 * Registers drag-and-drop and manual file selector event handlers.
 * Prevents browser defaults at the window level to avoid navigating away when dropping.
 * 
 * @param {Object} elements - Mapped dashboard DOM elements
 * @param {Function} onFileDropped - Callback executing file processing pipeline
 */
export function setupDragAndDrop(elements, onFileDropped) {
  elements.dropZone.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragOver);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleFileDrop);

  // Prevent default drag and drop behaviors on window level to avoid navigating away
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    elements.dropZone.classList.add("drag-over");
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    elements.dropZone.classList.add("drag-over");
  }

  function handleDragLeave(event) {
    event.stopPropagation();
    elements.dropZone.classList.remove("drag-over");
  }

  function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    elements.dropZone.classList.remove("drag-over");

    if (!event.dataTransfer) return;

    let file = null;
    if (event.dataTransfer.items) {
      const item = event.dataTransfer.items[0];
      if (item && item.kind === 'file') {
        file = item.getAsFile();
      }
    }

    if (!file && event.dataTransfer.files) {
      file = event.dataTransfer.files[0];
    }

    if (file) {
      onFileDropped(file);
    }
  }
}
