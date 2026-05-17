import { LocationType } from "@prisma/client";
import { db } from "@/lib/db";

type CreateLocationInput = {
  locationType: LocationType;
  nameAr: string;
  nameEn: string;
  country: string;
  city: string;
  branch: string;
  venueName: string;
  roomName: string;
  address: string;
  timezone: string;
  capacity: number | null;
};

export async function createLocation(input: CreateLocationInput) {
  await db.location.create({
    data: {
      locationType: input.locationType,
      nameAr: input.nameAr,
      nameEn: input.nameEn || null,
      country: input.country || null,
      city: input.city || null,
      branch: input.branch || null,
      venueName: input.venueName || null,
      roomName: input.roomName || null,
      address: input.address || null,
      timezone: input.timezone || null,
      capacity: input.capacity,
    },
  });
}
