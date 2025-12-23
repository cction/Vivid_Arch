
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useBoardActions } from '@/hooks/useBoardActions';
import { useClipboard } from '@/hooks/useClipboard';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useSelection } from '@/hooks/useSelection';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useBoardManager } from '@/hooks/useBoardManager';
import { useTextEditing } from '@/hooks/useTextEditing';
import { PromptBar } from '@/features/prompt/PromptBar';
import { Loader } from '@/ui/Loader';
import { CanvasSettings } from '@/features/settings/CanvasSettings';
import { LayerPanel } from '@/features/boards/LayerPanel';
import { BoardPanel } from '@/features/boards/BoardPanel';
import { Canvas } from '@/components/Canvas';
import { ContextMenuOverlay } from '@/components/ContextMenuOverlay';
import { ErrorToast } from '@/ui/ErrorToast';
import type { Tool, Point, Element, ImageElement, ShapeElement, TextElement, ArrowElement, LineElement, WheelAction, GroupElement, Board, VideoElement } from '@/types';
import { useLayerMerge } from '@/hooks/useLayerMerge';
import { useCrop } from '@/hooks/useCrop';
import { useContextMenuActions } from '@/hooks/useContextMenuActions';
import { useLayerPanel } from '@/hooks/useLayerPanel';
import { useDragImport } from '@/hooks/useDragImport';
import { useUserEffects } from '@/hooks/useUserEffects';
import { useGenerationPipeline } from '@/hooks/useGenerationPipeline';
import { useI18n } from '@/hooks/useI18n';
import { useUiTheme } from '@/hooks/useUiTheme';
import { useCredentials } from '@/hooks/useCredentials';
import { useElementOps } from '@/hooks/useElementOps';
import { useCanvasCoords } from '@/hooks/useCanvasCoords';
import { PodUIPreview } from '@/components/PodUIPreview';
import { PodButton } from '@/components/podui';
import { getElementBounds } from '@/utils/canvas';
import { BottomBar } from '@/features/bottombar/BottomBar';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// unified to '@/utils/canvas' getElementBounds

type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };


 

const createNewBoard = (name: string): Board => {
    const id = generateId();
    return {
        id,
        name,
        elements: [],
        history: [[]],
        historyIndex: 0,
        panOffset: { x: 0, y: 0 },
        zoom: 1,
        canvasBackgroundColor: '#0F0D13', // matches var(--color-base-dark)
        updatedAt: Date.now(),
        // Note: Canvas context requires valid hex/color string, cannot use CSS var directly without resolution.
    };
};

