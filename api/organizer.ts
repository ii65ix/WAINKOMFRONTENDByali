import { OrganizerInfo } from "@/types/OrganizerInfo";
import instance from ".";

export type OrganizerCreatePayload = {
  name: string;
  address: string;
  image: string;
  phone: string;
  email: string;
  bio?: string;
  website?: string;
};

export const getOrgProfile = async () => {
  try {
    const { data } = await instance.get<OrganizerInfo>("/organizer/my-profile");
    return data;
  } catch (error: any) {
    if (__DEV__) {
      console.log(
        "getOrgProfile error:",
        error?.response?.status || "no_status",
        error?.response?.data || error?.message || "unknown_error"
      );
    }
    throw error;
  }
};

export const createOrganizerProfile = async (payload: OrganizerCreatePayload) => {
  const { data } = await instance.post<OrganizerInfo>("/organizer", payload);
  return data;
};

export function isOrganizerProfileComplete(org?: Partial<OrganizerCreatePayload> | null): boolean {
  if (!org) return false;
  const required = ["name", "address", "image", "phone", "email"] as const;
  return required.every((k) => !!(org as any)[k]);
}


