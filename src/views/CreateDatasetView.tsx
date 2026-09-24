import React, { useState } from 'react';
import { 
  Terminal, 
  ArrowRight, 
  Hash,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';
import { PREBUILT_TEMPLATES } from '../services/nlpParser';
import type { PrebuiltTemplate } from '../services/nlpParser';
import type { DatasetSpecification } from '../types';
import { parseRequirementWithAi } from '../services/aiParserService';

interface CreateDatasetViewProps {
  onGenerateSpecification: (spec: DatasetSpecification) => void;
}

export type AiParsingStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'FALLBACK' | 'ERROR';

export const CreateDatasetView: React.FC<CreateDatasetViewProps> = ({
  onGenerateSpecification
}) => {
  const [prompt, setPrompt] = useState(
    'Generate 10,000 e-commerce transactions with 2% fraud, 30% higher weekend sales, 1% extreme-value transactions and 2% missing customer information.'
  );
  const [seed, setSeed] = useState(582941);

  // AI Parsing State
  const [parsingStatus, setParsingStatus] = useState<AiParsingStatus>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('Describe your dataset requirement in natural language...');
  const [parsedSpec, setParsedSpec] = useState<DatasetSpecification | null>(null);
  const [aiSource, setAiSource] = useState<'gemini' | 'fallback'>('gemini');
  const [modelUsed, setModelUsed] = useState<string>('models/gemini-3.5-flash');

  const handleSelectTemplate = (template: PrebuiltTemplate) => {
    setPrompt(template.prompt);
    setParsedSpec(null);
    setParsingStatus('IDLE');
    setStatusMessage('Describe your dataset requirement in natural language...');
  };

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 900000) + 100000);
    if (parsedSpec) {
      setParsedSpec(prev => prev ? { ...prev, seed: Math.floor(Math.random() * 900000) + 100000 } : null);
    }
  };

  const handleParseAndGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || parsingStatus === 'LOADING') return;

    setParsingStatus('LOADING');
    setStatusMessage('Gemini is understanding your requirement...');

    try {
      const result = await parseRequirementWithAi(prompt.trim(), seed);
      setParsedSpec(result.specification);
      setAiSource(result.source);

      if (result.source === 'gemini') {
        setParsingStatus('SUCCESS');
        const m = result.model || 'models/gemini-3.5-flash';
        setModelUsed(m);
        setStatusMessage(`✓ Requirement parsed by Gemini (${m.replace('models/', '')})`);
      } else {
        setParsingStatus('FALLBACK');
        setStatusMessage(result.error ? `Gemini unavailable (${result.error}) — using local parser` : 'Gemini unavailable — using local parser');
      }
    } catch {
      setParsingStatus('ERROR');
      setStatusMessage('AI parsing failed — using local parser');
    }
  };

  const handleProceedToReview = () => {
    if (parsedSpec) {
      onGenerateSpecification(parsedSpec);
    }
  };

  return (
    <div className="page-container">
      {/* Title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Dataset</h1>
          <p className="page-subtitle">
            Describe what you need in natural language. Gemini AI interprets your constraints into a verified dataset specification for our deterministic generation engine.
          </p>
        </div>
      </div>

      {/* Transparent GenAI Architecture Flow Indicator */}
      <div 
        style={{ 
          marginBottom: '20px', 
          padding: '12px 16px', 
          backgroundColor: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Cpu size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>Generation Pipeline Flow:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
            <span className="badge badge-neutral">1. Natural Language</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--accent-border)', color: 'var(--accent-primary)' }}>
              <Bot size={11} style={{ marginRight: '4px' }} />
              2. Gemini AI Parser
            </span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="badge badge-neutral">3. Structured Spec</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="badge badge-neutral">4. Deterministic PRNG</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="badge badge-success">5. Statistical Validation</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Architecture Principle: </strong>
          Gemini parses your requirement into structured statistical parameters. Our local deterministic Mulberry32 engine generates and validates the actual records.
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

            {/* AI Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {parsingStatus === 'LOADING' && (
                <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={11} className="spin-animation" />
                  <span>Gemini Parsing...</span>
                </span>
              )}
              {parsingStatus === 'SUCCESS' && (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={11} />
                  <span>Gemini AI Verified</span>
                </span>
              )}
              {parsingStatus === 'FALLBACK' && (
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={11} />
                  <span>Local Parser Fallback</span>
                </span>
              )}
              {parsingStatus === 'IDLE' && (
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  Google Gemini Ready
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleParseAndGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label" htmlFor="prompt-input">
                Dataset Generation Prompt (Natural Language Requirements)
              </label>
              <textarea
                id="prompt-input"
                className="input-textarea"
                rows={5}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (parsedSpec) setParsedSpec(null);
                  if (parsingStatus !== 'IDLE') setParsingStatus('IDLE');
                }}
                placeholder="Specify row volume, target domain, anomaly rates (fraud, missing values, extreme values), seasonality, or distribution constraints..."
                style={{ fontSize: '13px', lineHeight: '1.6' }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ color: parsingStatus === 'SUCCESS' ? 'var(--success)' : parsingStatus === 'FALLBACK' ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {statusMessage}
                </span>
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

            {/* AI Parsed Specification Preview Card (Shows upon parsing) */}
            {parsedSpec && (
              <div 
                style={{ 
                  backgroundColor: 'var(--surface-elevated)', 
                  border: aiSource === 'gemini' ? '1px solid var(--accent-border)' : '1px solid var(--border)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={15} style={{ color: aiSource === 'gemini' ? 'var(--accent-primary)' : 'var(--warning)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      AI Parsed Specification
                    </span>
                  </div>

                  <span className={`badge ${aiSource === 'gemini' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                    {aiSource === 'gemini' ? `Parsed by Gemini (${modelUsed.replace('models/', '')})` : 'Local Parser Fallback'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target Domain</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {parsedSpec.domain.replace('_', ' ')}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Row Volume</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {parsedSpec.totalRows.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Fraud / Anomaly Rate</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
                      {parsedSpec.edgeCases.fraudRate}%
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Missing Values Rate</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {parsedSpec.edgeCases.missingValuesRate}%
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Extreme Outlier Rate</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {parsedSpec.edgeCases.extremeValuesRate}%
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Weekend Sales Uplift</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      +{parsedSpec.edgeCases.weekendSalesIncrease}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Schema fields: {parsedSpec.schema.length} attributes ready for tuning
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleProceedToReview}
                  >
                    <span>Proceed to Review & Tune Specification</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!parsedSpec && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Next: Gemini will interpret requirements into typed schema parameters
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!prompt.trim() || parsingStatus === 'LOADING'}
                >
                  {parsingStatus === 'LOADING' ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" />
                      <span>Understanding with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Parse Requirement with Gemini</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Prebuilt Examples & Recent Specifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="section-card" style={{ padding: '20px' }}>
            <div className="section-card-title" style={{ fontSize: '14px', marginBottom: '6px' }}>
              Example Specifications
            </div>
            <p className="section-card-desc" style={{ marginBottom: '14px' }}>
              Select an engineering requirement to test Gemini's natural language comprehension:
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>Dual Reliability Guarantee</strong>
            </div>
            Gemini provides flexible natural-language intent recognition. If the network or API quota is unavailable, SyntheticLab automatically switches to the internal rule-based NLP compiler with zero downtime.
          </div>
        </div>
      </div>
    </div>
  );
};
