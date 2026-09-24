import React from 'react';
import { CheckCircle2, Circle, Loader2, ArrowRight } from 'lucide-react';
import type { GenerationProgress } from '../services/generatorEngine';

interface GenerationPipelineModalProps {
  isOpen: boolean;
  progress: GenerationProgress | null;
  onViewDataset: () => void;
  onClose: () => void;
}

export const GenerationPipelineModal: React.FC<GenerationPipelineModalProps> = ({
  isOpen,
  progress,
  onViewDataset,
  onClose
}) => {
  if (!isOpen || !progress) return null;

  const isCompleted = progress.stage === 'COMPLETED';

  const stages = [
    { key: 'UNDERSTANDING_REQUIREMENTS', label: 'Understanding requirements' },
    { key: 'BUILDING_SCHEMA', label: 'Building schema' },
    { key: 'GENERATING_RECORDS', label: 'Generating records' },
    { key: 'APPLYING_EDGE_CASES', label: 'Applying edge cases' },
    { key: 'RUNNING_VALIDATION', label: 'Running validation' },
    { key: 'PREPARING_FILES', label: 'Preparing files' },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === progress.stage);
  const activeIndex = isCompleted ? 99 : (currentStageIndex >= 0 ? currentStageIndex : 0);

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Generation Job</span>
            <span className={`badge ${isCompleted ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '11px' }}>
              {isCompleted ? 'COMPLETED' : 'RUNNING'}
            </span>
          </div>
          {isCompleted && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={onClose}
              style={{ padding: '2px 6px' }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pipeline Stage Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stages.map((stage, idx) => {
              const isPast = isCompleted || idx < activeIndex;
              const isCurrent = !isCompleted && idx === activeIndex;
              const isPending = !isCompleted && idx > activeIndex;

              return (
                <div 
                  key={stage.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    fontSize: '13px',
                    color: isPast ? 'var(--text-primary)' : (isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'),
                    fontWeight: isCurrent ? 600 : 400
                  }}
                >
                  {isPast && (
                    <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  )}
                  {isCurrent && (
                    <Loader2 size={16} className="spin" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  )}
                  {isPending && (
                    <Circle size={16} style={{ color: 'var(--border)', flexShrink: 0 }} />
                  )}
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{progress.percent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div 
                style={{ 
                  width: `${progress.percent}%`, 
                  height: '100%', 
                  backgroundColor: isCompleted ? 'var(--success)' : 'var(--accent-primary)',
                  transition: 'width 0.2s ease'
                }} 
              />
            </div>
          </div>

          {/* Technical Metadata Box */}
          <div 
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rows generated:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {progress.rowsGenerated.toLocaleString()} / {progress.totalRows.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Current stage:</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {progress.message}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {isCompleted ? (
            <button 
              className="btn btn-primary"
              onClick={onViewDataset}
            >
              <span>View Dataset</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Executing deterministic synthesis pipeline...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
