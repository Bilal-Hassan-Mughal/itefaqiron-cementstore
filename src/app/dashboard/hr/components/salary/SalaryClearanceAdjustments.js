'use client';

import { useState } from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails, TextField, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { HR_FIELD_SX } from '../shared/hrUiShared';

const fieldSx = { ...HR_FIELD_SX, width: '100%' };

export default function SalaryClearanceAdjustments({ clearForm, setClearForm }) {
  const [expanded, setExpanded] = useState(false);
  const hasValues =
    parseFloat(clearForm.bonus || 0) > 0
    || parseFloat(clearForm.extra_deduction || 0) > 0
    || parseFloat(clearForm.advance_with_salary || 0) > 0;

  return (
    <Accordion
      expanded={expanded || hasValues}
      onChange={(_, v) => setExpanded(v)}
      disableGutters
      elevation={0}
      sx={{
        border: 'none',
        bgcolor: 'transparent',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 20 }} />}
        sx={{ minHeight: 40, px: 0, '& .MuiAccordionSummary-content': { my: 0 } }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: '#94a3b8' }}>
          Bonus or advance
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0, pb: 1 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label="Bonus"
            type="number"
            value={clearForm.bonus}
            onChange={(e) => setClearForm((f) => ({ ...f, bonus: e.target.value }))}
            sx={fieldSx}
          />
          <TextField
            fullWidth
            label="Extra cut"
            type="number"
            value={clearForm.extra_deduction}
            onChange={(e) => setClearForm((f) => ({ ...f, extra_deduction: e.target.value }))}
            sx={fieldSx}
          />
          <TextField
            fullWidth
            label="Advance with pay"
            type="number"
            value={clearForm.advance_with_salary}
            onChange={(e) => setClearForm((f) => ({ ...f, advance_with_salary: e.target.value }))}
            sx={fieldSx}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
