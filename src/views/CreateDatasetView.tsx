import React, { useState } from 'react';
import { 
  Terminal, 
  ArrowRight, 
  Hash
} from 'lucide-react';
import { PREBUILT_TEMPLATES } from '../services/nlpParser';
import type { PrebuiltTemplate } from '../services/nlpParser';

interface CreateDatasetViewProps {
  onGenerateSpecification: (prompt: string, seed: number) => void;
}

export const CreateDatasetView: React.FC<CreateDatasetViewProps> = ({
  onGenerateSpecification
}) => {
  const [prompt, setPrompt] = useState(
    'Generate 10,000 e-commerce transactions with 2% fraud, 30% higher weekend sales, 1% extreme-value transactions and 2% missing customer information.'
  );
  const [seed, setSeed] = useState(582941);

  const handleSelectTemplate = (template: PrebuiltTemplate) => {
    setPrompt(template.prompt);
  };

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 900000) + 100000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onGenerateSpecification(prompt.trim(), seed);
  };

  return (
    <div className="page-container">
      {/* Title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Dataset</h1>
          <p className="page-subtitle">
            Describe what you need. SyntheticLab will convert your requirements into a controllable dataset specification.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.1fr)', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Natural Language Requirement Editor */}
        <div className="section-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
                Requirement Specification Editor
              </span>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              NLP Compiler v2.4
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label" htmlFor="prompt-input">
                Dataset Generation Prompt (Natural Language Requirements)
              </label>
              <textarea
                id="prompt-input"
                className="input-textarea"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Specify row volume, target domain, anomaly rates (fraud, missing values, extreme values), seasonality, or distribution constraints..."
                style={{ fontSize: '13px', lineHeight: '1.6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Supports natural numbers, percentages (%), statistical shifts, and domain keywords.</span>
                <span>{prompt.length} chars</span>
              </div>
            </div>

            {/* Seed & PRNG configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Hash size={12} />
                  <span>Deterministic PRNG Seed</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    className="input-text"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={handleRandomizeSeed}
                    title="Generate new pseudo-random seed"
                  >
                    Roll
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">
                  Entropy Engine
                </label>
                <input
                  type="text"
                  className="input-text"
                  value="Mulberry32 (Deterministic)"
                  disabled
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Next: Review and fine-tune schema parameters
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!prompt.trim()}
              >
                <span>Generate Specification</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Prebuilt Examples & Recent Specifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="section-card" style={{ padding: '20px' }}>
            <div className="section-card-title" style={{ fontSize: '14px', marginBottom: '6px' }}>
              Example Specifications
            </div>
            <p className="section-card-desc" style={{ marginBottom: '14px' }}>
              Pre-configured engineering prompt templates with real-world edge cases:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PREBUILT_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.title}
                  onClick={() => handleSelectTemplate(tmpl)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-focus)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {tmpl.title}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                      {tmpl.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
                    {tmpl.description}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{tmpl.prompt}"
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Directive Note */}
          <div 
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--radius-md)', 
              padding: '14px 16px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Deterministic Guarantee: </span>
            Identical prompts combined with the same PRNG seed will yield bit-for-bit identical row values and anomaly positions across any environment.
          </div>
        </div>
      </div>
    </div>
  );
};
