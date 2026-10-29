import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
export function usersRoutes(service: UsersService) {
  const router = Router(), controller = new UsersController(service);
  router.get('/me', controller.me);
  router.get('/me/avatar',async(req,res)=>{res.set('Cache-Control','no-store').json(await service.avatar(req.account.id));});
  router.post('/me/avatar',multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}}).single('avatar'),async(req,res)=>{res.json(await service.saveAvatar(req.account.id,req.file));});
  router.patch('/me', controller.updateProfile);
  router.post('/me/password', rateLimit({windowMs:15*60*1000,limit:10,keyGenerator:req=>String(req.account.id),message:{message:'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'}}), controller.changePassword);
  router.get('/', authorize(Role.ADMIN), controller.list);
  return router;
}

