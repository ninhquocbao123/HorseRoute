import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '../../shared/core/error.response';
import { TokenService } from '../../shared/utils/jwt.util';
import { Role } from '@my-project/shared';
import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './auth.dto';
import { User } from '../users/users.model';
import { emailVerificationEnabled, type Mailer } from '../../shared/mail/mailer';
import { Logger } from '../../shared/utils/logger.util';
const logger = new Logger('Auth');
import { CODE_MAX_ATTEMPTS, CODE_RESEND_SECONDS, CODE_TTL_MINUTES, consumeCode, issueCode, type CodePurpose } from './auth-codes';

const SENT = 'Nếu email này có tài khoản, mã gồm 6 số đã được gửi tới hộp thư. Mã có hiệu lực trong ' + CODE_TTL_MINUTES + ' phút.';
const notVerified = () => new ForbiddenException({ message: 'Email chưa được xác minh. Nhập mã đã gửi tới email hoặc gửi lại mã.', code: 'EMAIL_NOT_VERIFIED' });
const codeError = (result: 'invalid' | 'expired') => new BadRequestException({
  message: result === 'invalid' ? 'Mã không đúng.' : `Mã đã hết hạn hoặc nhập sai quá ${CODE_MAX_ATTEMPTS} lần. Hãy gửi lại mã mới.`,
  fields: { code: result === 'invalid' ? 'Mã không đúng.' : 'Mã đã hết hiệu lực.' },
});

export class AuthService {
 constructor(private readonly users:UsersService,private readonly jwt:TokenService,private readonly db?:DataSource,private readonly mailer?:Mailer){}
 private session(user:User){const safeUser=UsersService.publicUser(user);return {accessToken:this.jwt.sign({sub:user.id,email:user.email,role:user.role,ver:Number(user.tokenVersion??0)}),user:safeUser};}
 get verificationRequired(){return !!this.mailer&&emailVerificationEnabled(this.mailer);}

 async login(email:string,password:string){
  const user=await this.users.findByEmailWithPassword(email);
  if(!user||!user.passwordHash||!await bcrypt.compare(password,user.passwordHash))throw new UnauthorizedException('Email hoặc mật khẩu không đúng, hoặc tài khoản không hoạt động.');
  // Đúng mật khẩu nhưng chưa xác minh email: báo riêng để web, mobile hiện bước nhập mã.
  if(user.accountStatus==='PENDING'&&user.role===Role.CUSTOMER)throw notVerified();
  if(user.accountStatus!=='ACTIVE')throw new UnauthorizedException('Email hoặc mật khẩu không đúng, hoặc tài khoản không hoạt động.');
  return this.session(user);
 }

 /** Có SMTP (hoặc EMAIL_VERIFICATION=true): tạo tài khoản chờ xác minh và gửi mã. Không có: kích hoạt ngay như trước. */
 async register(dto:RegisterDto){
  if(Buffer.byteLength(dto.password,'utf8')>72)throw new BadRequestException('Mật khẩu không được vượt quá 72 byte UTF-8.');
  const email=dto.email.trim().toLowerCase();
  if(await this.users.findByEmailWithPassword(email))throw new ConflictException('Email đã được sử dụng.');
  const passwordHash=await bcrypt.hash(dto.password,12);
  const verify=this.verificationRequired;
  let user:User;
  try{user=await this.users.create({email,passwordHash,fullName:dto.fullName.trim(),phone:dto.phone.trim(),address:dto.address.trim(),customerType:dto.customerType||'INDIVIDUAL',organizationName:dto.customerType==='CLUB'?dto.organizationName?.trim()||null:null,role:Role.CUSTOMER,accountStatus:verify?'PENDING':'ACTIVE'});}
  catch(error){if((error as {code?:string}).code==='ER_DUP_ENTRY')throw new ConflictException('Email đã được sử dụng.');throw error;}
  if(!verify)return this.session(user);
  await this.sendCode(user,'VERIFY_EMAIL');
  return {verificationRequired:true,email,message:`Đã gửi mã xác minh gồm 6 số tới ${email}. Mã có hiệu lực trong ${CODE_TTL_MINUTES} phút.`};
 }

