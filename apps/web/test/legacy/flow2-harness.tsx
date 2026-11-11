import React from 'react';
import {createRoot} from 'react-dom/client';
import DocumentsWorkspace from '../src/features/documents/DocumentsWorkspace';
import '../src/styles/index.css';
import '../src/features/home/workspace.css';
createRoot(document.getElementById('root')!).render(<DocumentsWorkspace role={new URLSearchParams(location.search).get('role')||'CUSTOMER'}/>);
