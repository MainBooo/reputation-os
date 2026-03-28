export default () => ({ port: Number(process.env.PORT || 3000), demoMode: process.env.DEMO_MODE === 'true' })
