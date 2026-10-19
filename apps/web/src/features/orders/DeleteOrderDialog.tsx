import {Modal} from 'antd';
export default function DeleteOrderDialog({onClose,onDelete}:{onClose:()=>void;onDelete:()=>void}){
 return <Modal open centered width={480} title="Xóa đơn nháp?" okText="Xác nhận xóa" cancelText="Giữ lại đơn" okButtonProps={{danger:true}} maskClosable={false} onOk={onDelete} onCancel={onClose}>
  <p>Đơn và nội dung đang nhập sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
 </Modal>;
}
