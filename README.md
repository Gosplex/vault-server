# 🔐 Vault - Developer Tech Stack Manager

A secure, developer-focused platform to track and manage your entire tech stack — from physical hardware to software, licenses, credentials, and subscriptions — all in one place.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Service Configuration](#service-configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## 🎯 Overview

Vault helps developers organize their tech ecosystem by providing:
- **Secure Inventory Management**: Track hardware, software, and subscriptions
- **Server-Side Encryption**: AES-256 encryption for sensitive data like license keys and credentials
- **Smart Notifications**: Get alerted about renewals, warranty expirations, and subscription costs
- **Spending Analytics**: Understand your monthly/yearly tech spending
- **Document Storage**: Upload and manage receipts, invoices, and warranty documents

## ✨ Features

### Core Features
- 🔐 **Secure Tech Inventory** - Categorize and track all your tech items
- 🛡️ **Server-Side AES-256 Encryption** - Protect sensitive license keys and credentials
- 📅 **Expiry & Renewal Notifications** - Never miss important renewals
- 💸 **Spending Reports** - Track your tech expenses
- 🧾 **File Uploads** - Store receipts and warranty documents
- 🔔 **Multi-Channel Notifications** - Push, SMS, and Email alerts

### Advanced Features
- 📤 **Gmail Integration** - Auto-parse receipts from emails
- 💾 **Encrypted Backups** - Export/import your data securely


## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express |
| **Database** | MongoDB |
| **File Storage** | Cloudinary |
| **Notifications** | Firebase (Push), Twilio (SMS), Gmail (Email) |
| **Authentication** | JWT |
| **Encryption** | AES-256 (Server-side) |

## 📋 Prerequisites

Before setting up Vault, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Git** - [Download](https://git-scm.com/)

## 🔧 Environment Setup

### 1. Create Environment File

Create a `.env` file in your project root with the following variables:

```bash
NODE_ENV=development
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
FIREBASE_PROJECT_ID=vault-your-project-id
FIREBASE_PRIVATE_KEY_ID=your_firebase_private_key_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_CLIENT_ID=your_firebase_client_id
FIREBASE_SERVER_KEY=your_firebase_server_key
GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd vault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install additional dependencies**
   ```bash
   npm install express mongoose @cloudinary/react @cloudinary/url-gen onesignal-node dotenv node-cron axios bcryptjs jsonwebtoken
   ```

4. **Install development dependencies**
   ```bash
   npm install --save-dev @types/express @types/node @types/bcryptjs @types/jsonwebtoken
   ```

## ⚙️ Service Configuration

### 🍃 MongoDB Setup

1. **Create MongoDB Atlas Account**
   - Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account
   - Create a new cluster

2. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Add to `.env` as `MONGO_URI`

### ☁️ Cloudinary Setup

1. **Create Cloudinary Account**
   - Visit [Cloudinary](https://cloudinary.com/)
   - Sign up for a free account

2. **Get API Credentials**
   - Go to your Dashboard
   - Copy the following values:
     - Cloud Name → `CLOUDINARY_CLOUD_NAME`
     - API Key → `CLOUDINARY_API_KEY`
     - API Secret → `CLOUDINARY_API_SECRET`

### 🔥 Firebase Setup

1. **Create Firebase Project**
   - Visit [Firebase Console](https://console.firebase.google.com/)
   - Click "Create a project"
   - Enable Firebase Cloud Messaging (FCM)

2. **Generate Service Account Key**
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

3. **Extract Firebase Credentials**
   ```json
   {
     "project_id": "your-project-id",
     "private_key_id": "your-private-key-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
     "client_id": "your-client-id"
   }
   ```

4. **Get Server Key**
   - Go to Project Settings → Cloud Messaging
   - Copy the Server Key → `FIREBASE_SERVER_KEY`

### 📧 Gmail App Password Setup

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to Security → 2-Step Verification
   - Enable 2FA if not already enabled

2. **Generate App Password**
   - Go to Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Vault App"
   - Copy the generated password → `GMAIL_APP_PASSWORD`
   - Use your Gmail address → `GMAIL_USER`

### 📱 Twilio Setup

1. **Create Twilio Account**
   - Visit [Twilio](https://www.twilio.com/)
   - Sign up for a free account
   - Verify your phone number

2. **Get Twilio Credentials**
   - Go to Console Dashboard
   - Copy the following:
     - Account SID → `TWILIO_ACCOUNT_SID`
     - Auth Token → `TWILIO_AUTH_TOKEN`

3. **Get Phone Number**
   - Go to Phone Numbers → Manage → Active numbers
   - Copy your Twilio phone number → `TWILIO_PHONE_NUMBER`
   - Format: `+1234567890`

### 🔑 JWT Secret Generation

Generate a secure JWT secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

Copy the output to `JWT_SECRET` in your `.env` file.

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

The application will start on PORT `5001`

### Production Mode

```bash
npm run build
npm start
```


## 🔒 Security Features

- **Server-Side Encryption**: All sensitive data is encrypted using AES-256 before storage
- **JWT Authentication**: Secure user authentication and session management
- **Environment Variables**: All secrets stored in environment variables
- **Input Validation**: All user inputs are validated and sanitized

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run type checking
npm run type-check

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Application environment | ✅ |
| `PORT` | Server port | ✅ |
| `MONGO_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `FIREBASE_PRIVATE_KEY_ID` | Firebase private key ID | ✅ |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email | ✅ |
| `FIREBASE_CLIENT_ID` | Firebase client ID | ✅ |
| `FIREBASE_SERVER_KEY` | Firebase server key | ✅ |
| `GMAIL_USER` | Gmail address | ✅ |
| `GMAIL_APP_PASSWORD` | Gmail app password | ✅ |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | ✅ |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | ✅ |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | ✅ |

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure your IP is whitelisted in MongoDB Atlas
   - Check if the connection string is correct
   - Verify network connectivity

2. **Firebase Authentication Error**
   - Ensure the private key is properly formatted in the `.env` file
   - Check if the service account has necessary permissions

3. **Twilio SMS Not Working**
   - Verify your Twilio account is verified
   - Check if the phone number format is correct (+1234567890)
   - Ensure you have SMS credits

4. **Gmail SMTP Error**
   - Confirm 2FA is enabled on your Google account
   - Verify the app password is correctly generated
   - Check if "Less secure app access" is disabled (use app password instead)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- MongoDB for the flexible database solution
- Cloudinary for image storage and optimization
- Firebase for reliable push notifications
- Twilio for SMS services

---

**Made with ❤️ for developers by Gospel John**