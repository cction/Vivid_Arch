import React from 'react'
import { Dialog, Button, IconButton } from '../ui'

interface Props {
  onContinue: () => void
  onNew: () => void
  lastName?: string
  lastTime?: number
}

export const SessionRestoreDialog: React.FC<Props> = ({ onContinue, onNew, lastName, lastTime }) => {
  return (
    <Dialog open={true} onClose={onNew}>
      <div className="p-4 w-80">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-[var(--text-heading)]">发现上次图版</h3>
          <IconButton onClick={onNew}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </IconButton>
        </div>
        <div className="text-sm text-[var(--text-primary)]">
          <div>上次活动图版：{lastName || '未命名'}</div>
          <div>保存时间：{lastTime ? new Date(lastTime).toLocaleString() : '-'}</div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={onContinue}>继续上次图版</Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={onNew}>打开新图版</Button>
        </div>
      </div>
    </Dialog>
  )
}
