// Menu của khung chung DashboardShell / DashboardLayout. Từ 11/11/2026 chỉ vai trò ADMIN còn dùng khung này:
// khách, quản lý, chuyên viên, điều phối, tài xế và hộ tống đều có màn riêng (xem features/home/HomePage.tsx).
export type Area = { id:string; title:string; description:string; columns:string[] };
export type Workspace = { name:string; title:string; intro:string; areas:Area[] };
const area=(id:string,title:string,description:string,columns:string[]=[]):Area=>({id,title,description,columns});
export const workspaces:Record<string,Workspace>={
ADMIN:{name:'Administrator',title:'Không gian quản trị',intro:'Quản lý tài khoản nhân sự và khách hàng, xem thông báo hệ thống.',areas:[area('accounts','Quản lý tài khoản','Tạo tài khoản nhân sự, đổi vai trò, khóa và mở khóa, đặt lại mật khẩu.')]},
};
export const roleGuides:Record<string,{title:string;steps:string[]}>={
ADMIN:{title:'Việc của quản trị viên',steps:['Tạo tài khoản cho nhân sự mới, chọn đúng vai trò (tài xế, hộ tống được tạo kèm hồ sơ tổ lái).','Gửi mật khẩu ban đầu qua kênh riêng và nhắc người dùng đổi mật khẩu.','Khóa tài khoản khi nhân sự nghỉ việc; nêu rõ lý do để lưu vết.','Đặt lại mật khẩu khi người dùng quên, rồi gửi mật khẩu mới qua kênh riêng.']},
};
