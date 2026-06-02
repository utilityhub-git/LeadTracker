import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SaleSchema = new Schema(
  {
    phone:       { type: String, required: true },
    nmi:         { type: String, default: null },
    channel:     { type: String, required: true },
    sale_date:   { type: String, default: null },
    center_name:   { type: String, default: null },
    campaign_name: { type: String, default: null },
    imported_at:   { type: Date,   default: () => new Date() },
  },
  { timestamps: false },
);

SaleSchema.index({ phone: 1 });
SaleSchema.index({ phone: 1, channel: 1 });
SaleSchema.index({ nmi: 1 }, { sparse: true });

export type SaleDoc = InferSchemaType<typeof SaleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDoc>) ||
  mongoose.model<SaleDoc>("Sale", SaleSchema);
