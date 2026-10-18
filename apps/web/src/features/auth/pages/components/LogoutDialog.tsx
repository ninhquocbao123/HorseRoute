import {useEffect,useRef} from 'react';
import '../../../orders/save-order-dialog.css';

export default function LogoutDialog({hasChanges,onCancel,onConfirm}:{hasChanges:boolean;onCancel:()=>void;onConfirm:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="save-order-dialog logout-dialog" aria-labelledby="logout-title" aria-describedby="logout-description" onCancel={e=>{e.preventDefault();onCancel();}}>
  <div className="save-order-icon" aria-hidden="true">↗</div><span className="save-order-kicker">TÀI KHOẢN</span>
  <h2 id="logout-title">Bạn muốn đăng xuất?</h2>
  <p id="logout-description">{hasChanges?'Bạn có thay đổi chưa lưu. Đăng xuất sẽ bỏ những thay đổi này; bản nháp đã lưu vẫn được giữ nguyên.':'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.'}</p>
  <div className="save-order-actions"><button type="button" autoFocus onClick={onCancel}>Ở lại</button><button type="button" className="logout-confirm" onClick={onConfirm}>{hasChanges?'Bỏ thay đổi và đăng xuất':'Đăng xuất'}</button></div>
 </dialog>;
}
