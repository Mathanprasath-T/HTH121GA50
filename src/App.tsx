import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import type { NavTab } from './components/Sidebar';
import { TopContextBar } from './components/TopContextBar';
import { GenerationPipelineModal } from './components/GenerationPipelineModal';

import { DashboardView } from './views/DashboardView';
import { CreateDatasetView } from './views/CreateDatasetView';
import { SpecificationReviewView } from './views/SpecificationReviewView';
import { ValidationView } from './views/ValidationView';
import { ValidationLabView } from './views/ValidationLabView';
import { DatasetExplorerView } from './views/DatasetExplorerView';
import { AnomalyLabView } from './views/AnomalyLabView';
import { StressTestView } from './views/StressTestView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { LandingView } from './views/LandingView';

import type { 
  Dataset, 
  DatasetSpecification, 
  ActivityItem 
} from './types';
import { store } from './services/store';
import type { GlobalMetrics } from './services/store';
import { 
  parseNaturalLanguageRequirement 
} from './services/nlpParser';
import { generateDatasetAsync } from './services/generatorEngine';
import type { GenerationProgress } from './services/generatorEngine';
import { persistDatasetToCloud } from './services/supabaseService';
import { generateRowsWithGeminiAi } from './services/aiParserService';
import { runValidationSuite } from './services/validator';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [datasets, setDatasets] = useState<Omit<Dataset, 'records'>[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [activeDatasetFull, setActiveDatasetFull] = useState<Dataset | null>(null);

  const [metrics, setMetrics] = useState<GlobalMetrics>({
    totalDatasets: 0,
    totalRowsGenerated: 0,
    validationPassRate: 0,
    totalAnomaliesInjected: 0
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingSpec, setPendingSpec] = useState<DatasetSpecification | null>(null);

  // Generation pipeline state
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isApplyingAnomalies, setIsApplyingAnomalies] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Reload metadata and metrics
  const refreshStoreData = useCallback(async () => {
    const list = await store.getAllDatasets();
    setDatasets(list);

    const m = await store.getGlobalMetrics();
    setMetrics(m);

    const acts = store.getActivityFeed();
    setActivities(acts);

    // If active dataset exists, refresh full record
    if (activeDatasetId) {
      const full = await store.getDatasetById(activeDatasetId);
      setActiveDatasetFull(full);
    } else if (list.length > 0) {
      const firstId = list[0].id;
      setActiveDatasetId(firstId);
      const full = await store.getDatasetById(firstId);
      setActiveDatasetFull(full);
    } else {
      setActiveDatasetFull(null);
    }
  }, [activeDatasetId]);

  useEffect(() => {
    refreshStoreData();
    const unsubscribe = store.subscribe(() => {
      refreshStoreData();
    });
    return unsubscribe;
  }, [refreshStoreData]);

  // Handle active dataset switch
  const handleSelectActiveDataset = async (id: string) => {
    setActiveDatasetId(id);
    const full = await store.getDatasetById(id);
    setActiveDatasetFull(full);
  };

  // Open dataset from dashboard
  const handleOpenDataset = async (id: string) => {
    await handleSelectActiveDataset(id);
    setCurrentTab('datasets');
  };

  // Delete dataset
  const handleDeleteDataset = async (id: string) => {
    await store.deleteDataset(id);
    if (activeDatasetId === id) {
      setActiveDatasetId(null);
      setActiveDatasetFull(null);
    }
    await refreshStoreData();
  };

  // Step 1 -> Step 2: Accept parsed specification (Gemini AI or fallback) into review
  const handleGenerateSpecification = (spec: DatasetSpecification) => {
    setPendingSpec(spec);
    setCurrentTab('specification_review');
  };

  // Step 2 -> Step 3: Run deterministic generator pipeline
  const handleExecuteGeneration = async (specToRun: DatasetSpecification) => {
    setIsPipelineModalOpen(true);

    try {
      const newDataset = await generateDatasetAsync(specToRun, (prog) => {
        setGenerationProgress(prog);
      });

      // 1. Initial Local Persistence (IndexedDB)
      newDataset.cloudStatus = 'SYNCING';
      await store.saveDataset(newDataset);
      setActiveDatasetId(newDataset.id);
      setActiveDatasetFull(newDataset);
      await refreshStoreData();

      // 2. Asynchronous Cloud Persistence (Supabase Cloud + Storage)
      persistDatasetToCloud(newDataset, specToRun.prompt, 'gemini')
        .then(async (res) => {
          if (res.success) {
            await store.updateDatasetCloudMetadata(newDataset.id, {
              cloudStatus: 'CLOUD_SAVED',
              cloudDatasetId: res.cloudDatasetId,
              cloudJobId: res.cloudJobId,
              cloudStoragePath: res.csvStoragePath,
              cloudAnomalyStoragePath: res.anomalyStoragePath,
              cloudReportStoragePath: res.reportStoragePath,
              cloudSyncedAt: new Date().toISOString()
            });
          } else {
            console.warn('[Cloud Persistence Notice]:', res.error);
            await store.updateDatasetCloudMetadata(newDataset.id, {
              cloudStatus: 'SYNC_FAILED',
              cloudError: res.error
            });
          }
          await refreshStoreData();
        })
        .catch(async (cloudErr) => {
          console.warn('[Cloud Persistence Exception]:', cloudErr);
          await store.updateDatasetCloudMetadata(newDataset.id, {
            cloudStatus: 'SYNC_FAILED',
            cloudError: cloudErr?.message || 'Cloud sync failed'
          });
          await refreshStoreData();
        });

    } catch (err) {
      console.error('Generation pipeline failed:', err);
    }
  };

  // Step 2 -> Step 3 (Gemini AI Direct Mode): Generate synthetic rows using Gemini API Key
  const handleExecuteGeminiGeneration = async (specToRun: DatasetSpecification) => {
    setIsPipelineModalOpen(true);
    const targetCount = Math.min(30, specToRun.totalRows);

    setGenerationProgress({
      stage: 'UNDERSTANDING_REQUIREMENTS',
      stageIndex: 1,
      totalStages: 6,
      percent: 20,
      rowsGenerated: 0,
      totalRows: targetCount,
      message: 'Calling Gemini GenAI API with your Google AI Studio key...'
    });

    try {
      setGenerationProgress({
        stage: 'GENERATING_RECORDS',
        stageIndex: 3,
        totalStages: 6,
        percent: 60,
        rowsGenerated: 0,
        totalRows: targetCount,
        message: `Gemini AI is directly synthesizing ${targetCount} realistic records...`
      });

      const res = await generateRowsWithGeminiAi(
        specToRun.prompt,
        specToRun.schema,
        targetCount,
        specToRun.edgeCases
      );

      if (res.success && res.records && res.records.length > 0) {
        const datasetId = `ds_gemini_${Date.now().toString(36)}`;
        const durationMs = 1200;

        const validationReport = runValidationSuite(
          datasetId,
          { ...specToRun, totalRows: res.records.length },
          res.records,
          []
        );

        const newDataset: Dataset = {
          id: datasetId,
          name: `${specToRun.name} [Gemini AI Generated]`,
          domain: specToRun.domain,
          rowCount: res.records.length,
          seed: specToRun.seed,
          createdAt: new Date().toISOString(),
          generationDurationMs: durationMs,
          specification: { ...specToRun, totalRows: res.records.length },
          records: res.records,
          validationReport,
          anomalyLogs: [],
          cloudStatus: 'SYNCING'
        };

        setGenerationProgress({
          stage: 'COMPLETED',
          stageIndex: 6,
          totalStages: 6,
          percent: 100,
          rowsGenerated: res.records.length,
          totalRows: res.records.length,
          message: `Successfully synthesized ${res.records.length} records using Gemini (${res.model || 'Gemini Flash'})!`
        });

        await store.saveDataset(newDataset);
        setActiveDatasetId(newDataset.id);
        setActiveDatasetFull(newDataset);
        await refreshStoreData();

        // Asynchronous cloud persistence
        persistDatasetToCloud(newDataset, specToRun.prompt, 'gemini')
          .then(async (cRes) => {
            if (cRes.success) {
              await store.updateDatasetCloudMetadata(newDataset.id, {
                cloudStatus: 'CLOUD_SAVED',
                cloudDatasetId: cRes.cloudDatasetId,
                cloudJobId: cRes.cloudJobId,
                cloudStoragePath: cRes.csvStoragePath,
                cloudAnomalyStoragePath: cRes.anomalyStoragePath,
                cloudReportStoragePath: cRes.reportStoragePath,
                cloudSyncedAt: new Date().toISOString()
              });
            } else {
              await store.updateDatasetCloudMetadata(newDataset.id, {
                cloudStatus: 'LOCAL_ONLY',
                cloudError: cRes.error
              });
            }
            await refreshStoreData();
          })
          .catch(() => {});
      } else {
        console.warn('Gemini row generation returned error, falling back to deterministic generation:', res.error);
        await handleExecuteGeneration(specToRun);
      }
    } catch (err) {
      console.error('Gemini synthesis failed, falling back to deterministic generator:', err);
      await handleExecuteGeneration(specToRun);
    }
  };

  // Retry or manually sync a local dataset to Supabase Cloud
  const handleRetryCloudSave = async (targetDataset: Dataset) => {
    if (!targetDataset) return;
    setIsSyncingCloud(true);
    await store.updateDatasetCloudMetadata(targetDataset.id, {
      cloudStatus: 'SYNCING'
    });
    await refreshStoreData();

    try {
      const res = await persistDatasetToCloud(
        targetDataset, 
        targetDataset.specification?.prompt, 
        'gemini'
      );
      if (res.success) {
        await store.updateDatasetCloudMetadata(targetDataset.id, {
          cloudStatus: 'CLOUD_SAVED',
          cloudDatasetId: res.cloudDatasetId,
          cloudJobId: res.cloudJobId,
          cloudStoragePath: res.csvStoragePath,
          cloudAnomalyStoragePath: res.anomalyStoragePath,
          cloudReportStoragePath: res.reportStoragePath,
          cloudSyncedAt: new Date().toISOString()
        });
      } else {
        await store.updateDatasetCloudMetadata(targetDataset.id, {
          cloudStatus: 'SYNC_FAILED',
          cloudError: res.error
        });
      }
    } catch (err: any) {
      await store.updateDatasetCloudMetadata(targetDataset.id, {
        cloudStatus: 'SYNC_FAILED',
        cloudError: err?.message || 'Retry cloud sync failed'
      });
    } finally {
      setIsSyncingCloud(false);
      await refreshStoreData();
    }
  };

  // View newly generated dataset
  const handlePipelineViewDataset = () => {
    setIsPipelineModalOpen(false);
    setCurrentTab('validation');
  };

  // Anomaly Lab Apply
  const handleApplyAnomalies = async (targets: {
    missingRatePct: number;
    extremeRatePct: number;
    duplicateRatePct: number;
    invalidDateRatePct: number;
    rareCategoryRatePct: number;
  }) => {
    if (!activeDatasetId) return;
    setIsApplyingAnomalies(true);
    try {
      const updated = await store.applyControlledAnomalies(activeDatasetId, targets);
      if (updated) {
        setActiveDatasetFull(updated);
      }
      await refreshStoreData();
    } finally {
      setIsApplyingAnomalies(false);
    }
  };

  // Clear Database
  const handleClearAllData = async () => {
    await store.clearAllData();
    setActiveDatasetId(null);
    setActiveDatasetFull(null);
    await refreshStoreData();
  };

  // Load Demonstration Dataset (strictly labeled DEMO DATA)
  const handleLoadDemoData = async () => {
    setIsLoadingDemo(true);
    try {
      const demoPrompt = 'Generate 10,000 e-commerce transactions with 2% fraud, 30% higher weekend sales, 1% extreme-value transactions and 2% missing customer information.';
      const demoSpec = parseNaturalLanguageRequirement(demoPrompt, 582941);
      demoSpec.name = 'ecommerce_transactions_demo_10k [DEMO DATA]';
      demoSpec.totalRows = 10000;

      const generated = await generateDatasetAsync(demoSpec);
      generated.cloudStatus = 'SYNCING';
      await store.saveDataset(generated);
      setActiveDatasetId(generated.id);
      setActiveDatasetFull(generated);
      await refreshStoreData();
      setCurrentTab('validation');

      // Trigger background cloud sync for demo dataset
      persistDatasetToCloud(generated, demoPrompt, 'local')
        .then(async (res) => {
          if (res.success) {
            await store.updateDatasetCloudMetadata(generated.id, {
              cloudStatus: 'CLOUD_SAVED',
              cloudDatasetId: res.cloudDatasetId,
              cloudJobId: res.cloudJobId,
              cloudStoragePath: res.csvStoragePath,
              cloudAnomalyStoragePath: res.anomalyStoragePath,
              cloudReportStoragePath: res.reportStoragePath,
              cloudSyncedAt: new Date().toISOString()
            });
          } else {
            await store.updateDatasetCloudMetadata(generated.id, {
              cloudStatus: 'LOCAL_ONLY',
              cloudError: res.error
            });
          }
          await refreshStoreData();
        })
        .catch(() => {});
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Left Sidebar */}
      <Sidebar 
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        datasetCount={datasets.length}
      />

      {/* Main Layout Area */}
      <div className="app-main">
        {/* Top Context Bar */}
        <TopContextBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          datasets={datasets}
          activeDatasetId={activeDatasetId}
          onSelectActiveDataset={handleSelectActiveDataset}
          activeDatasetFull={activeDatasetFull}
        />

        {/* View Switcher */}
        <main style={{ flex: 1 }}>
          {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              datasets={datasets}
              activities={activities}
              onSelectTab={setCurrentTab}
              onOpenDataset={handleOpenDataset}
              onDeleteDataset={handleDeleteDataset}
              onLoadDemoData={handleLoadDemoData}
              isLoadingDemo={isLoadingDemo}
            />
          )}

          {currentTab === 'create_dataset' && (
            <CreateDatasetView
              onGenerateSpecification={handleGenerateSpecification}
            />
          )}

          {currentTab === 'specification_review' && (
            <SpecificationReviewView
              initialSpec={pendingSpec || parseNaturalLanguageRequirement('Generate 10,000 e-commerce transactions with 2% fraud and 30% higher weekend sales', 582941)}
              onBack={() => setCurrentTab('create_dataset')}
              onGenerateDataset={handleExecuteGeneration}
              onGenerateWithGemini={handleExecuteGeminiGeneration}
            />
          )}

          {currentTab === 'datasets' && (
            <DatasetExplorerView
              dataset={activeDatasetFull}
              onGoToCreate={() => setCurrentTab('create_dataset')}
              onRetryCloudSave={handleRetryCloudSave}
              isSyncingCloud={isSyncingCloud}
            />
          )}

          {currentTab === 'validation' && (
            <ValidationView
              dataset={activeDatasetFull}
              onSelectDatasetTab={() => setCurrentTab('datasets')}
            />
          )}

          {currentTab === 'validation_lab' && (
            <ValidationLabView
              activeDataset={activeDatasetFull}
              allDatasets={activeDatasetFull ? [activeDatasetFull] : []}
              onSelectDatasetTab={() => setCurrentTab('datasets')}
            />
          )}

          {currentTab === 'anomaly_lab' && (
            <AnomalyLabView
              dataset={activeDatasetFull}
              onApplyAnomalies={handleApplyAnomalies}
              isApplying={isApplyingAnomalies}
              onGoToCreate={() => setCurrentTab('create_dataset')}
            />
          )}

          {currentTab === 'stress_test' && (
            <StressTestView
              dataset={activeDatasetFull}
              onGoToCreate={() => setCurrentTab('create_dataset')}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              dataset={activeDatasetFull}
              onGoToCreate={() => setCurrentTab('create_dataset')}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              metrics={metrics}
              onClearAllData={handleClearAllData}
              onLoadDemoData={handleLoadDemoData}
              isLoadingDemo={isLoadingDemo}
            />
          )}

          {currentTab === 'landing' && (
            <LandingView
              onSelectTab={setCurrentTab}
              onLoadDemoData={handleLoadDemoData}
              isLoadingDemo={isLoadingDemo}
            />
          )}
        </main>
      </div>

      {/* Generation Pipeline Progress Modal */}
      <GenerationPipelineModal
        isOpen={isPipelineModalOpen}
        progress={generationProgress}
        onViewDataset={handlePipelineViewDataset}
        onClose={() => setIsPipelineModalOpen(false)}
      />
    </div>
  );
}

export default App;
