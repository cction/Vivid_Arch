efactor App.tsx to Modularize Functionality
Goal Description
The goal is to refactor the massive 
App.tsx
 file into smaller, manageable modules. This will improve code maintainability, readability, and testability while ensuring the application remains fully functional. We will extract logic into custom hooks and UI components.

User Review Required
IMPORTANT

This is a significant refactoring. While functionality should remain the same, the file structure will change drastically.

Proposed Changes
New Hooks (src/hooks)
[NEW] useCanvasInteraction.ts
Purpose: Handle mouse events on the canvas (pan, draw, resize, move).
State: interactionMode, dragStart, currentMousePos, isDragging.
Exports: handleMouseDown, handleMouseMove, handleMouseUp, cursor.
[NEW] useSelection.ts
Purpose: Handle element selection, multi-selection, and group/ungroup logic.
State: selectedElementIds.
Exports: selectedElementIds, setSelectedElementIds, handleGroup, handleUngroup, handleAlignSelection, getSelectionBounds.
[NEW] useBoardManager.ts
Purpose: Manage boards (create, delete, duplicate, switch).
State: boards, activeBoardId.
Exports: boards, activeBoard, handleAddBoard, handleDeleteBoard, handleDuplicateBoard, handleRenameBoard, handleSwitchBoard.
[NEW] useClipboard.ts
Purpose: Handle copy, paste, and delete operations.
Exports: handleCopy, handlePaste, handleDelete.
[NEW] useKeyboardShortcuts.ts
Purpose: Handle global keyboard shortcuts (Undo, Redo, Delete, Copy, Paste, Tools).
Exports: useKeyboardShortcuts (hook that attaches event listeners).
New Components (src/components/canvas)
[NEW] Canvas.tsx
Purpose: The main SVG container.
Props: elements, panOffset, zoom, onMouseDown, onMouseMove, onMouseUp.
[NEW] SelectionOverlay.tsx
Purpose: Render selection bounding boxes and resize handles.
Props: selectedElements, zoom, onResizeStart.
[NEW] ContextToolbar.tsx
Purpose: Floating toolbar for selected elements.
Props: selectedElements, onAction.
Modified Files
[MODIFY] src/App.tsx
Changes:
Remove extracted logic.
Import and use new hooks.
Render new components.
Act as the main orchestrator / layout container.
Verification Plan
Automated Tests
Since there are no existing tests, we will rely on manual verification.
Manual Verification
Basic Drawing: Verify all tools (rectangle, circle, line, arrow, pencil) still work.
Selection: Verify clicking to select, drag selection box, and shift-click works.
Manipulation: Verify moving, resizing, and rotating (if applicable) elements.
Board Management: Create new board, switch boards, delete board.
Shortcuts: Test Ctrl+Z (Undo), Ctrl+Y (Redo), Delete, Ctrl+C/V.
Zoom/Pan: Verify zooming with wheel and panning with spacebar/middle mouse.