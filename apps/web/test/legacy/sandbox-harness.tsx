import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import PaymentSandbox from '../src/features/payments/PaymentSandbox';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/payments/sandbox?order=1&type=DEPOSIT']}><PaymentSandbox/></MemoryRouter>);
