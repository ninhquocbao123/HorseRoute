import AntDesignProvider from '../src/app/providers/AntDesignProvider';
import React from 'react';
import {createRoot} from 'react-dom/client';
import Payment from '../src/features/payments/PaymentSimulationModal';
createRoot(document.getElementById('root')!).render(<AntDesignProvider><Payment open orderId="1" paymentType="DEPOSIT" amount={300000} onClose={()=>{}} onSuccess={()=>{}}/></AntDesignProvider>);
