import { ProviderType } from "@prisma/client";
import { db } from "@/lib/db";

type CreateProviderInput = {
  providerType: ProviderType;
  nameAr: string;
  nameEn: string;
  country: string;
  city: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
};

export async function createProvider(input: CreateProviderInput) {
  await db.provider.create({
    data: {
      providerType: input.providerType,
      nameAr: input.nameAr,
      nameEn: input.nameEn || null,
      country: input.country || null,
      city: input.city || null,
      contactPerson: input.contactPerson || null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      notes: input.notes || null,
    },
  });
}
