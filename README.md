# AWS Backup Manager

A modern, feature-rich React application for managing AWS S3 backups with Glacier integration, built using React 18, Vite, and AWS SDK v3.

## Features

### Storage Management
- Browse and navigate S3 folders with an intuitive interface
- Upload files and folders with progress tracking
- Download files and folders with resume capability
- Rename files and folders
- Bulk operations support
- Real-time transfer progress monitoring

### Glacier Integration
- Seamless Glacier storage class management
- File restoration from Glacier with multiple retrieval options:
  - Expedited (1-5 minutes)
  - Standard (3-5 hours)
  - Bulk (5-12 hours)
- Glacier storage statistics and insights
- Transition status tracking for files moving to Glacier

### Cost Management
- Detailed cost analysis and breakdown
- Storage costs by storage class
- Transfer costs tracking
- Request costs monitoring
- Cost projections and trending
- Multi-currency support (USD/INR)

### Security
- Firebase Authentication integration
- Secure file operations
- Client-side encryption
- reCAPTCHA protection

### User Experience
- Modern, responsive UI with Bootstrap 5
- Real-time transfer progress monitoring
- Toast notifications for operations
- Breadcrumb navigation
- Drag-and-drop file upload
- Sort and filter capabilities
- Dark/Light theme support

## Tech Stack

- **Frontend**: React 18, Bootstrap 5
- **Build Tool**: Vite
- **Authentication**: Firebase Auth
- **Storage**: AWS S3, Glacier
- **APIs**: AWS SDK v3
- **State Management**: React Context
- **Notifications**: React-Toastify
- **File Handling**: AWS Transfer Manager

## Setup

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Configure environment variables:
Create a .env file with:
\`\`\`
VITE_BUCKET_NAME=your-bucket-name
VITE_REGION=your-aws-region
VITE_ACCESS_KEY_ID=your-access-key
VITE_SECRET_KEY=your-secret-key
VITE_FIREBASE_API_KEY=your-firebase-key
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
\`\`\`

4. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## Building for Production

1. Build the project:
\`\`\`bash
npm run build
\`\`\`

2. Preview the production build:
\`\`\`bash
npm run preview
\`\`\`

## AWS Configuration

1. Create an S3 bucket with Glacier lifecycle rules
2. Configure CORS for your bucket
3. Set up IAM user with appropriate permissions
4. Configure lifecycle rules for Glacier transition

## Firebase Setup

1. Create a Firebase project
2. Enable Authentication
3. Configure reCAPTCHA
4. Add your web app to Firebase
5. Copy configuration to environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
