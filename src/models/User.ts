import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for FCM Token subdocument
export interface IFCMToken extends Document {
  token: string;
  device: string;
  createdAt?: Date;
}

// Interface for User document
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  isEmailVerified: boolean;
  phoneNumber?: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  security: {
    encryptKeysByDefault: boolean;
  };
  fcmTokens?: Types.DocumentArray<IFCMToken>;
  createdAt: Date;
  updatedAt: Date;
}

const FCMTokenSchema = new Schema<IFCMToken>(
    {
      token: { type: String, required: true },
      device: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
  );

const userSchema = new Schema<IUser>(
  {
    // Authentication
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      validate: {
        validator: function (v: string) {
          return !v || /^\+[1-9]\d{1,14}$/.test(v);
        },
        message: 'Phone number must be in E.164 format (+1234567890)',
      },
    },
    fcmTokens: {
        type: [FCMTokenSchema],
        default: [],
      },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Notification Settings
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },

    // Security Settings
    security: {
      encryptKeysByDefault: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);