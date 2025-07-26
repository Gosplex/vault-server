import mongoose from 'mongoose';


const itemSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      
    name: { type: String, required: true },

    category: {
        type: String,
        enum: ['hardware', 'software', 'subscription'],
        required: true,
    },

    cost: Number,
    purchaseDate: Date,
    fileUrls: [String],
    notes: String,
    encrypted: { type: Boolean, default: false },

    subscriptionDetails: {
        lastRenewalDate: Date,
        nextRenewalDate: Date,
        isRecurring: Boolean,
        renewalFrequency: {
            type: String,
            enum: ['monthly', 'yearly', 'weekly', 'custom'],
        },
        provider: String,
        subscriptionType: String,
        autoRenew: Boolean,
        reminderDaysBefore: Number,
        cancelUrl: String,
    },

    softwareDetails: {
        licenseKey: String,
        licenseType: {
            type: String,
            enum: ['lifetime', 'subscription', 'trial', 'open-source'],
        },
        licenseStartDate: Date,
        licenseEndDate: Date,
        version: String,
        platform: [String],
        vendor: String,
        website: String,
        activationEmail: String,
    },

    hardwareDetails: {
        serialNumber: String,
        manufacturer: String,
        warrantyExpiryDate: Date,
        modelNumber: String,
        specifications: String,
        condition: {
            type: String,
            enum: ['new', 'used', 'refurbished'],
        },
        location: String,
        assignedTo: String,
    },
}, {
    timestamps: true,
});


export default mongoose.model('Item', itemSchema);
