import type { RequestHandler } from 'express';
import { TrackingService } from './tracking.service';

const uploads = (files: unknown) => (Array.isArray(files) ? files : []);

export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  driverTrips: RequestHandler = async (req, res) => {
    res.json(await this.service.getDriverTrips(req.account));
  };

  tripDetail: RequestHandler = async (req, res) => {
    res.json(await this.service.getTripDetail(req.account, String(req.params.id)));
  };

  recordMilestone: RequestHandler = async (req, res) => {
    res.status(201).json(await this.service.recordMilestone(req.account, String(req.params.legId), req.body));
  };

  completeLeg: RequestHandler = async (req, res) => {
    res.json(await this.service.completeIntermediateLeg(req.account, String(req.params.legId), req.body));
  };

  correctLeg: RequestHandler = async (req, res) => {
    res.json(await this.service.correctLeg(req.account, String(req.params.legId), req.body));
  };

  createHorseLog: RequestHandler = async (req, res) => {
    res.status(201).json(await this.service.createHorseLog(req.account, String(req.params.legId), req.body, uploads(req.files)));
  };

  horseLogs: RequestHandler = async (req, res) => {
    res.json(await this.service.getTripHorseLogs(req.account, String(req.params.tripId)));
  };

  createIncident: RequestHandler = async (req, res) => {
    res.status(201).json(await this.service.createIncident(req.account, String(req.params.tripId), req.body, uploads(req.files)));
  };

  incidents: RequestHandler = async (req, res) => {
    res.json(await this.service.getTripIncidents(req.account, String(req.params.tripId)));
  };

  updateIncident: RequestHandler = async (req, res) => {
    res.json(await this.service.updateIncident(req.account, String(req.params.id), req.body));
  };

  createAlert: RequestHandler = async (req, res) => {
    res.status(201).json(await this.service.createAlert(req.account, String(req.params.tripId), req.body));
  };

  alerts: RequestHandler = async (req, res) => {
    res.json(await this.service.getTripAlerts(req.account, String(req.params.tripId)));
  };

  orderTimeline: RequestHandler = async (req, res) => {
    res.json(await this.service.getOrderTimeline(req.account, String(req.params.orderId)));
  };

  tripTimeline: RequestHandler = async (req, res) => {
    res.json(await this.service.getTripTimeline(req.account, String(req.params.tripId)));
  };

  activeTrips: RequestHandler = async (req, res) => {
    res.json(await this.service.getActiveTrips(req.account));
  };

  attachment: RequestHandler = async (req, res) => {
    const file = await this.service.getAttachmentFile(req.account, String(req.params.id));
    res.setHeader('Content-Type', { PDF: 'application/pdf', PNG: 'image/png', JPG: 'image/jpeg' }[file.fileType]);
    res.setHeader('Content-Disposition', `inline; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.buffer);
  };
}
