'use client';

import { forwardRef } from 'react';
import {
  SALE_DROPDOWN_LINE,
  SALE_CUSTOMER_DROPDOWN_GRID,
  saleDropdownRowStyle,
  saleDropdownHeaderCell,
} from './sale-utils';

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
            <span
              key={label || `h-${i}`}
              style={{
                ...saleDropdownHeaderCell,
                borderRight: i === headers.length - 1 ? 'none' : SALE_DROPDOWN_LINE,
                justifyContent: label === '#' ? 'center' : label === 'Balance' ? 'flex-end' : 'flex-start',
                paddingRight: label === 'Balance' ? 10 : 8,
              }}
            >
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

export default SaleDropdownListbox;
