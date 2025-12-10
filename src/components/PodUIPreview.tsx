import React, { useState } from 'react';
import { PodButton, PodInput, PodPanel, PodToolbar } from './podui';
// import { ContextToolbar } from './ContextToolbar';

// const mockT = (key: string) => key;
// const mockElement: any = {
//   id: '1',
//   type: 'shape',
//   shapeType: 'rectangle',
//   width: 100,
//   height: 100,
//   fillColor: '#ff0000',
//   strokeColor: '#000000',
//   opacity: 100,
//   borderRadius: 0,
//   strokeDashArray: undefined
// };

export const PodUIPreview: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <PodPanel className="w-[900px] h-[700px] overflow-y-auto flex flex-col gap-8 p-8" variant="default" rounded>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">PodUI Component Preview</h2>
          <PodButton variant="ghost" size="sm" onClick={onClose}>Close</PodButton>
        </div>

        {/* <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Context Toolbar (Preview)</h3>
          <div className="flex flex-col gap-4 p-8 bg-gray-800/50 rounded-lg">
            <div className="flex justify-center">
              <ContextToolbar
                mode="multi"
                toolbarScreenWidth={380}
                toolbarScreenHeight={64}
                zoom={1}
                t={mockT}
                onAlign={() => {}}
              />
            </div>
            <div className="h-4"></div>
            <div className="flex justify-center">
              <ContextToolbar
                mode="single"
                element={mockElement}
                toolbarScreenWidth={500}
                toolbarScreenHeight={64}
                zoom={1}
                t={mockT}
                onCopy={() => {}}
                onPropChange={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        </section> */}

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Prompt Bar (New Styles)</h3>
          <div className="p-8 bg-gray-800/50 rounded-lg flex flex-col gap-8 items-center">
            
            {/* Expanded State */}
            <div className="pod-prompt-bar expanded p-3">
              <div className="relative">
                {/* Top Controls */}
                <div className="absolute top-1 right-1 z-10 flex items-center gap-2">
                  <div className="pod-icon-button w-10 h-10 bg-[var(--bg-component)] hover:bg-[var(--border-color)] rounded-full text-[var(--text-secondary)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  </div>
                  <div className="pod-prompt-mode-switch">
                    <button className="pod-prompt-mode-button active">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    </button>
                    <button className="pod-prompt-mode-button">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                    </button>
                  </div>
                </div>

                <textarea 
                  className="pod-prompt-textarea" 
                  placeholder="Describe what you want to generate..."
                  rows={2}
                  defaultValue="A futuristic city with flying cars and neon lights"
                />
              </div>

              <div className="pod-prompt-controls">
                <div className="flex items-center gap-2">
                   {/* Banana Button Placeholder */}
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-blue-400"></div>
                   
                   <button className="pod-prompt-selector">
                     Model <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                   </button>
                   <button className="pod-prompt-selector">
                     16:9 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="2" ry="2" /></svg>
                   </button>
                </div>
                <button className="pod-generate-button h-9 px-5 rounded-xl font-bold text-sm flex items-center gap-1.5">
                  Generate
                </button>
              </div>
            </div>

          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Acceptance Checks</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Focus Ring</div>
              <PodInput placeholder="Tab to focus" />
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Disabled States</div>
              <div className="flex gap-3">
                <PodButton disabled>Disabled</PodButton>
                <PodInput placeholder="Disabled" disabled />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Hover & Active (Buttons)</div>
              <div className="flex gap-3">
                <PodButton variant="primary">Primary</PodButton>
                <PodButton variant="secondary">Secondary</PodButton>
                <PodButton variant="ghost">Ghost</PodButton>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Menu Item Active</div>
              <div className="p-3 bg-gray-800/40 rounded-lg">
                <div className="pod-menu-item">Default</div>
                <div className="pod-menu-item active mt-2">Active</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Scrollbar & Separator</div>
              <div className="h-32 w-full bg-[var(--bg-component)] border border-[var(--border-color)] rounded-lg overflow-y-auto pod-scrollbar p-2 mb-2">
                <div className="space-y-2">
                  <div>Item 1</div>
                  <div className="pod-separator"></div>
                  <div>Item 2</div>
                  <div className="pod-separator"></div>
                  <div>Item 3</div>
                  <div className="pod-separator"></div>
                  <div>Item 4</div>
                  <div className="pod-separator"></div>
                  <div>Item 5</div>
                  <div className="pod-separator"></div>
                  <div>Item 6 (Scroll to see me)</div>
                </div>
              </div>
              <div className="w-full bg-[var(--bg-component)] border border-[var(--border-color)] rounded-lg overflow-x-auto pod-scrollbar-x p-2 whitespace-nowrap">
                <div className="inline-flex gap-4 p-2">
                  <div>Item 1 (Horizontal)</div>
                  <div className="pod-separator-vertical h-8"></div>
                  <div>Item 2</div>
                  <div className="pod-separator-vertical h-8"></div>
                  <div>Item 3</div>
                  <div className="pod-separator-vertical h-8"></div>
                  <div>Item 4</div>
                  <div className="pod-separator-vertical h-8"></div>
                  <div>Item 5 (Scroll me)</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Chip Boundary</div>
              <div className="flex flex-wrap gap-2 max-w-[200px] border border-[var(--border-color)] p-2 rounded-lg mb-2">
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px]">Short</div>
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px] active">Active</div>
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px] truncate max-w-full" title="Very long chip text that should truncate">
                  Very long chip text that should truncate
                </div>
              </div>
              <div className="flex gap-2 max-w-[200px] overflow-x-auto pod-scrollbar-x border border-[var(--border-color)] p-2 rounded-lg">
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px] whitespace-nowrap">No Wrap 1</div>
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px] whitespace-nowrap">No Wrap 2</div>
                <div className="pod-chip text-xs py-1 px-3 min-h-[24px] whitespace-nowrap">No Wrap 3</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Buttons</h3>
          <div className="flex flex-wrap gap-4 items-center">
            <PodButton variant="primary">Primary</PodButton>
            <PodButton variant="secondary">Secondary</PodButton>
            <PodButton variant="ghost">Ghost</PodButton>
            <PodButton variant="outline">Outline</PodButton>
            <PodButton variant="danger">Danger</PodButton>
            <PodButton variant="generate">Generate</PodButton>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <PodButton size="xs">Size XS</PodButton>
            <PodButton size="sm">Size SM</PodButton>
            <PodButton size="md">Size MD</PodButton>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <PodButton isLoading>Loading</PodButton>
            <PodButton disabled>Disabled</PodButton>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Inputs</h3>
          <div className="grid grid-cols-2 gap-4">
            <PodInput placeholder="Default Input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <PodInput placeholder="Small Input" size="sm" />
            <PodInput placeholder="With Left Icon" leftIcon={<span>🔍</span>} />
            <PodInput placeholder="With Right Icon" rightIcon={<span>✖</span>} />
            <PodInput placeholder="Error State" hasError />
            <PodInput placeholder="Disabled" disabled />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Panels</h3>
          <div className="grid grid-cols-2 gap-4">
            <PodPanel className="p-4 text-center">Default Panel</PodPanel>
            <PodPanel variant="brand-gradient" className="p-4 text-center text-black">Brand Gradient</PodPanel>
            <PodPanel variant="transparent" className="p-4 text-center border border-white/10">Transparent</PodPanel>
            <PodPanel variant="pill" className="p-4 text-center">Pill Panel</PodPanel>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-300">Toolbars</h3>
          <div className="space-y-4">
            <PodToolbar className="p-2 flex gap-2">
              <PodButton size="sm" variant="ghost">Tool 1</PodButton>
              <PodButton size="sm" variant="ghost">Tool 2</PodButton>
            </PodToolbar>
            <PodToolbar variant="elevated" className="p-2 flex gap-2">
              <PodButton size="sm" variant="secondary">Elevated Tool 1</PodButton>
              <PodButton size="sm" variant="secondary">Elevated Tool 2</PodButton>
            </PodToolbar>
          </div>
        </section>
      </PodPanel>
    </div>
  );
};
