import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Element } from '@/types';

type Deps = {
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  elementsRef: MutableRefObject<Element[]>;
  setElements: (updater: (prev: Element[]) => Element[], pushToHistory?: boolean) => void;
};

export function useTextEditing({ commitAction, elementsRef, setElements }: Deps) {
  const [editingElement, setEditingElement] = useState<{ id: string; text: string } | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStopEditing = useCallback(() => {
    if (!editingElement) return;
    commitAction(prev => prev.map(el =>
      el.id === editingElement.id && el.type === 'text'
        ? { ...el, text: editingElement.text }
        : el.id === editingElement.id && el.type === 'text' && editingTextareaRef.current ? { ...el, text: editingElement.text, height: editingTextareaRef.current.scrollHeight }
          : el
    ));
    setEditingElement(null);
  }, [commitAction, editingElement, editingTextareaRef]);

  useEffect(() => {
    if (editingElement && editingTextareaRef.current) {
      setTimeout(() => {
        if (editingTextareaRef.current) {
          editingTextareaRef.current.focus();
          editingTextareaRef.current.select();
        }
      }, 0);
    }
  }, [editingElement, editingTextareaRef]);

  useEffect(() => {
    if (editingElement && editingTextareaRef.current) {
      const textarea = editingTextareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = textarea.scrollHeight;
      textarea.style.height = '';

      const currentElement = elementsRef.current.find(el => el.id === editingElement.id);
      if (currentElement && currentElement.type === 'text' && currentElement.height !== newHeight) {
        setElements(prev => prev.map(el =>
          el.id === editingElement.id && el.type === 'text'
            ? { ...el, height: newHeight }
            : el
        ), false);
      }
    }
  }, [editingElement, setElements, elementsRef, editingTextareaRef]);

  return { editingElement, setEditingElement, editingTextareaRef, handleStopEditing };
}
