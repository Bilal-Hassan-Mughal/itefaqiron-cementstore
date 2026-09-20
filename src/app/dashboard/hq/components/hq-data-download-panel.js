'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  Info,
  Layers,
  Server,
} from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import { HQ_BRAND, HQ_GRADIENTS, HQ_UI } from '@/lib/brand-theme';

const EMPTY_PREVIEW = null;

const STAT_COLORS = {
  tables: { main: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  rows: { main: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  size: { main: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  time: { main: '#d97706', bg: '#fffbeb', border: '#fde68a' },
};

const EXPORT_STEPS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'build', label: 'Build' },
  { id: 'download', label: 'Download' },
  { id: 'save', label: 'Save' },
];

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getActiveStep(phase) {
  if (phase === 'connecting') return 0;
  if (phase === 'building') return 1;
  if (phase === 'downloading') return 2;
  if (phase === 'saving' || phase === 'done') return 3;
  return 0;
}

function StatCard({ icon: Icon, label, value, loading, paletteKey }) {
  const palette = STAT_COLORS[paletteKey] || STAT_COLORS.tables;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        height: '100%',
        borderRadius: '1rem',
        border: `1px solid ${palette.border}`,
        bgcolor: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${palette.main}18`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${palette.main}, ${HQ_BRAND.accent})`,
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 2,
          bgcolor: palette.bg,
          color: palette.main,
          border: `1px solid ${palette.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.5,
        }}
      >
        <Icon size={20} strokeWidth={2.25} />
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: '#64748b',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'block',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      {loading ? (
        <Skeleton width="65%" height={34} sx={{ borderRadius: 1 }} />
      ) : (
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.02em' }}
        >
          {value}
        </Typography>
      )}
    </Paper>
  );
}

function FormatOption({ active, disabled, icon: Icon, title, subtitle, onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={disabled ? undefined : onClick}
      sx={{
        p: 1.75,
        flex: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '0.875rem',
        border: active ? `2px solid ${HQ_BRAND.primary}` : '1px solid #e2e8f0',
        bgcolor: active ? HQ_BRAND.tint : '#fafbfc',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        boxShadow: active ? `0 4px 16px ${HQ_BRAND.primary}22` : 'none',
        '&:hover': disabled ? {} : {
          borderColor: active ? HQ_BRAND.primary : '#cbd5e1',
          bgcolor: active ? HQ_BRAND.tint : '#f8fafc',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            flexShrink: 0,
            bgcolor: active ? HQ_BRAND.primary : '#e2e8f0',
            color: active ? '#fff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={800} sx={{ color: active ? HQ_BRAND.primaryDark : '#0f172a' }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.35, display: 'block', mt: 0.25 }}>
            {subtitle}
          </Typography>
        </Box>
        {active && (
          <CheckCircle2 size={18} color={HQ_BRAND.primary} style={{ flexShrink: 0, marginLeft: 'auto' }} />
        )}
      </Box>
    </Paper>
  );
}

export default function HqDataDownloadPanel({ user }) {
  const [exportFormat, setExportFormat] = useState('sql');
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [progress, setProgress] = useState(null);
  const previewAbortRef = useRef(null);
  const tickRef = useRef(null);

  const scopeLabel = preview?.scopeLabel || preview?.database
    ? (preview.scopeLabel || `Complete database (${preview.database})`)
    : 'Complete database — all branches, HQ users & tables';

  const loadPreview = useCallback(async () => {
    if (!user) return;

    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;

    setPreviewLoading(true);
    setPreviewError('');

    try {
      const params = new URLSearchParams({
        preview: 'true',
        format: exportFormat,
      });
      const res = await branchFetch(user, `/api/hq/data-export?${params.toString()}`, {
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze database');
      if (!ac.signal.aborted) setPreview(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!ac.signal.aborted) {
        setPreview(EMPTY_PREVIEW);
        setPreviewError(err.message || 'Failed to analyze database');
      }
    } finally {
      if (!ac.signal.aborted) setPreviewLoading(false);
    }
  }, [user, exportFormat]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(loadPreview, 300);
    return () => clearTimeout(t);
  }, [user, loadPreview]);

  useEffect(() => {
    if (!exporting || !progress?.startedAt) return;

    tickRef.current = setInterval(() => {
      setProgress((prev) => {
        if (!prev?.startedAt) return prev;
        const elapsed = (Date.now() - prev.startedAt) / 1000;
        const estimated = prev.estimatedSeconds || 60;
        let eta = prev.eta;

        if (prev.phase === 'building' || (prev.phase === 'downloading' && !prev.received)) {
          eta = Math.max(0, estimated - elapsed);
        }

        let percent = prev.percent;
        if (prev.phase === 'building' && !prev.received) {
          percent = Math.min(35, 5 + (elapsed / estimated) * 30);
        }

        return { ...prev, elapsed, eta };
      });
    }, 250);

    return () => clearInterval(tickRef.current);
  }, [exporting, progress?.startedAt]);

  const handleDownloadData = async () => {
    if (!user || exporting) return;

    setExportError('');
    setExportSuccess('');
    setExporting(true);

    const estimatedSeconds = preview?.estimatedSeconds || 60;
    const estimatedBytes = preview?.estimatedBytes || 0;
    const startedAt = Date.now();

    setProgress({
      phase: 'connecting',
      percent: 3,
      elapsed: 0,
      eta: estimatedSeconds,
      received: 0,
      total: estimatedBytes,
      estimatedSeconds,
      startedAt,
      filename: '',
    });

    try {
      const params = new URLSearchParams({ format: exportFormat });

      setProgress((prev) => ({ ...prev, phase: 'building', percent: 8 }));

      const res = await branchFetch(user, `/api/hq/data-export?${params.toString()}`);

      if (!res.ok) {
        let message = 'Export failed';
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          message = res.statusText || message;
        }
        throw new Error(message);
      }

      const headerTotal = Number(res.headers.get('Content-Length')) || 0;
      const headerEstimate = Number(res.headers.get('X-Estimated-Bytes')) || estimatedBytes;
      const totalBytes = headerTotal || headerEstimate;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const fallbackExt = exportFormat === 'excel' ? 'xlsx' : 'sql';
      const dbName = preview?.database?.toLowerCase() || 'database';
      const filename = match?.[1] || `ittefaq-${dbName}-${new Date().toISOString().slice(0, 10)}.${fallbackExt}`;

      setProgress((prev) => ({
        ...prev,
        phase: 'downloading',
        filename,
        total: totalBytes,
        percent: 12,
      }));

      const reader = res.body?.getReader();
      let blob;

      if (reader) {
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          received += value.length;
          const elapsed = (Date.now() - startedAt) / 1000;
          const speed = received / Math.max(elapsed, 0.1);
          let percent = 12;

          if (totalBytes > 0) {
            percent = Math.min(98, 12 + (received / totalBytes) * 86);
          } else {
            percent = Math.min(95, 12 + (elapsed / estimatedSeconds) * 83);
          }

          const eta = totalBytes > received && speed > 0
            ? (totalBytes - received) / speed
            : Math.max(0, estimatedSeconds - elapsed);

          setProgress((prev) => ({
            ...prev,
            phase: 'downloading',
            percent,
            elapsed,
            eta,
            received,
            total: totalBytes || Math.max(received, prev.total),
            filename,
          }));
        }

        setProgress((prev) => ({ ...prev, phase: 'saving', percent: 99 }));
        blob = new Blob(chunks, {
          type: res.headers.get('Content-Type') || 'application/octet-stream',
        });
      } else {
        blob = await res.blob();
        const elapsed = (Date.now() - startedAt) / 1000;
        setProgress((prev) => ({
          ...prev,
          phase: 'saving',
          percent: 99,
          elapsed,
          received: blob.size,
          total: blob.size || totalBytes,
          filename,
        }));
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const elapsed = (Date.now() - startedAt) / 1000;
      setProgress({
        phase: 'done',
        percent: 100,
        elapsed,
        eta: 0,
        received: blob.size,
        total: blob.size,
        filename,
        estimatedSeconds,
        startedAt,
      });
      setExportSuccess(`Download complete: ${filename} (${formatBytes(blob.size)})`);
    } catch (err) {
      setExportError(err.message || 'Export failed');
      setProgress(null);
    } finally {
      setExporting(false);
    }
  };

  const activeStep = progress ? getActiveStep(progress.phase) : -1;
  const showProgress = exporting || progress?.phase === 'done';
  const controlsDisabled = exporting || previewLoading;

  return (
    <Paper
      elevation={0}
      className={HQ_UI.card}
      sx={{ overflow: 'hidden', border: '1px solid rgba(226,232,240,0.9)' }}
    >
      {/* Header */}
      <Box
        sx={{
          px: { xs: 2.5, md: 3 },
          py: 2.5,
          background: HQ_GRADIENTS.welcome,
          borderBottom: '1px solid #eef1f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              background: HQ_GRADIENTS.activeNav,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(67,56,202,0.28)',
            }}
          >
            <Database size={26} strokeWidth={2.25} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
              Data Download
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
              Download the complete database — all branches, HQ users & every table
            </Typography>
          </Box>
        </Box>
        {previewLoading && !exporting && (
          <Chip
            size="small"
            icon={<CircularProgress size={12} thickness={6} sx={{ color: HQ_BRAND.primary }} />}
            label="Analyzing database…"
            sx={{
              fontWeight: 700,
              bgcolor: 'white',
              color: HQ_BRAND.primary,
              border: `1px solid ${HQ_BRAND.tintSoft}`,
              boxShadow: '0 2px 8px rgba(67,56,202,0.08)',
            }}
          />
        )}
      </Box>

      <Box sx={{ p: { xs: 2.5, md: 3 }, bgcolor: '#f9fafb' }}>
        {exportError && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setExportError('')}>
            {exportError}
          </Alert>
        )}

        {exportSuccess && !exporting && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setExportSuccess('')}>
            {exportSuccess}
          </Alert>
        )}

        {previewError && !exporting && (
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setPreviewError('')}>
            {previewError}
          </Alert>
        )}

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={Layers}
              label="Tables"
              value={preview?.tableCount?.toLocaleString() || '—'}
              loading={previewLoading && !preview}
              paletteKey="tables"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={Database}
              label="Approx. rows"
              value={preview?.totalRows?.toLocaleString() || '—'}
              loading={previewLoading && !preview}
              paletteKey="rows"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={HardDrive}
              label="Est. file size"
              value={preview?.estimatedSizeLabel || '—'}
              loading={previewLoading && !preview}
              paletteKey="size"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={Clock3}
              label="Est. time"
              value={preview?.estimatedTimeLabel || '—'}
              loading={previewLoading && !preview}
              paletteKey="time"
            />
          </Grid>
        </Grid>

        {/* Controls card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: '1rem',
            border: '1px solid #e2e8f0',
            bgcolor: 'white',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <Grid container spacing={2.5} alignItems="stretch">
            <Grid item xs={12} lg={8}>
              <Typography variant="caption" fontWeight={800} sx={{ color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                Export format
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <FormatOption
                  active={exportFormat === 'sql'}
                  disabled={controlsDisabled}
                  icon={Server}
                  title="SQL (.sql)"
                  subtitle="Full backup, restore ready"
                  onClick={() => setExportFormat('sql')}
                />
                <FormatOption
                  active={exportFormat === 'excel'}
                  disabled={controlsDisabled}
                  icon={FileSpreadsheet}
                  title="Excel (.xlsx)"
                  subtitle="One sheet per table"
                  onClick={() => setExportFormat('excel')}
                />
              </Box>
            </Grid>

            <Grid item xs={12} lg={4} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <Button
                fullWidth
                variant="contained"
                disabled={controlsDisabled || !preview?.tableCount}
                onClick={handleDownloadData}
                startIcon={
                  exporting
                    ? <CircularProgress size={18} color="inherit" />
                    : <Download size={18} />
                }
                sx={{
                  py: 1.5,
                  fontWeight: 800,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  background: HQ_GRADIENTS.btnPrimary,
                  boxShadow: '0 8px 24px rgba(67,56,202,0.3)',
                  '&:hover': {
                    background: HQ_GRADIENTS.btnPrimary,
                    filter: 'brightness(1.06)',
                    boxShadow: '0 10px 28px rgba(67,56,202,0.36)',
                  },
                  '&.Mui-disabled': {
                    background: '#e2e8f0',
                    color: '#94a3b8',
                    boxShadow: 'none',
                  },
                }}
              >
                {exporting ? 'Exporting…' : 'Download Data'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {(scopeLabel || preview?.database) && (
          <Box
            sx={{
              mt: 2,
              p: 1.75,
              borderRadius: 2,
              bgcolor: HQ_BRAND.tint,
              border: `1px solid ${HQ_BRAND.tintSoft}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'white',
                color: HQ_BRAND.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${HQ_BRAND.tintSoft}`,
              }}
            >
              <Info size={16} />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={800} sx={{ color: HQ_BRAND.primaryDark, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Export scope
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#1e293b', mt: 0.25 }}>
                {scopeLabel}
              </Typography>
            </Box>
          </Box>
        )}

        {showProgress && progress && (
          <Paper
            elevation={0}
            sx={{
              mt: 2.5,
              borderRadius: '1rem',
              overflow: 'hidden',
              border: `1px solid ${HQ_BRAND.tintSoft}`,
              boxShadow: '0 4px 20px rgba(67,56,202,0.1)',
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                background: HQ_GRADIENTS.activeNav,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                {progress.phase === 'done' ? (
                  <CheckCircle2 size={22} color="#86efac" />
                ) : (
                  <CircularProgress size={22} thickness={4} sx={{ color: '#fff' }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fff' }}>
                    {progress.phase === 'done'
                      ? 'Export finished successfully'
                      : progress.phase === 'saving'
                        ? 'Saving file to your device…'
                        : progress.phase === 'downloading'
                          ? 'Downloading export file…'
                          : progress.phase === 'building'
                            ? 'Building export on server…'
                            : 'Connecting to database…'}
                  </Typography>
                  {progress.filename && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.82)',
                        fontFamily: 'ui-monospace, monospace',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {progress.filename}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: '#fff', flexShrink: 0 }}>
                {Math.round(progress.percent)}%
              </Typography>
            </Box>

            <Box sx={{ p: 2.5, bgcolor: 'white' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, progress.percent))}
                sx={{
                  height: 8,
                  borderRadius: 99,
                  mb: 2.5,
                  bgcolor: HQ_BRAND.tint,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 99,
                    background: HQ_GRADIENTS.headerAccent,
                  },
                }}
              />

              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                {[
                  { label: 'Elapsed', value: formatDuration(progress.elapsed || 0) },
                  { label: 'Remaining', value: progress.phase === 'done' ? '0s' : formatDuration(progress.eta || 0) },
                  {
                    label: 'Downloaded',
                    value: progress.received
                      ? `${formatBytes(progress.received)}${progress.total ? ` / ${formatBytes(progress.total)}` : ''}`
                      : '—',
                  },
                ].map((item) => (
                  <Grid item xs={4} key={item.label}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: '#f8fafc',
                        border: '1px solid #eef1f6',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body1" fontWeight={800} sx={{ color: '#0f172a', mt: 0.35 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {EXPORT_STEPS.map((step, index) => {
                  const done = index < activeStep || progress.phase === 'done';
                  const active = index === activeStep && progress.phase !== 'done';
                  return (
                    <Chip
                      key={step.id}
                      size="small"
                      label={step.label}
                      icon={
                        done
                          ? <CheckCircle2 size={14} />
                          : active
                            ? <CircularProgress size={12} thickness={6} sx={{ color: 'inherit !important' }} />
                            : undefined
                      }
                      sx={{
                        fontWeight: 700,
                        height: 28,
                        bgcolor: done ? '#ecfdf5' : active ? HQ_BRAND.tint : '#f1f5f9',
                        color: done ? '#047857' : active ? HQ_BRAND.primary : '#94a3b8',
                        border: `1px solid ${done ? '#a7f3d0' : active ? HQ_BRAND.tintSoft : '#e2e8f0'}`,
                        '& .MuiChip-icon': { color: 'inherit' },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          </Paper>
        )}
      </Box>
    </Paper>
  );
}
