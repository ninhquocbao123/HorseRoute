import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {Role} from '@my-project/shared';
import DashboardLayout from '../src/features/auth/pages/components/DashboardLayout';
import '../src/styles/index.css';
function Harness(){const [logout,setLogout]=useState(false);return logout?<p>Đã đăng xuất (kiểm thử)</p>:<BrowserRouter><DashboardLayout account={{id:'test',role:(Role[(new URLSearchParams(location.search).get('role')||'') as keyof typeof Role]||Role.DRIVER_ESCORT),fullName:'Phan Thị Lan',email:'test@example.invalid',phone:'0901234567',address:'Địa chỉ kiểm thử',accountStatus:'ACTIVE',createdAt:new Date().toISOString()}} logout={()=>setLogout(true)}/></BrowserRouter>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
