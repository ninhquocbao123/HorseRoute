import {Modal} from 'antd';

export default function LogoutDialog({hasChanges,onCancel,onConfirm}:{hasChanges:boolean;onCancel:()=>void;onConfirm:()=>void}){
 return <Modal rootClassName="app-confirm-dialog" open centered width={440} title="Bạn muốn đăng xuất?" okText={hasChanges?'Bỏ thay đổi và đăng xuất':'Đăng xuất'} cancelText="Ở lại" okButtonProps={{danger:hasChanges}} mask={{closable:false}} onOk={onConfirm} onCancel={onCancel}>
  <p>{hasChanges?'Bạn có thay đổi chưa lưu. Đăng xuất sẽ bỏ những thay đổi này; bản nháp đã lưu vẫn được giữ nguyên.':'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.'}</p>
 </Modal>;
}
