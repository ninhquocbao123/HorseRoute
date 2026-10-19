import { Router } from "express";
import { Role } from "@my-project/shared";
import { authorize } from "../../shared/middlewares/auth.middleware";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
export function tripsRoutes(service: TripsService) {
  const router = Router(),
    controller = new TripsController(service);
  router.use(authorize(Role.COORDINATOR, Role.MANAGER));
  router.get("/:id/assignment-options", controller.assignmentOptions);
  router.get("/:id/assignments", controller.assignments);
  router.put(
    "/:id/assignments",
    authorize(Role.COORDINATOR),
    controller.saveAssignments,
  );
  router.post("/:id/review-plan", authorize(Role.MANAGER), controller.review);
  router.post(
    "/:id/submit-plan",
    authorize(Role.COORDINATOR),
    controller.submit,
  );
  router.put("/:id/plan", authorize(Role.COORDINATOR), controller.save);
  router.get("/", controller.list);
  router.get("/:id/plan-options", controller.options);
  router.get("/:id", controller.detail);
  return router;
}
