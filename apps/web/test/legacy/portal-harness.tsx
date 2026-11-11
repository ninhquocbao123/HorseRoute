import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {Role} from '@my-project/shared';
import 'antd/dist/reset.css';
import DashboardLayout from '../src/features/auth/pages/components/DashboardLayout';
import DriverDashboard from '../src/features/auth/pages/Driver/DriverDashboard';
import AntDesignProvider from '../src/app/providers/AntDesignProvider';
import {applyThemeCssVariables} from '../src/styles/theme-tokens';
import '../src/styles/index.css';
// Same theme and providers as src/main.tsx, so browser tests see the real colors.
applyThemeCssVariables();
// Like HomePage: Driver/Escort gets its own shell, every other role the shared DashboardLayout.
function Harness(){const [logout,setLogout]=useState(false);const account={id:'test',role:(Role[(new URLSearchParams(location.search).get('role')||'') as keyof typeof Role]||Role.DRIVER_ESCORT),fullName:'Phan Thị Lan',email:'test@example.invalid',phone:'0901234567',address:'Địa chỉ kiểm thử',accountStatus:'ACTIVE',createdAt:new Date().toISOString()};const Page=account.role===Role.DRIVER_ESCORT?DriverDashboard:DashboardLayout;return logout?<p>Đã đăng xuất (kiểm thử)</p>:<BrowserRouter><Page account={account} logout={()=>setLogout(true)}/></BrowserRouter>;}
createRoot(document.getElementById('root')!).render(<AntDesignProvider><Harness/></AntDesignProvider>);
