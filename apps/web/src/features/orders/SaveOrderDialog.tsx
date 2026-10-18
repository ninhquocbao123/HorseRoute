import { useEffect, useRef } from 'react';
import './save-order-dialog.css';

export default function SaveOrderDialog({onAnswer}:{onAnswer:(save:boolean)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const element=dialog.current!;
    element.showModal();
    return()=>{element.close();previous?.focus();};
  },[]);
  return <dialog ref={dialog} className="save-order-dialog" aria-labelledby="save-order-title" aria-describedby="save-order-description" onCancel={e=>{e.preventDefault();onAnswer(false);}}>
    <div className="save-order-icon" aria-hidden="true">!</div>
    <span className="save-order-kicker">THAY ĐỔI CHƯA LƯU</span>
    <h2 id="save-order-title">Bạn có thay đổi chưa lưu.</h2>
    <p id="save-order-description"><strong>Bỏ thay đổi và tiếp tục?</strong><br/>Nội dung chưa lưu sẽ bị mất. Bản nháp đã lưu trước đó vẫn được giữ nguyên.</p>
    <div className="save-order-actions">
      <button type="button" autoFocus onClick={()=>onAnswer(false)}>Tiếp tục chỉnh sửa</button>
      <button type="button" className="flow-danger" onClick={()=>onAnswer(true)}>Bỏ thay đổi và tiếp tục</button>
    </div>
  </dialog>;
}
