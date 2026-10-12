import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@my-project/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { User } from '../users/entities/user.entity';
import { DocumentsService } from './documents.service';
import { DocumentReviewDto, DossierUpdateDto, SupplementDto } from './documents.dto';
import { MAX_FILE_SIZE, Upload } from './file-storage';
const upload=()=>FileInterceptor('file',{limits:{fileSize:MAX_FILE_SIZE,files:1,fields:5,fieldSize:2048}});
function key(v:string){if(!/^[1-9]\d{0,19}$/.test(v))throw new BadRequestException('ID không hợp lệ.');return v;}
type Request={account:User};
@ApiTags('Flow 2 - Documents') @ApiBearerAuth()
@Controller('documents') @UseGuards(RolesGuard) @Roles(Role.CUSTOMER,Role.SPECIALIST,Role.MANAGER)
export class DocumentsController {
 constructor(private readonly service:DocumentsService){}
 @Get('orders') @ApiOperation({summary:'Đơn có checklist; Customer chỉ xem đơn của mình'})
 list(@Req() r:Request,@Query() p:PaginationDto){return this.service.list(r.account,p);}
 @Get('orders/:orderId') @ApiOperation({summary:'Checklist, các phiên bản, bảng ngựa × cơ quan và lịch sử'})
 detail(@Req() r:Request,@Param('orderId') orderId:string){return this.service.detail(r.account,key(orderId));}
 @Post('orders/:orderId/items/:id/upload') @Roles(Role.CUSTOMER) @UseInterceptors(upload()) @ApiConsumes('multipart/form-data')
 @ApiOperation({summary:'Customer nộp phiên bản mới; PDF/JPG/PNG tối đa 5 MB'})
 @ApiBody({schema:{type:'object',required:['file'],properties:{file:{type:'string',format:'binary'}}}})
 upload(@Req() r:Request,@Param('orderId') o:string,@Param('id') id:string,@UploadedFile() file:Upload){return this.service.upload(r.account,key(o),key(id),file);}
 @Post('orders/:orderId/items/:id/review') @Roles(Role.SPECIALIST)
 @ApiOperation({summary:'Thẩm định đúng phiên bản mới nhất; giấy tờ có hạn phải ghi ngày hết hạn'})
 review(@Req() r:Request,@Param('orderId') o:string,@Param('id') id:string,@Body() dto:DocumentReviewDto){return this.service.review(r.account,key(o),key(id),dto);}
 @Post('orders/:orderId/items/:id/request') @Roles(Role.SPECIALIST)
 @ApiOperation({summary:'Yêu cầu Customer bổ sung một mục checklist, kèm lý do'})
 request(@Req() r:Request,@Param('orderId') o:string,@Param('id') id:string,@Body() dto:SupplementDto){return this.service.request(r.account,key(o),key(id),dto.reason);}
 @Post('orders/:orderId/dossiers/:id') @Roles(Role.SPECIALIST) @UseInterceptors(upload()) @ApiConsumes('multipart/form-data')
 @ApiOperation({summary:'Ghi nhận nộp cơ quan, tiến độ, kết quả; APPROVED cần file giấy phép'})
 @ApiBody({schema:{type:'object',required:['status','date'],properties:{status:{type:'string',enum:['SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED']},date:{type:'string',format:'date'},receiptCode:{type:'string'},reason:{type:'string'},file:{type:'string',format:'binary'}}}})
 dossier(@Req() r:Request,@Param('orderId') o:string,@Param('id') id:string,@Body() dto:DossierUpdateDto,@UploadedFile() file?:Upload){return this.service.updateDossier(r.account,key(o),key(id),dto,file);}
 @Get('orders/:orderId/files/:id') @ApiOperation({summary:'Tải file sau khi kiểm tra quyền; không có URL công khai'})
 async download(@Req() r:Request,@Param('orderId') o:string,@Param('id') id:string,@Res() res:Response){const f=await this.service.download(r.account,key(o),key(id));res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);res.setHeader('Cache-Control','private, no-store');res.send(f.buffer);}
}