 async verifyEmail(email:string,code:string){
  const db=this.requireDb();
  const user=await this.users.findByEmailWithPassword(email);
  if(!user||user.role!==Role.CUSTOMER)throw codeError('expired');
  if(user.accountStatus==='ACTIVE')return this.session(user);
  if(user.accountStatus!=='PENDING')throw new UnauthorizedException('Tài khoản không hoạt động.');
  const result=await db.transaction(async m=>{
   const outcome=await consumeCode(m,user.id,'VERIFY_EMAIL',code);
   if(outcome==='ok')await m.query("UPDATE users SET account_status='ACTIVE' WHERE id=? AND account_status='PENDING'",[user.id]);
   return outcome;
  });
  if(result!=='ok')throw codeError(result);
  return this.session({...user,accountStatus:'ACTIVE'} as User);
 }

 async resendVerification(email:string){
  const user=await this.users.findByEmailWithPassword(email);
  if(user?.accountStatus==='PENDING'&&user.role===Role.CUSTOMER)await this.sendCode(user,'VERIFY_EMAIL');
  return {message:SENT};
 }

 /** Luôn trả cùng một câu, không để lộ email nào có tài khoản. */
 async forgotPassword(email:string){
  const user=await this.users.findByEmailWithPassword(email);
  if(user?.accountStatus==='ACTIVE')await this.sendCode(user,'RESET_PASSWORD');
  else if(this.mailer&&!this.mailer.configured&&process.env.NODE_ENV==='production')throw new ServiceUnavailableException('Hệ thống chưa cấu hình gửi email. Liên hệ quản trị viên để đặt lại mật khẩu.');
  return {message:SENT};
 }

 async resetPassword(email:string,code:string,password:string){
  const db=this.requireDb();
  if(Buffer.byteLength(password,'utf8')>72)throw new BadRequestException('Mật khẩu không được vượt quá 72 byte UTF-8.');
  const user=await this.users.findByEmailWithPassword(email);
  if(!user||user.accountStatus!=='ACTIVE')throw codeError('expired');
  const hash=await bcrypt.hash(password,12);
  const result=await db.transaction(async m=>{
   const outcome=await consumeCode(m,user.id,'RESET_PASSWORD',code);
   if(outcome==='ok'){
    // Mọi phiên cũ hết hiệu lực.
    await m.query('UPDATE users SET password_hash=?,token_version=token_version+1 WHERE id=?',[hash,user.id]);
    await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'USER',?,'RESET_PASSWORD_BY_EMAIL',NULL,NULL,NULL)",[user.id,user.id]);
   }
   return outcome;
  });
  if(result!=='ok')throw codeError(result);
  return {message:'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới; các thiết bị khác đã bị đăng xuất.'};
 }

 private requireDb(){if(!this.db)throw new ServiceUnavailableException('Chức năng chưa sẵn sàng.');return this.db;}

 private async sendCode(user:User,purpose:CodePurpose){
  const db=this.requireDb();
  if(!this.mailer)throw new ServiceUnavailableException('Chức năng chưa sẵn sàng.');
  const code=await db.transaction(m=>issueCode(m,user.id,purpose));
  if(!code)return; // Vừa gửi trong CODE_RESEND_SECONDS giây: không gửi thêm, câu trả lời vẫn như cũ.
  const reset=purpose==='RESET_PASSWORD';
  try{
   await this.mailer.send({to:user.email,subject:reset?'HorseRoute: mã đặt lại mật khẩu':'HorseRoute: mã xác minh email',text:[
    `Xin chào ${user.fullName},`,'',
    reset?'Có yêu cầu đặt lại mật khẩu cho tài khoản HorseRoute của bạn.':'Cảm ơn bạn đã đăng ký HorseRoute. Nhập mã sau để kích hoạt tài khoản.',
    '',`Mã của bạn: ${code}`,'',`Mã có hiệu lực trong ${CODE_TTL_MINUTES} phút và chỉ dùng được một lần.`,
    reset?'Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.':'Nếu bạn không đăng ký, hãy bỏ qua email này.',
    '','HorseRoute',
   ].join('\n')});
  }catch(error){
   logger.error('mail_send_failed',{purpose,code:(error as {code?:string}).code||'UNKNOWN'});
   throw new ServiceUnavailableException(`Chưa gửi được email. Vui lòng thử lại sau ${CODE_RESEND_SECONDS} giây.`);
  }
 }
}
