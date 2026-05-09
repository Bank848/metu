"use client";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { coins, thbToCoins } from "@/lib/format";
import { SelectInput } from "./SelectInput";
import { NumberInput } from "./NumberInput";
import { TextInput } from "./TextInput";

export type DeliveryMethod = "download" | "email" | "license_key" | "streaming";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "download",    label: "Download" },
  { value: "email",       label: "Email" },
  { value: "license_key", label: "License key" },
  { value: "streaming",   label: "Streaming" },
];

export type AdditionalDetailRowValue = {
  detailName: string;
  detailValue: string;
};

export interface AdditionalDetailRowProps {
  index: number;
  value: AdditionalDetailRowValue;
  onChange: (next: Partial<AdditionalDetailRowValue>) => void;
  onRemove?: () => void;

  isProtected?: boolean;

  removable: boolean;
  className?: string;
}

export function AdditionalDetailRow({
  index,
  value,
  onChange,
  onRemove,
  isProtected = false,
  removable,
  className,
}: AdditionalDetailRowProps) {
  return (
    <div className="flex gap-2 mb-2 items-end">
      <div className="flex-1">
        <TextInput
          label="Detail Name"
          helperText="(Optional) To provide additional information to customers"
          type="text"
          value={value.detailName ?? ""}
          onChange={(e) => onChange({ detailName: e.target.value })}
          placeholder="e.g. File Size"
        />
      </div>
      <div className="flex-1">
        <TextInput
          label="Detail Value"
          helperText="(Optional) To provide additional information to customers"
          type="text"
          value={value.detailValue ?? ""}
          onChange={(e) => onChange({ detailValue: e.target.value })}
          placeholder="e.g. .obj, .jpeg"
        />
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 mb-[22px] text-red-500 border border-red-500/20 rounded-lg px-3 py-3 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
