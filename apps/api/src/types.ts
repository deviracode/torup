import type { Request } from "express";

export interface BusinessParams {
  businessId: string;
  [key: string]: string;
}

export interface BusinessServiceParams extends BusinessParams {
  serviceId: string;
}

export interface BusinessAppointmentParams extends BusinessParams {
  appointmentId: string;
}

export interface BusinessMemberParams extends BusinessParams {
  memberId: string;
}

export interface BusinessCustomerParams extends BusinessParams {
  customerId: string;
}

export interface BusinessBreakParams extends BusinessParams {
  breakId: string;
}

export interface SlugParams {
  slug: string;
  [key: string]: string;
}

export interface IdParams {
  id: string;
  [key: string]: string;
}
