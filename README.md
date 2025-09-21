# 🚀 AWS File Manager

> A modern, feature-rich React application for managing AWS S3 backups with Glacier integration, real-time activity tracking, and comprehensive cost analysis.

![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react)
![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20Glacier-FF9900?style=for-the-badge&logo=amazon-aws)
![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=for-the-badge&logo=firebase)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Vite](https://img.shields.io/badge/Vite-Build%20Tool-646CFF?style=for-the-badge&logo=vite)

## ✨ Features

### 📁 **Storage Management**
- **Intuitive Navigation**: Browse and navigate S3 folders with a modern interface
- **Smart Upload**: Drag-and-drop files and folders with real-time progress tracking
- **Reliable Downloads**: Download files and folders with resume capability
- **File Operations**: Rename, move, and organize files effortlessly
- **Bulk Operations**: Handle multiple files simultaneously
- **Real-time Monitoring**: Live transfer progress with detailed statistics

### 🧊 **Glacier Integration**
- **Seamless Storage Classes**: Automatic Glacier storage class management
- **Flexible Restoration**: Multiple retrieval options for archived files
  - ⚡ **Expedited** (1-5 minutes) - For urgent retrievals
  - 📋 **Standard** (3-5 hours) - For regular access
  - 📦 **Bulk** (5-12 hours) - For cost-effective mass retrievals
- **Storage Insights**: Comprehensive Glacier statistics and analytics
- **Transition Tracking**: Monitor files moving between storage classes

### 💰 **Cost Management & Analytics**
- **Detailed Analysis**: Complete cost breakdown and projections
- **Multi-dimensional Tracking**: Storage, transfer, and request costs
- **Trending & Forecasting**: Cost projections with visual analytics
- **Currency Support**: Multi-currency display (USD/INR)
- **Budget Optimization**: Recommendations for cost reduction

### 📊 **Activity History & Monitoring**
- **Real-time Logging**: Instant activity tracking powered by Supabase
- **Comprehensive History**: Complete audit trail of all file operations
- **Advanced Filtering**: Search and filter activities by date, type, and user
- **Performance Metrics**: Detailed statistics and insights
- **Export Capabilities**: Download activity reports

### 🔐 **Security & Authentication**
- **Firebase Auth**: Secure user authentication and authorization
- **Protected Operations**: Role-based access control
- **reCAPTCHA**: Bot protection for sensitive operations
- **Secure Transfers**: Encrypted file operations

### 🎨 **User Experience**
- **Modern UI**: Responsive design with Bootstrap 5
- **Real-time Updates**: Live notifications and progress indicators
- **Smart Navigation**: Breadcrumb navigation and intuitive layouts
- **Toast Notifications**: Non-intrusive operation feedback
- **Theme Support**: Dark/Light theme compatibility
- **Mobile Ready**: Fully responsive across all devices

## 🛠️ **Tech Stack**

## 🛠️ **Tech Stack**

| Category | Technology | Purpose |
|----------|------------|---------|
| **Frontend** | React 18 + Vite | Modern build tool and development server |
| **UI Framework** | Bootstrap 5 | Responsive design and components |
| **Authentication** | Firebase Auth | Secure user management |
| **Database** | Supabase | Real-time activity history and analytics |
| **Cloud Storage** | AWS S3 + Glacier | File storage and archival |
| **APIs** | AWS SDK v3 | Cloud service integration |
| **State Management** | React Context | Application state handling |
| **Notifications** | React-Toastify | User feedback system |

## 🚀 **Getting Started**

### Prerequisites
- **Node.js** 16+ and npm
- **AWS Account** with S3 access
- **Firebase Project** with Authentication enabled
- **Supabase Project** for database functionality

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GunjanGrunge/CloudCopilot.git
   cd awsfilemanager/awsbackupUIReact
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   # AWS Configuration
   VITE_BUCKET_NAME=your-s3-bucket-name
   VITE_REGION=your-aws-region
   VITE_ACCESS_KEY_ID=your-aws-access-key
   VITE_SECRET_KEY=your-aws-secret-key
   
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_APP_ID=your-firebase-app-id
   VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   
   # Supabase Configuration
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   
   # CloudFront (Optional)
   VITE_CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id
   VITE_CLOUDFRONT_DOMAIN=your-cloudfront-domain
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

## 🏗️ **Building for Production**

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

## ⚙️ **Configuration Guide**

### AWS Setup
1. **Create S3 Bucket** with appropriate CORS configuration
2. **Configure IAM User** with S3 and Glacier permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```
3. **Set up Lifecycle Rules** for automatic Glacier transitions

### Firebase Setup
1. Create a **Firebase project** at https://console.firebase.google.com
2. **Enable Authentication** with Email/Password provider
3. **Configure reCAPTCHA** for additional security
4. **Add web app** and copy configuration values

### Supabase Setup
1. Create a **Supabase project** at https://supabase.com
2. **Run the database schema** from `src/database/activity_history_table.sql`
3. **Configure RLS policies** for user data isolation
4. **Copy API keys** to environment variables

## 📈 **Key Features in Detail**

### Activity History System
- **Real-time logging** of all file operations
- **Supabase-powered** database for scalability
- **Advanced filtering** and search capabilities
- **Export functionality** for compliance and reporting

### Cost Analytics
- **Real-time cost tracking** across all AWS services
- **Predictive modeling** for budget planning
- **Multi-currency support** for global users
- **Detailed breakdowns** by storage class and operation type

### Security Features
- **Firebase Authentication** integration
- **Role-based access control**
- **Secure API communication**
- **reCAPTCHA protection** against automated attacks

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

## 📄 **License**

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **AWS** for robust cloud infrastructure
- **React Team** for the amazing framework
- **Firebase** for authentication services
- **Supabase** for real-time database capabilities
- **Bootstrap** for UI components

---

<div align="center">

**Built with ❤️ by [Vayu Innovation](https://github.com/GunjanGrunge)**

![AWS](https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>
