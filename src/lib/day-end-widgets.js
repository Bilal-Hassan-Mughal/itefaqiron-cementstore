/**
 * Optional widgets on Day End / Day Close — assign individually in User Management.
 */

/** @type {{ id: string, name: string, description: string }[]} */
export const DAY_END_WIDGETS = [
  {
    id: 'day-end-profit-summary',
    name: 'Profit Summary',
    description: 'Gross profit, net profit, and profit margin on day closing',
  },
];

export const DAY_END_WIDGET_IDS = DAY_END_WIDGETS.map((w) => w.id);

export const DAY_END_WIDGET_ID_SET = new Set(DAY_END_WIDGET_IDS);
