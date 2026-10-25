import type { RequestHandler } from 'express';
import { DocumentsService } from './documents.service';
import { parse, idSchema } from '../../shared/utils/validation.util';
import { paginationSchema } from '../../shared/utils/pagination.util';
import { documentReviewSchema, supplementSchema, dossierUpdateSchema } from './documents.validation';
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account, parse(paginationSchema, req.query))); };
  detail: RequestHandler = async (req, res) => { res.json(await this.service.detail(req.account, parse(idSchema, req.params.orderId))); };
  upload: RequestHandler = async (req, res) => { res.status(201).json(await this.service.upload(req.account, parse(idSchema, req.params.orderId), parse(idSchema, req.params.id), req.file!)); };
  review: RequestHandler = async (req, res) => { res.status(201).json(await this.service.review(req.account, parse(idSchema, req.params.orderId), parse(idSchema, req.params.id), parse(documentReviewSchema, req.body))); };
  request: RequestHandler = async (req, res) => { res.status(201).json(await this.service.request(req.account, parse(idSchema, req.params.orderId), parse(idSchema, req.params.id), parse(supplementSchema, req.body).reason)); };
  dossier: RequestHandler = async (req, res) => { res.status(201).json(await this.service.updateDossier(req.account, parse(idSchema, req.params.orderId), parse(idSchema, req.params.id), parse(dossierUpdateSchema, req.body), req.file)); };
  download: RequestHandler = async (req, res) => {
    const f = await this.service.download(req.account, parse(idSchema, req.params.orderId), parse(idSchema, req.params.id));
    res.setHeader('Content-Type', ({PDF:'application/pdf',PNG:'image/png',JPG:'image/jpeg',JPEG:'image/jpeg'} as Record<string,string>)[f.file_type] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.buffer);
  };
}

