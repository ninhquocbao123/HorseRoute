import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import VnpayCheckout from '../src/features/payments/VnpayCheckout';
const entry=window.location.search.includes('return=1')?'/payments/vnpay/return?vnp_TxnRef=VNPTEST&vnp_ResponseCode=00':'/payments/vnpay?order=1&type=DEPOSIT';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[entry]}><VnpayCheckout/></MemoryRouter>);
