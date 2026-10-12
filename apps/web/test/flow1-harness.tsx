// Isolated UI harness; not part of production routing or build entry.
import React from 'react';
import { createRoot } from 'react-dom/client';
import OrdersWorkspace from '../src/features/orders/OrdersWorkspace';
import '../src/styles/index.css';
const role=new URLSearchParams(location.search).get('role')==='MANAGER'?'MANAGER':'CUSTOMER';
createRoot(document.getElementById('root')!).render(<main className="workspace"><OrdersWorkspace role={role} refreshNotifications={()=>{}}/></main>);
