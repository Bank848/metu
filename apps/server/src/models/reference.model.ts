// Reference data DTOs (business-types, countries).

export interface BusinessType {
  typeId: number;
  name: string;
  description: string;
}

export interface Country {
  countryId: number;
  countryCode: number;
  name: string;
}
