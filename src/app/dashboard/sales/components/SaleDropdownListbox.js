'use client';

import { forwardRef } from 'react';
import { IconButton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  SALE_DROPDOWN_LINE,
  SALE_CUSTOMER_DROPDOWN_GRID,
  SALE_PRODUCT_DROPDOWN_GRID,
  saleDropdownRowStyle,
  saleDropdownCellStyle,
  saleDropdownHeaderCell,
} from './sale-utils';

const SALE_DROPDOWN_HEADER_RIGHT = new Set(['Balance', 'Sale rate', 'Cost']);

function headerCellStyle(label, i, total) {
  return {
    ...saleDropdownHeaderCell,
    borderRight: i === total - 1 ? 'none' : SALE_DROPDOWN_LINE,
    justifyContent: label === '#' ? 'center' : SALE_DROPDOWN_HEADER_RIGHT.has(label) ? 'flex-end' : 'flex-start',
    paddingRight: SALE_DROPDOWN_HEADER_RIGHT.has(label) ? 10 : 8,
  };
}

/**
 * Reusable tabular listbox for MUI Autocomplete dropdowns (product / customer).
 * Renders a sticky header row and a virtualised list of option rows.
 */
export function SaleDropdownListbox({ columns, headers, props, listRef }) {
  const { children, ownerState, sx, className, style, slots, slotProps, ...other } = props;
  return (
    <ul
      ref={listRef}
      className={className}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        maxHeight: 320,
        overflow: 'auto',
        border: SALE_DROPDOWN_LINE,
        background: '#fff',
        ...style,
      }}
      {...other}
    >
      {headers.length > 0 && (
        <li
          role="presentation"
          aria-hidden
          style={{
            ...saleDropdownRowStyle(columns),
            position: 'sticky',
            top: 0,
            zIndex: 2,
            pointerEvents: 'none',
            background: '#d9e2f3',
          }}
        >
          {headers.map((label, i) => (
            <span key={label || `h-${i}`} style={headerCellStyle(label, i, headers.length)}>
              {label}
            </span>
          ))}
        </li>
      )}
      {children}
    </ul>
  );
}

/**
 * Pre-configured tabular listbox for customer autocomplete.
 * Shows columns: #, Name, Phone, Address, Balance.
 */
export const SaleCustomerDropdownListbox = forwardRef(function SaleCustomerDropdownListbox(props, ref) {
  return (
    <SaleDropdownListbox
      listRef={ref}
      props={props}
      columns={SALE_CUSTOMER_DROPDOWN_GRID}
      headers={['#', 'Name', 'Phone', 'Address', 'Balance']}
    />
  );
});

export const SaleProductDropdownListbox = forwardRef(function SaleProductDropdownListbox(props, ref) {
  return (
    <SaleDropdownListbox
      listRef={ref}
      props={props}
      columns={SALE_PRODUCT_DROPDOWN_GRID}
      headers={['Product', '']}
    />
  );
});

/**
 * Tabular product row — keeps visibility toggle for purchase/cost rate (same behavior as before).
 */
export function createSaleProductRenderOption({ visibleCrates, toggleVisibleCrate, fmtRateQty }) {
  return function renderSaleProductOption(props, option) {
    const { key, ...optionProps } = props;
    const showCost = visibleCrates.includes(option.pro_id);
    const costLabel =
      showCost && option.pro_cost_price
        ? fmtRateQty(option.pro_cost_price)
        : showCost
          ? 'N/A'
          : '';

    return (
      <li
        key={option.pro_id ?? key}
        {...optionProps}
        style={{ ...saleDropdownRowStyle(SALE_PRODUCT_DROPDOWN_GRID), ...optionProps.style }}
      >
        <span
          title={option.pro_title || ''}
          style={{
            ...saleDropdownCellStyle,
            fontWeight: 700,
            color: '#111827',
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'unset',
            lineHeight: 1.25,
          }}
        >
          {option.pro_title || ''}
        </span>
        <span
          style={{
            ...saleDropdownCellStyle,
            borderRight: 'none',
            justifyContent: 'flex-end',
            gap: 4,
            paddingRight: 4,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 12,
            color: '#475569',
            fontWeight: 600,
          }}
        >
          {costLabel ? <span title="Purchase / cost rate">{costLabel}</span> : null}
          <IconButton
            size="small"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleVisibleCrate(option.pro_id);
            }}
            aria-label={showCost ? 'Hide purchase rate' : 'Show purchase rate'}
            sx={{ p: 0.25 }}
          >
            <VisibilityIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </li>
    );
  };
}

export default SaleDropdownListbox;
