module.exports = {
  apps: [
    {
      name: 'pm25-dashboard',
      script: 'npm',
      args: 'start', // Use 'start' for production, which runs 'next start'
      cwd: 'C:\\Users\\USER\\Documents\\Mr_Opeyemi_Project\\pm25-dashboard',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // Explicitly set port
      },
    },
  ],
};