const App: React.FC = () => {
    const [boards, setBoards] = useState<Board[]>(() => {
        const init = window.__BANANAPOD_INITIAL_BOARDS__
        if (init && Array.isArray(init) && init.length > 0) return init as Board[]
        return [createNewBoard('Board 1')]
    });
    const [activeBoardId, setActiveBoardId] = useState<string>(() => {
        const initId = window.__BANANAPOD_INITIAL_ACTIVE_BOARD_ID__
        if (initId && typeof initId === 'string') return initId
        return boards[0].id
    });

    const activeBoard = useMemo(() => boards.find(b => b.id === activeBoardId) || boards[0], [boards, activeBoardId]);

    const { elements, history, historyIndex, panOffset, zoom, canvasBackgroundColor: rawCanvasBackgroundColor } = activeBoard;

    const DEFAULT_CANVAS_BG = '#0F0D13';
    const isValidHexColor = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
    const canvasBackgroundColor = isValidHexColor(rawCanvasBackgroundColor) ? rawCanvasBackgroundColor : DEFAULT_CANVAS_BG;

    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [drawingOptions, setDrawingOptions] = useState({ strokeColor: '#ef4444', strokeWidth: 5 }); // matches --color-red-500
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
    const [isBoardPanelOpen, setIsBoardPanelOpen] = useState(false);
    const panRafRef = useRef<number | null>(null);
    const panLastPointRef = useRef<Point | null>(null);
    const wheelRafRef = useRef<number | null>(null);
    const wheelLastEventRef = useRef<{ clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null>(null);
    const [wheelAction, setWheelAction] = useState<WheelAction>('zoom');
    const [alignmentGuides, setAlignmentGuides] = useState<Guide[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string | null } | null>(null);
    // 初始化编辑逻辑在 useTextEditing（稍后基于 commitAction/setElements 注入）
    const [lassoPath, setLassoPath] = useState<Point[] | null>(null);
    const [showUIPreview, setShowUIPreview] = useState(false);

    const { language, setLanguage, t } = useI18n('ZH');
    const { apiKey, setApiKey, grsaiApiKey, setGrsaiApiKey } = useCredentials();

    const [apiProvider, setApiProvider] = useState<'WHATAI' | 'Grsai'>(() => {
        try { return (localStorage.getItem('API_PROVIDER') as 'WHATAI' | 'Grsai') || 'WHATAI' } catch { return 'WHATAI' }
    });
    useEffect(() => {
        try { localStorage.setItem('API_PROVIDER', apiProvider) } catch { void 0 }
    }, [apiProvider]);

    const getAllowedImageModels = (provider: 'WHATAI' | 'Grsai') => {
        return provider === 'Grsai' ? ['nano-banana-fast', 'nano-banana-pro'] : ['nano-banana', 'nano-banana-2'];
    };
    const normalizeImageModelForProvider = (provider: 'WHATAI' | 'Grsai', model: string | null | undefined) => {
        const allowed = getAllowedImageModels(provider);
        const v = model || '';
        return allowed.includes(v) ? v : allowed[0];
    };

    useEffect(() => {
        try {
            if (apiProvider === 'Grsai') {
                const m = localStorage.getItem('GRSAI_IMAGE_MODEL');
                setImageModel(normalizeImageModelForProvider('Grsai', m));
            } else {
                const m = localStorage.getItem('WHATAI_IMAGE_MODEL') || (process.env.WHATAI_IMAGE_MODEL as string);
                setImageModel(normalizeImageModelForProvider('WHATAI', m));
            }
        } catch { void 0 }
    }, [apiProvider])
    
    const [uiTheme, setUiTheme] = useState({ color: '#1E1E24', opacity: 0.7 }); // matches --color-base-solid
    const [buttonTheme, setButtonTheme] = useState({ color: '#374151', opacity: 0.8 });

    const { userEffects, addUserEffect, deleteUserEffect } = useUserEffects();

    const [generationMode, setGenerationMode] = useState<'image' | 'video'>('image');
    const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [imageAspectRatio, setImageAspectRatio] = useState<string>('auto');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [imageModel, setImageModel] = useState<string>(() => {
        try {
            const provider = (localStorage.getItem('API_PROVIDER') as 'WHATAI' | 'Grsai') || 'WHATAI'
            if (provider === 'Grsai') {
                const m = localStorage.getItem('GRSAI_IMAGE_MODEL');
                if (m === 'nano-banana-fast' || m === 'nano-banana-pro') return m;
                if (m === 'nano-banana') return 'nano-banana-fast';
                return 'nano-banana-fast';
            }
            const m = localStorage.getItem('WHATAI_IMAGE_MODEL') || (process.env.WHATAI_IMAGE_MODEL as string);
            return (m === 'nano-banana' || m === 'nano-banana-2') ? m : 'nano-banana';
        } catch {
            const m = (process.env.WHATAI_IMAGE_MODEL as string) || '';
            return (m === 'nano-banana' || m === 'nano-banana-2') ? m : 'nano-banana';
        }
    });
    const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>(() => {
        return '1K';
    });
    useEffect(() => {
        try {
            if (apiProvider === 'Grsai') localStorage.setItem('GRSAI_IMAGE_MODEL', imageModel);
            else localStorage.setItem('WHATAI_IMAGE_MODEL', imageModel);
        } catch { void 0; }
    }, [imageModel, apiProvider]);
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (apiProvider === 'Grsai' && e.key === 'GRSAI_IMAGE_MODEL') {
                setImageModel(normalizeImageModelForProvider('Grsai', e.newValue || 'nano-banana-fast'));
            }
            if (apiProvider === 'WHATAI' && e.key === 'WHATAI_IMAGE_MODEL') {
                setImageModel(normalizeImageModelForProvider('WHATAI', e.newValue || 'nano-banana'));
            }
            if (e.key === 'API_PROVIDER') {
                setApiProvider(((e.newValue || 'WHATAI') as 'WHATAI' | 'Grsai'))
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [apiProvider]);
    useEffect(() => {
        const lower = (imageModel || '').toLowerCase();
        const supportsSize = lower === 'nano-banana-pro' || lower === 'nano-banana-2';
        if (!supportsSize) setImageSize('1K');
    }, [imageModel]);

    useEffect(() => {
        const prevent = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; try { const node = e.target instanceof Element ? e.target.nodeName : ''; console.log('[GlobalDND]', e.type, node); } catch { void 0; } };
        document.addEventListener('dragenter', prevent, { capture: true });
        document.addEventListener('dragover', prevent, { capture: true });
        document.addEventListener('dragleave', prevent, { capture: true });
        document.addEventListener('drop', prevent, { capture: true });
        window.addEventListener('dragover', prevent, { capture: true });
        window.addEventListener('drop', prevent, { capture: true });
        return () => {
            document.removeEventListener('dragenter', prevent, true);
            document.removeEventListener('dragover', prevent, true);
            document.removeEventListener('dragleave', prevent, true);
            document.removeEventListener('drop', prevent, true);
            window.removeEventListener('dragover', prevent, true);
            window.removeEventListener('drop', prevent, true);
        };
    }, []);

    const interactionMode = useRef<string | null>(null);
    const startPoint = useRef<Point>({ x: 0, y: 0 });
    const currentDrawingElementId = useRef<string | null>(null);
    const resizeStartInfo = useRef<{ originalElement: ImageElement | ShapeElement | TextElement | VideoElement; startCanvasPoint: Point; handle: string; shiftKey: boolean } | null>(null);
    const cropStartInfo = useRef<{ originalCropBox: Rect, startCanvasPoint: Point } | null>(null);
    const dragStartElementPositions = useRef<Map<string, { x: number, y: number } | Point[]>>(new Map());
    const elementsRef = useRef(elements);
    const svgRef = useRef<SVGSVGElement>(null);

    // editing refs are provided by useTextEditing
    const previousToolRef = useRef<Tool>('select');
    const spacebarDownTime = useRef<number | null>(null);
    const promptBarRef = useRef<HTMLDivElement>(null);
    elementsRef.current = elements;

    const setInteractionModeValue = (v: string | null) => { interactionMode.current = v; };
    const setStartPointValue = (p: Point) => { startPoint.current = p; };
    const setResizeStartInfoValue = (info: { originalElement: ImageElement | ShapeElement | TextElement | VideoElement; startCanvasPoint: Point; handle: string; shiftKey: boolean } | null) => { resizeStartInfo.current = info; };
    const setCropStartInfoValue = (info: { originalCropBox: Rect, startCanvasPoint: Point } | null) => { cropStartInfo.current = info; };
    const setCurrentDrawingElementIdValue = (id: string | null) => { currentDrawingElementId.current = id; };
    const setDragStartElementPositionsValue = (map: Map<string, { x: number, y: number } | Point[]>) => { dragStartElementPositions.current = map; };
    const clearDragStartElementPositionsValue = () => { dragStartElementPositions.current.clear(); };
    const setPanRafValue = (v: number | null) => { panRafRef.current = v; };
    const setPanLastPointValue = (p: Point | null) => { panLastPointRef.current = p; };
    const setWheelRafValue = (v: number | null) => { wheelRafRef.current = v; };
    const setWheelLastEventValue = (ev: { clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null) => { wheelLastEventRef.current = ev; };

    





    useEffect(() => {
        setSelectedElementIds([]);
        setEditingElement(null);
        handleCancelCrop();
        setSelectionBox(null);
        setPrompt('');
    }, [activeBoardId]);

    

    


    useUiTheme(uiTheme, buttonTheme, canvasBackgroundColor);

    const { updateActiveBoard, updateActiveBoardSilent, setElements, commitAction, handleUndo, handleRedo, getDescendants } = useBoardActions(activeBoardId, setBoards);

    const { handleMergeLayers } = useLayerMerge({ elementsRef, selectedElementIds, getDescendants, commitAction, setSelectedElementIds, generateId, setError, zoom });

    const { croppingState, setCroppingState, cropAspectRatio, handleCropAspectRatioChange, handleStartCrop, handleCancelCrop, handleConfirmCrop } = useCrop({ setActiveTool, elementsRef, commitAction, setError });

    const { editingElement, setEditingElement, editingTextareaRef, handleStopEditing } = useTextEditing({ commitAction, elementsRef, setElements });

    const { handleSelectInPanel, handleToggleVisibilityInPanel, handleToggleLockInPanel, handleRenameInPanel, handleReorderInPanel } = useLayerPanel({ elementsRef, commitAction, setSelectedElementIds });


    

    const setSpacebarDownTimeValue = (v: number | null) => { spacebarDownTime.current = v; };
    const setPreviousToolValue = (t: Tool) => { previousToolRef.current = t; };
    useKeyboardShortcuts({ editingElement, handleStopEditing, selectedElementIds, setSelectedElementIds, activeTool, setActiveTool, handleUndo, handleRedo, commitAction, getDescendants, elementsRef, spacebarDownTimeRef: spacebarDownTime, previousToolRef: previousToolRef, setSpacebarDownTime: setSpacebarDownTimeValue, setPreviousTool: setPreviousToolValue });

    const { getCanvasPoint } = useCanvasCoords(svgRef, panOffset, zoom);

    const { handleAddImageElement, handleDragOver, handleDrop, handleDragLeave } = useDragImport({ svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, setIsLoading, setProgressMessage, generateId, elementsRef });

    const { handleCopyElement, handleDeleteElement } = useClipboard({
        zoom,
        commitAction,
        getDescendants,
        setSelectedElementIds,
        handleAddImageElement,
        generateId,
    });

    

    
    

    

    



    

    

    

    const { handlePropertyChange, handleDownloadImage } = useElementOps({ commitAction });


    


    const { handleGenerate, handleCancelGenerate } = useGenerationPipeline({ svgRef, getCanvasPoint, elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setProgressMessage, setError, prompt, generationMode, videoAspectRatio, imageAspectRatio, imageSize, imageModel, apiProvider, generateId });


    

    const { handleLayerAction, handleRasterizeSelection } = useContextMenuActions({ elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setError, setContextMenu, generateId });

    const { getSelectionBounds: _getSelectionBounds, handleGroup: _handleGroup, handleUngroup: _handleUngroup, handleAlignSelection: _handleAlignSelection } = useSelection({ elementsRef, selectedElementIds, setSelectedElementIds, commitAction, getDescendants, generateId });
    const { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, cursor } = useCanvasInteraction({ svgRef, elements, elementsRef, activeTool, setActiveTool, drawingOptions, selectedElementIds, setSelectedElementIds, setEditingElement, editingElement, setElements, commitAction, getDescendants, setSelectionBox, selectionBox, lassoPath, setLassoPath, resizeStartInfo, cropStartInfo, currentDrawingElementId, interactionMode, startPoint, dragStartElementPositions, setInteractionMode: setInteractionModeValue, setStartPoint: setStartPointValue, setResizeStartInfo: setResizeStartInfoValue, setCropStartInfo: setCropStartInfoValue, setCurrentDrawingElementId: setCurrentDrawingElementIdValue, setDragStartElementPositions: setDragStartElementPositionsValue, clearDragStartElementPositions: clearDragStartElementPositionsValue, setAlignmentGuides, updateActiveBoardSilent, panRafRef, panLastPointRef, wheelRafRef, wheelLastEventRef, setPanRaf: setPanRafValue, setPanLastPoint: setPanLastPointValue, setWheelRaf: setWheelRafValue, setWheelLastEvent: setWheelLastEventValue, croppingState, setCroppingState, cropAspectRatio, wheelAction, zoom, panOffset, setContextMenu, contextMenu, generateId });
    const handleGroup = () => { _handleGroup(); setContextMenu(null); };
    const handleUngroup = () => { _handleUngroup(); setContextMenu(null); };


    


    

    const getSelectionBounds = _getSelectionBounds;

    const handleAlignSelection = _handleAlignSelection;

    const isSelectionActive = selectedElementIds.length > 0;
    const singleSelectedElement = selectedElementIds.length === 1 ? elements.find(el => el.id === selectedElementIds[0]) : null;
    

    const { handleAddBoard, handleDuplicateBoard, handleDeleteBoard, handleRenameBoard, handleSwitchBoard, handleCanvasBackgroundColorChange, generateBoardThumbnail } = useBoardManager({ boards, activeBoardId, setBoards, setActiveBoardId, updateActiveBoard, generateId });

    const isElementVisible = useCallback((element: Element, allElements: Element[]): boolean => {
        if (element.isVisible === false) return false;
        if (element.parentId) {
            const parent = allElements.find(el => el.id === element.parentId);
            if (parent) return isElementVisible(parent, allElements);
        }
        return true;
    }, []);

    const handleFitToWindow = useCallback(() => {
        const svgEl = svgRef.current;
        const currentElements = elementsRef.current;
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;
        if (!currentElements || currentElements.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
            updateActiveBoardSilent(b => ({ ...b, zoom: 1, panOffset: { x: 0, y: 0 } }));
            return;
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        currentElements.forEach(el => {
            if (!isElementVisible(el, currentElements)) return;
            const bounds = getElementBounds(el, currentElements);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            updateActiveBoardSilent(b => ({ ...b, zoom: 1, panOffset: { x: 0, y: 0 } }));
            return;
        }
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        if (contentWidth <= 0 || contentHeight <= 0) {
            updateActiveBoardSilent(b => ({ ...b, zoom: 1, panOffset: { x: 0, y: 0 } }));
            return;
        }
        const scaleX = viewportWidth / contentWidth;
        const scaleY = viewportHeight / contentHeight;
        const paddingFactor = 0.9;
        const rawZoom = Math.min(scaleX, scaleY) * paddingFactor;
        const clampedZoom = Math.max(0.1, Math.min(rawZoom, 10));
        const contentCenterX = minX + contentWidth / 2;
        const contentCenterY = minY + contentHeight / 2;
        const panX = viewportWidth / 2 - clampedZoom * contentCenterX;
        const panY = viewportHeight / 2 - clampedZoom * contentCenterY;
        updateActiveBoardSilent(b => ({ ...b, zoom: clampedZoom, panOffset: { x: panX, y: panY } }));
    }, [elementsRef, svgRef, updateActiveBoardSilent, isElementVisible]);

    return (
        <div className="w-screen h-screen flex flex-col font-sans podui-theme" onDragOverCapture={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }} onDropCapture={(e) => { e.preventDefault(); }} onDragEnter={handleDragOver} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isLoading && <Loader progressMessage={progressMessage} />}
            <ErrorToast error={error} onClose={() => setError(null)} />
            <BoardPanel
                isOpen={isBoardPanelOpen}
                onClose={() => setIsBoardPanelOpen(false)}
                boards={boards}
                activeBoardId={activeBoardId}
                onSwitchBoard={(id) => { handleSwitchBoard(id); setIsBoardPanelOpen(false); }}
                onAddBoard={handleAddBoard}
                onRenameBoard={handleRenameBoard}
                onDuplicateBoard={handleDuplicateBoard}
                onDeleteBoard={handleDeleteBoard}
                generateBoardThumbnail={(els) => generateBoardThumbnail(els, canvasBackgroundColor)}
            />
            <CanvasSettings
                isOpen={isSettingsPanelOpen}
                onClose={() => setIsSettingsPanelOpen(false)}
                canvasBackgroundColor={canvasBackgroundColor}
                onCanvasBackgroundColorChange={handleCanvasBackgroundColorChange}
                language={language}
                setLanguage={setLanguage}
                wheelAction={wheelAction}
                setWheelAction={setWheelAction}
                t={t}
                apiKey={apiKey}
                setApiKey={setApiKey}
                apiProvider={apiProvider}
                setApiProvider={setApiProvider}
                grsaiApiKey={grsaiApiKey}
                setGrsaiApiKey={setGrsaiApiKey}
            />
            <Toolbar
                t={t}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                drawingOptions={drawingOptions}
                setDrawingOptions={setDrawingOptions}
                onUpload={handleAddImageElement}
                isCropping={!!croppingState}
                onConfirmCrop={handleConfirmCrop}
                onCancelCrop={handleCancelCrop}
                cropAspectRatio={cropAspectRatio}
                onCropAspectRatioChange={handleCropAspectRatioChange}
                onSettingsClick={() => setIsSettingsPanelOpen(true)}
                onLayersClick={() => setIsLayerPanelOpen(prev => !prev)}
                onBoardsClick={() => setIsBoardPanelOpen(prev => !prev)}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
            />
            <LayerPanel
                isOpen={isLayerPanelOpen}
                onClose={() => setIsLayerPanelOpen(false)}
                elements={elements}
                selectedElementIds={selectedElementIds}
                onSelectElement={handleSelectInPanel}
                onToggleVisibility={handleToggleVisibilityInPanel}
                onToggleLock={handleToggleLockInPanel}
                onRenameElement={handleRenameInPanel}
                onMergeLayers={handleMergeLayers}
                onReorder={handleReorderInPanel}
            />
            <div className="flex-grow relative overflow-hidden">
                <Canvas
                    svgRef={svgRef}
                    panOffset={panOffset}
                    zoom={zoom}
                    elements={elements}
                    selectedElementIds={selectedElementIds}
                    selectionBox={selectionBox}
                    croppingState={croppingState}
                    editingElement={editingElement}
                    setEditingElement={setEditingElement}
                    editingTextareaRef={editingTextareaRef}
                    handleMouseDown={handleMouseDown}
                    handleMouseMove={handleMouseMove}
                    handleMouseUp={handleMouseUp}
                    handleContextMenu={handleContextMenu}
                    onDragEnter={handleDragOver}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    lassoPath={lassoPath}
                    alignmentGuides={alignmentGuides}
                    getSelectionBounds={getSelectionBounds}
                    handleAlignSelection={handleAlignSelection}
                    t={t}
                    handleDeleteElement={handleDeleteElement}
                    handleCopyElement={handleCopyElement}
                    handleDownloadImage={handleDownloadImage}
                    handleStartCrop={handleStartCrop}
                    handlePropertyChange={handlePropertyChange}
                    cursor={cursor}
                    handleStopEditing={handleStopEditing}
                    canvasBackgroundColor={canvasBackgroundColor}
                />
                
                <ContextMenuOverlay
                    contextMenu={contextMenu}
                    elements={elements}
                    selectedElementIds={selectedElementIds}
                    t={t}
                    onGroup={handleGroup}
                    onUngroup={handleUngroup}
                    onMergeLayers={handleMergeLayers}
                    onLayerAction={handleLayerAction}
                    onRasterizeSelection={handleRasterizeSelection}
                />
            </div>
            <PromptBar
                t={t}
                language={language}
                prompt={prompt}
                setPrompt={setPrompt}
                onGenerate={handleGenerate}
                onCancelGenerate={handleCancelGenerate}
                isLoading={isLoading}
                isSelectionActive={selectedElementIds.length > 0}
                selectedElementCount={selectedElementIds.length}
                userEffects={userEffects}
                onAddUserEffect={addUserEffect}
                onDeleteUserEffect={deleteUserEffect}
                generationMode={generationMode}
                setGenerationMode={setGenerationMode}
                videoAspectRatio={videoAspectRatio}
                setVideoAspectRatio={setVideoAspectRatio}
                activeImageModel={imageModel}
                imageSize={imageSize}
                setImageSize={setImageSize}
                imageAspectRatio={imageAspectRatio}
                setImageAspectRatio={setImageAspectRatio}
                setImageModel={setImageModel}
                apiProvider={apiProvider}
            />
            
            {showUIPreview && <PodUIPreview onClose={() => setShowUIPreview(false)} />}
            
            <BottomBar 
                t={t}
                onFitToWindow={handleFitToWindow}
                onOpenSettings={() => setIsSettingsPanelOpen(true)}
            />

            <div className="fixed bottom-4 left-4 z-50">
                <PodButton size="xs" variant="secondary" onClick={() => setShowUIPreview(true)}>
                    UI Preview
                </PodButton>
            </div>
        </div>
    );
};
export default App;
