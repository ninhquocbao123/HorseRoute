import { Modal } from 'antd';

export default function SaveOrderDialog({onAnswer}:{onAnswer:(save:boolean)=>void}) {
  return <Modal
    open
    centered
    width={480}
    title="Bạn có thay đổi chưa lưu"
    okText="Bỏ thay đổi và tiếp tục"
    cancelText="Tiếp tục chỉnh sửa"
    okButtonProps={{danger:true}}
    maskClosable={false}
    onOk={()=>onAnswer(true)}
    onCancel={()=>onAnswer(false)}
  >
    <p><strong>Bỏ thay đổi và tiếp tục?</strong><br/>Nội dung chưa lưu sẽ bị mất. Bản nháp đã lưu trước đó vẫn được giữ nguyên.</p>
  </Modal>;
}
