import {Modal} from 'antd';

export default function LogoutDialog({hasChanges,onCancel,onConfirm}:{hasChanges:boolean;onCancel:()=>void;onConfirm:()=>void}){
 return <Modal open centered width={480} title="Bạn muốn đăng xuất?" okText={hasChanges?'Bỏ thay đổi và đăng xuất':'Đăng xuất'} cancelText="Ở lại" okButtonProps={{danger:hasChanges}} maskClosable={false} onOk={onConfirm} onCancel={onCancel}>
  <p>{hasChanges?'Bạn có thay đổi chưa lưu. Đăng xuất sẽ bỏ những thay đổi này; bản nháp đã lưu vẫn được giữ nguyên.':'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.'}</p>
 </Modal>;
}
