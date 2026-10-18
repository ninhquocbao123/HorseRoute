import {useEffect,useRef} from 'react';
import './save-order-dialog.css';
export default function DeleteOrderDialog({onClose,onDelete}:{onClose:()=>void;onDelete:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="save-order-dialog" aria-labelledby="delete-order-title" aria-describedby="delete-order-description" onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="save-order-icon" aria-hidden="true">!</div><h2 id="delete-order-title">Xóa đơn nháp?</h2>
  <p id="delete-order-description">Đơn và nội dung đang nhập sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
  <div className="save-order-actions"><button type="button" autoFocus onClick={onClose}>Giữ lại đơn</button><button type="button" className="flow-danger" onClick={onDelete}>Xác nhận xóa</button></div>
 </dialog>;
}
