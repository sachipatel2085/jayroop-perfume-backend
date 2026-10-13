/**
 * pm2 process file for the VPS.
 *   pm2 start ecosystem.config.cjs      (first time)
 *   pm2 reload jayrup                   (after an update – zero downtime)
 * PORT and every secret come from jayroop-perfume-backend/.env
 */
module.exports = {
  apps: [
    {
      name: 'jayrup',
      cwd: __dirname,
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '450M',
      time: true,
      kill_timeout: 8000,
    },
  ],
};
