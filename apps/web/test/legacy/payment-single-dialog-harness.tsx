import React from 'react';
import {createRoot} from 'react-dom/client';
import AntDesignProvider from '../src/app/providers/AntDesignProvider';
import CustomerQuote from '../src/features/manager/CustomerQuote';
createRoot(document.getElementById('root')!).render(<AntDesignProvider><CustomerQuote orderId="1" orderCode="VCN-TEST" orderStatus="PREPARING"/></AntDesignProvider>);
