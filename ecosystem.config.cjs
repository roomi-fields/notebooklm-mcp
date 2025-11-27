/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 process manager for running the NotebookLM HTTP server
 * as a background daemon process.
 *
 * Usage:
 *   npm run daemon:start   - Start server in background
 *   npm run daemon:stop    - Stop background server
 *   npm run daemon:restart - Restart server
 *   npm run daemon:logs    - View server logs
 *   npm run daemon:status  - Check server status
 *
 * Learn more: https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

module.exports = {
  apps: [
    {
      name: 'notebooklm-mcp',
      script: 'dist/http-wrapper.js',

      // Instance configuration
      instances: 1,
      exec_mode: 'fork',

      // Restart behavior
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',

      // Restart on crashes with exponential backoff
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Add other env vars from .env if needed
        // NOTEBOOK_URL: 'https://notebooklm.google.com/notebook/...',
        // HEADLESS: 'true',
      },

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
    },
  ],
};
